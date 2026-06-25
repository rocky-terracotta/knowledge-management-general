import { listStoredNews } from "@/lib/db";
import { syncLatestHkexNews, syncPeople } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST() {
  await syncPeople();
  if (process.env.ENABLE_LIVE_NEWS_SYNC !== "true") {
    return Response.json({ news: listStoredNews(20, "hkex") });
  }

  try {
    await syncLatestHkexNews({ pageSize: 20, summarize: true });
  } catch (error) {
    console.error("HKEx sync failed; returning stored news.", error);
  }
  return Response.json({ news: listStoredNews(20, "hkex") });
}
