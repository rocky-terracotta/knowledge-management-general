import { listStoredNews } from "@/lib/db";
import { triggerDataSyncWorkflow } from "@/lib/github-actions";
import { syncLatestHkexNews, syncPeople } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST() {
  await syncPeople();
  let refreshed = false;
  if (process.env.ENABLE_LIVE_NEWS_SYNC !== "true") {
    const pipeline = await triggerDataSyncWorkflow("hkex");
    return Response.json({ news: listStoredNews(20, "hkex"), refreshed, pipeline });
  }

  try {
    await syncLatestHkexNews({ pageSize: 20, summarize: true });
    refreshed = true;
  } catch (error) {
    console.error("HKEx sync failed; returning stored news.", error);
  }
  const pipeline = await triggerDataSyncWorkflow("hkex");
  return Response.json({ news: listStoredNews(20, "hkex"), refreshed, pipeline });
}
