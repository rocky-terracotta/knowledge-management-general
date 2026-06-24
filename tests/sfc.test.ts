import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSfcEnforcementNews, fetchSfcNewsContent } from "@/lib/sfc";

describe("SFC adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the enforcement search payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [{ newsRefNo: "26PR90" }], total: 1 }), { status: 200 }),
    );

    const result = await fetchSfcEnforcementNews(0, 20);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));

    expect(result.total).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/news/search");
    expect(body).toMatchObject({
      lang: "EN",
      category: "enforcement",
      searchMode: "by-year",
      pageNo: 0,
      pageSize: 20,
    });
  });

  it("fetches article content by reference number", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ newsRefNo: "26PR90", html: "<p>Body</p>" }), { status: 200 }),
    );

    const result = await fetchSfcNewsContent("26PR90");

    expect(result.newsRefNo).toBe("26PR90");
    expect(String(fetchMock.mock.calls[0][0])).toContain("refNo=26PR90");
    expect(String(fetchMock.mock.calls[0][0])).toContain("lang=EN");
  });
});
