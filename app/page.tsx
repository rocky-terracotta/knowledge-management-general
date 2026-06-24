import { AlertsWorkspace } from "@/components/AlertsWorkspace";
import { listPeople, listStoredNews } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  return <AlertsWorkspace initialNews={listStoredNews(30)} people={listPeople()} syncError={null} />;
}
