import { listStoredNews } from "@/lib/db";
import { syncLatestNews, syncPeople } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST() {
  await syncPeople();
  if (process.env.ENABLE_LIVE_NEWS_SYNC !== "true") {
    return Response.json({ news: listStoredNews(30) });
  }

  try {
    await syncLatestNews({ pageSize: 20, summarize: true });
  } catch (error) {
    console.error("SFC sync failed; returning stored news.", error);
  }
  return Response.json({ news: listStoredNews(30) });
}
