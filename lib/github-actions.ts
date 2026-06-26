export type WorkflowDispatchResult =
  | { status: "queued"; workflow: string; repository: string; ref: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

type SyncSource = "sfc" | "hkex" | "both";

export async function triggerDataSyncWorkflow(source: SyncSource): Promise<WorkflowDispatchResult> {
  const token = process.env.GITHUB_ACTIONS_TRIGGER_TOKEN;
  if (!token) {
    return { status: "skipped", reason: "GITHUB_ACTIONS_TRIGGER_TOKEN is not configured." };
  }

  const repository = resolveRepository();
  if (!repository) {
    return { status: "skipped", reason: "GitHub repository is not configured." };
  }

  const workflow = process.env.GITHUB_SYNC_WORKFLOW_ID || "sync-data.yml";
  const ref = process.env.GITHUB_SYNC_REF || process.env.VERCEL_GIT_COMMIT_REF || "main";
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref,
        inputs: { source },
      }),
    });
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "GitHub workflow dispatch request failed.",
    };
  }

  if (response.status === 204) {
    return { status: "queued", workflow, repository, ref };
  }

  const body = await response.text();
  return {
    status: "failed",
    reason: `GitHub workflow dispatch failed: ${response.status}${body ? ` ${body.slice(0, 240)}` : ""}`,
  };
}

function resolveRepository(): string | null {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const repo = process.env.VERCEL_GIT_REPO_SLUG;
  return owner && repo ? `${owner}/${repo}` : null;
}
