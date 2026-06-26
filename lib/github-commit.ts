import { readFile } from "node:fs/promises";
import { checkpointDb, getDatabasePath } from "@/lib/db";

export type DurableUpdateResult =
  | { status: "committed"; repository: string; branch: string; commitSha: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export async function commitRuntimeDatabase(message = "chore: refresh regulatory data"): Promise<DurableUpdateResult> {
  const token = process.env.GITHUB_REPOSITORY_WRITE_TOKEN;
  if (!token) {
    return { status: "skipped", reason: "GITHUB_REPOSITORY_WRITE_TOKEN is not configured." };
  }

  const repository = resolveRepository();
  if (!repository) {
    return { status: "skipped", reason: "GitHub repository is not configured." };
  }

  const branch = process.env.GITHUB_SYNC_REF || process.env.VERCEL_GIT_COMMIT_REF || "main";
  checkpointDb();

  const content = (await readFile(getDatabasePath())).toString("base64");
  const current = await getCurrentFile(repository, branch, token);
  if (current.status === "failed") return current;
  if (current.content === content) {
    return { status: "skipped", reason: "Seed database is already current." };
  }

  const response = await fetch(`https://api.github.com/repos/${repository}/contents/data/knowledge-alerts.sqlite`, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify({
      branch,
      message,
      content,
      sha: current.sha,
      committer: {
        name: "Terracotta refresh bot",
        email: "41898282+github-actions[bot]@users.noreply.github.com",
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { status: "failed", reason: `GitHub database commit failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}` };
  }

  const payload = (await response.json()) as { commit?: { sha?: string } };
  return { status: "committed", repository, branch, commitSha: payload.commit?.sha ?? "" };
}

async function getCurrentFile(
  repository: string,
  branch: string,
  token: string,
): Promise<{ status: "ok"; sha: string; content: string } | { status: "failed"; reason: string }> {
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/data/knowledge-alerts.sqlite?ref=${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token),
  });

  if (!response.ok) {
    const body = await response.text();
    return { status: "failed", reason: `GitHub seed lookup failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}` };
  }

  const payload = (await response.json()) as { sha?: string; content?: string };
  if (!payload.sha || !payload.content) {
    return { status: "failed", reason: "GitHub seed lookup returned an invalid payload." };
  }

  return {
    status: "ok",
    sha: payload.sha,
    content: payload.content.replace(/\s+/g, ""),
  };
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function resolveRepository(): string | null {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const repo = process.env.VERCEL_GIT_REPO_SLUG;
  return owner && repo ? `${owner}/${repo}` : null;
}
