import { closeDb } from "@/lib/db";

type SyncSource = "sfc" | "hkex" | "both";

const args = new Set(process.argv.slice(2));
const source = valueAfter("--source") ?? "both";
const pageSize = Number(valueAfter("--page-size") ?? "20");
const summarize = !args.has("--no-summarize");

if (!isSyncSource(source)) {
  throw new Error(`Invalid --source value "${source}". Use sfc, hkex, or both.`);
}

if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
  throw new Error("--page-size must be an integer from 1 to 100.");
}

process.env.DATABASE_PATH ??= "./data/knowledge-alerts.sqlite";

main().catch((error) => {
  closeDb();
  console.error(error);
  process.exit(1);
});

async function main(): Promise<void> {
  const { syncLatestHkexNews, syncLatestNews, syncPeople } = await import("@/lib/sync");

  try {
    await syncPeople();
    if (source === "sfc" || source === "both") {
      console.log(`Syncing SFC enforcement news: pageSize=${pageSize}, summarize=${summarize}`);
      await syncLatestNews({ pageSize, summarize });
    }
    if (source === "hkex" || source === "both") {
      console.log(`Syncing HKEx regulatory announcements: pageSize=${pageSize}, summarize=${summarize}`);
      await syncLatestHkexNews({ pageSize, summarize });
    }
  } finally {
    closeDb();
  }
}

function valueAfter(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isSyncSource(value: string): value is SyncSource {
  return value === "sfc" || value === "hkex" || value === "both";
}
