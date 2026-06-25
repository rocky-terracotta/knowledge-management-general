import { listStoredNews } from "@/lib/db";
import { syncLatestNews, syncPeople } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST() {
  try {
    await Promise.all([syncLatestNews({ pageSize: 20, summarize: true }), syncPeople()]);
  } catch (error) {
    console.error("SFC sync failed; returning stored news.", error);
  }
  return Response.json({ news: listStoredNews(30) });
}
