import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commitRuntimeDatabase } from "@/lib/github-commit";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => Buffer.from("sqlite")),
}));

vi.mock("@/lib/db", () => ({
  checkpointDb: vi.fn(),
  getDatabasePath: vi.fn(() => "/tmp/knowledge-alerts.sqlite"),
}));

describe("commitRuntimeDatabase", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("skips when no repository token is configured", async () => {
    delete process.env.GITHUB_REPOSITORY_WRITE_TOKEN;

    await expect(commitRuntimeDatabase()).resolves.toMatchObject({
      status: "skipped",
    });
  });

  it("commits the runtime database when it differs from the GitHub seed", async () => {
    process.env.GITHUB_REPOSITORY_WRITE_TOKEN = "token";
    process.env.GITHUB_REPOSITORY = "rocky-terracotta/knowledge-management-general";
    process.env.GITHUB_SYNC_REF = "main";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: "old-sha", content: Buffer.from("old").toString("base64") }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ commit: { sha: "new-sha" } }), { status: 200 }));

    await expect(commitRuntimeDatabase()).resolves.toMatchObject({
      status: "committed",
      commitSha: "new-sha",
    });

    expect(readFile).toHaveBeenCalledWith("/tmp/knowledge-alerts.sqlite");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://api.github.com/repos/rocky-terracotta/knowledge-management-general/contents/data/knowledge-alerts.sqlite",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining("\"sha\":\"old-sha\""),
      }),
    );
  });
});
