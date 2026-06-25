import { AlertsWorkspace } from "@/components/AlertsWorkspace";
import { listPeople, listStoredNews } from "@/lib/db";
import { syncLatestHkexNews, syncPeople } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const hkexConfig = {
  title: "HKEx Enforcement Tracker",
  subtitle: "Daily digest of HKEx regulatory announcements for the knowledge team",
  sourceName: "HKEx",
  sourceUrl: "https://www.hkex.com.hk/News/Regulatory-Announcements?sc_lang=en",
  refreshEndpoint: "/api/hkex/news/sync",
  articleTitle: "HKEx regulatory update",
  newsNavLimit: 20,
};

export default async function HkexTracker() {
  let syncError: string | null = null;
  await syncPeople();
  const storedNews = listStoredNews(20, "hkex");
  if (storedNews.length < 20 || storedNews.some((item) => !item.summary || !item.contentHtml)) {
    try {
      await syncLatestHkexNews({ pageSize: 20, summarize: true });
    } catch (error) {
      syncError = error instanceof Error ? error.message : "HKEx sync failed.";
    }
  }

  return <AlertsWorkspace initialNews={listStoredNews(20, "hkex")} people={listPeople()} syncError={syncError} config={hkexConfig} />;
}
