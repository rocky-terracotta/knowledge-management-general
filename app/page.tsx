import { AlertsWorkspace } from "@/components/AlertsWorkspace";
import { listPeople, listStoredNews } from "@/lib/db";
import { syncPeople } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  await syncPeople();
  return <AlertsWorkspace initialNews={listStoredNews(30)} people={listPeople()} syncError={null} />;
}
