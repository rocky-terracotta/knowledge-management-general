import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDraft, FirmPerson, StoredNews } from "@/lib/types";

const people: Record<number, FirmPerson> = {
  1: {
    id: 1,
    name: "Adrian Chan",
    profileUrl: "https://terracotta.dev/people/adrian-chan",
    title: "Partner",
    practiceAreas: ["Corporate governance"],
    intro: "Adrian advises on corporate governance.",
    imageUrl: null,
  },
  6: {
    id: 6,
    name: "Leona Zhang",
    profileUrl: "https://www.linkedin.com/in/leona-zhang/",
    title: "Trainee Solicitor",
    practiceAreas: ["Knowledge management"],
    intro: "Leona assists with legal research.",
    imageUrl: null,
  },
  7: {
    id: 7,
    name: "Rocky Li",
    profileUrl: "https://www.linkedin.com/in/itsrocky/",
    title: "Trainee Solicitor",
    practiceAreas: ["Drafting"],
    intro: "Rocky supports regulatory monitoring work.",
    imageUrl: null,
  },
};

const news: StoredNews = {
  newsRefNo: "26PR90",
  source: "sfc",
  lang: "EN",
  title: "SFC seeks share buy-out order",
  newsExtLink: null,
  newsType: "EF",
  issueDate: "2026-06-17T17:15:00",
  modificationTime: null,
  targetCeList: [{ ceName: "Example Name", lang: "EN", masked: false }],
  sourceUrl: "https://apps.sfc.hk/doc?refNo=26PR90",
  summary: "Short summary.",
  keywords: ["SFC enforcement", "Governance"],
  contentHtml:
    "<p>The Securities and Futures Commission commenced proceedings in the Court of First Instance seeking a share buy-out order and disqualification orders after alleged breaches of fiduciary duties. The source describes the former chairman's roles, the affected listed company, the alleged misuse of company funds, the suspension of trading, and the regulator's application under the Securities and Futures Ordinance. The announcement also identifies other former directors named as respondents and sets out the procedural context for the court proceedings.</p>",
  seen: false,
  sent: false,
  createdAt: "2026-06-18T00:00:00Z",
  updatedAt: "2026-06-18T00:00:00Z",
};

vi.mock("@/lib/db", () => ({
  getPerson: vi.fn((id: number) => people[id] ?? null),
  getStoredNews: vi.fn(() => news),
  saveArticleDraft: vi.fn((input: { markdown: string }): ArticleDraft => ({
    id: 1,
    newsRefNo: news.newsRefNo,
    personId: null,
    personName: null,
    personProfileUrl: null,
    anonymize: "",
    requirements: "",
    markdown: input.markdown,
    createdAt: "2026-06-18T00:00:00Z",
  })),
}));

vi.mock("@/lib/openai", () => ({
  generateText: vi.fn(async (prompt: string) => prompt),
}));

vi.mock("@/lib/sync", () => ({
  ensureNewsContent: vi.fn(async () => undefined),
}));

describe("article generation contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses LinkedIn for trainees and Casebyte for all other contacts in generated article prompts", async () => {
    const { generateConsolidatedArticleDraft } = await import("@/lib/article");

    const draft = await generateConsolidatedArticleDraft({
      newsRefNos: [news.newsRefNo],
      personIds: [1, 6, 7],
      anonymize: "",
      requirements: "",
      promptDirections: {},
    });

    expect(draft.markdown).toContain("Selected Firm contact 1: Adrian Chan");
    expect(draft.markdown).toContain("Profile URL: https://casebyte.ai?utm_source=LZ&utm_medium=linkedin&utm_campaign=kms");
    expect(draft.markdown).not.toContain("https://terracotta.dev/people/adrian-chan");
    expect(draft.markdown).toContain("Selected Firm contact 2: Leona Zhang");
    expect(draft.markdown).toContain("Profile URL: https://www.linkedin.com/in/leona-zhang/");
    expect(draft.markdown).toContain("Selected Firm contact 3: Rocky Li");
    expect(draft.markdown).toContain("Profile URL: https://www.linkedin.com/in/itsrocky/");
  });

  it("uses the required article structure when falling back after LLM failure", async () => {
    const { generateText } = await import("@/lib/openai");
    vi.mocked(generateText).mockRejectedValueOnce(new Error("LLM unavailable"));
    const { generateConsolidatedArticleDraft } = await import("@/lib/article");

    const draft = await generateConsolidatedArticleDraft({
      newsRefNos: [news.newsRefNo],
      personIds: [6],
      anonymize: "",
      requirements: "Focus on board oversight.",
      promptDirections: {},
    });

    expect(draft.markdown).toContain("# SFC seeks share buy-out order");
    expect(draft.markdown).toContain("## [SFC seeks share buy-out order](https://apps.sfc.hk/doc?refNo=26PR90)");
    expect(draft.markdown).toContain("## What this suggests");
    expect(draft.markdown).toContain("## Takeaways");
    expect(draft.markdown).toContain("## Contact");
    expect(draft.markdown).toContain("[Leona Zhang](https://www.linkedin.com/in/leona-zhang/)");
    expect(draft.markdown).not.toContain("This draft is generated from the stored full source article text because live AI generation was unavailable.");
    expect(draft.markdown).not.toContain("## Drafting Notes");
  });
});
