import type { SfcNewsContent, SfcNewsListItem } from "@/lib/types";

const SFC_BASE = "https://apps.sfc.hk/edistributionWeb";

export async function fetchSfcEnforcementNews(pageNo = 0, pageSize = 20): Promise<{ items: SfcNewsListItem[]; total: number }> {
  const response = await fetch(`${SFC_BASE}/api/news/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lang: "EN",
      category: "enforcement",
      year: "all",
      month: "all",
      ceTargetName: "",
      searchMode: "by-year",
      pageNo,
      pageSize,
    }),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`SFC search failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchSfcNewsContent(refNo: string): Promise<SfcNewsContent> {
  const params = new URLSearchParams({ refNo, lang: "EN" });
  const response = await fetch(`${SFC_BASE}/api/news/content?${params.toString()}`, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`SFC content failed for ${refNo}: ${response.status}`);
  }

  return response.json();
}
