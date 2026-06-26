import { commitRuntimeDatabase } from "@/lib/github-commit";
import { syncLatestHkexNews, syncLatestNews, syncPeople } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await syncPeople();
  await syncLatestNews({ pageSize: 20, summarize: true });
  await syncLatestHkexNews({ pageSize: 20, summarize: true });
  const durable = await commitRuntimeDatabase();

  return Response.json({
    refreshed: ["sfc", "hkex"],
    durable,
  });
}
