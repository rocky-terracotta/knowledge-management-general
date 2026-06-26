import { listStoredNews } from "@/lib/db";
import { triggerDataSyncWorkflow } from "@/lib/github-actions";
import { syncLatestNews, syncPeople } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST() {
  await syncPeople();
  let refreshed = false;
  if (process.env.ENABLE_LIVE_NEWS_SYNC !== "true") {
    const pipeline = await triggerDataSyncWorkflow("sfc");
    return Response.json({ news: listStoredNews(30), refreshed, pipeline });
  }

  try {
    await syncLatestNews({ pageSize: 20, summarize: true });
    refreshed = true;
  } catch (error) {
    console.error("SFC sync failed; returning stored news.", error);
  }
  const pipeline = await triggerDataSyncWorkflow("sfc");
  return Response.json({ news: listStoredNews(30), refreshed, pipeline });
}
