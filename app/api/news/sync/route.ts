import { listStoredNews } from "@/lib/db";
import { commitRuntimeDatabase } from "@/lib/github-commit";
import { syncLatestNews, syncPeople } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST() {
  await syncPeople();
  let refreshed = false;
  if (process.env.ENABLE_LIVE_NEWS_SYNC !== "true") {
    return Response.json({ news: listStoredNews(30), refreshed, durable: { status: "skipped", reason: "ENABLE_LIVE_NEWS_SYNC is not true." } });
  }

  try {
    await syncLatestNews({ pageSize: 20, summarize: true });
    refreshed = true;
  } catch (error) {
    console.error("SFC sync failed; returning stored news.", error);
  }
  const durable = refreshed ? await commitRuntimeDatabase() : { status: "skipped", reason: "Live refresh did not complete." };
  return Response.json({ news: listStoredNews(30), refreshed, durable });
}
