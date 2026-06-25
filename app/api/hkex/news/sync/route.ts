import { listStoredNews } from "@/lib/db";
import { syncLatestHkexNews, syncPeople } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST() {
  try {
    await Promise.all([syncLatestHkexNews({ pageSize: 20, summarize: true }), syncPeople()]);
  } catch (error) {
    console.error("HKEx sync failed; returning stored news.", error);
  }
  return Response.json({ news: listStoredNews(20, "hkex") });
}
