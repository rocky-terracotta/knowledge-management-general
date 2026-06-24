import { listStoredNews } from "@/lib/db";
import { syncLatestNews, syncPeople } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST() {
  await Promise.all([syncLatestNews({ pageSize: 20, summarize: true }), syncPeople()]);
  return Response.json({ news: listStoredNews(30) });
}
