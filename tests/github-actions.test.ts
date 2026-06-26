import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerDataSyncWorkflow } from "@/lib/github-actions";

describe("triggerDataSyncWorkflow", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("skips when no trigger token is configured", async () => {
    delete process.env.GITHUB_ACTIONS_TRIGGER_TOKEN;

    await expect(triggerDataSyncWorkflow("sfc")).resolves.toMatchObject({
      status: "skipped",
    });
  });

  it("dispatches the sync workflow for the requested source", async () => {
    process.env.GITHUB_ACTIONS_TRIGGER_TOKEN = "token";
    process.env.GITHUB_REPOSITORY = "rocky-terracotta/knowledge-management-general";
    process.env.GITHUB_SYNC_WORKFLOW_ID = "sync-data.yml";
    process.env.GITHUB_SYNC_REF = "main";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await expect(triggerDataSyncWorkflow("hkex")).resolves.toMatchObject({
      status: "queued",
      repository: "rocky-terracotta/knowledge-management-general",
      workflow: "sync-data.yml",
      ref: "main",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/rocky-terracotta/knowledge-management-general/actions/workflows/sync-data.yml/dispatches",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ref: "main", inputs: { source: "hkex" } }),
      }),
    );
  });
});
