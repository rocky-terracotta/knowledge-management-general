import { listStoredNews } from "@/lib/db";
import { syncLatestHkexNews, syncPeople } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST() {
  await Promise.all([syncLatestHkexNews({ pageSize: 20, summarize: true }), syncPeople()]);
  return Response.json({ news: listStoredNews(20, "hkex") });
}
