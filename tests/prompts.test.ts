import { describe, expect, it } from "vitest";
import { buildArticlePrompt, buildConsolidatedArticlePrompt, fallbackHkexSummary, fallbackKeywords, fallbackSummary } from "@/lib/prompts";
import type { FirmPerson, StoredNews } from "@/lib/types";

describe("generation prompts", () => {
  it("builds a source-limited article prompt with profile links and anonymization", () => {
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
      summary: "Summary only text that should not be used as source article body.",
      keywords: ["SFO enforcement", "Shareholder remedies", "Director disqualification", "SFC enforcement", "Regulatory action"],
      contentHtml: "<p>The SFC commenced proceedings under section 214.</p>",
      seen: false,
      sent: false,
      createdAt: "2026-06-18T00:00:00Z",
      updatedAt: "2026-06-18T00:00:00Z",
    };
    const person: FirmPerson = {
      id: 1,
      name: "Adrian Chan",
      title: "Partner",
      profileUrl: "https://terracotta.dev/people/adrian-chan",
      practiceAreas: ["Corporate and Commercial"],
      intro: "Adrian advises on corporate and regulatory matters.",
      imageUrl: null,
    };

    const prompt = buildArticlePrompt({
      news,
      person,
      anonymize: "Initialise individuals",
      requirements: "Focus on governance",
    });

    expect(prompt).toContain("Use only the SFC source text");
    expect(prompt).toContain("The SFC commenced proceedings under section 214.");
    expect(prompt).not.toContain("Summary only text that should not be used as source article body.");
    expect(prompt).toContain("Initialise individuals");
    expect(prompt).toContain("Adrian Chan");
    expect(prompt).toContain("https://terracotta.dev/people/adrian-chan");
    expect(prompt).toContain("Focus on governance");
  });

  it("builds the consolidated article prompt from the separate drafting file", () => {
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
      summary: "Summary only text that should not be used as source article body.",
      keywords: ["SFO enforcement", "Shareholder remedies", "Director disqualification", "SFC enforcement", "Regulatory action"],
      contentHtml: "<p>The SFC commenced proceedings under section 214.</p>",
      seen: false,
      sent: false,
      createdAt: "2026-06-18T00:00:00Z",
      updatedAt: "2026-06-18T00:00:00Z",
    };
    const people: FirmPerson[] = [
      {
        id: 1,
        name: "Adrian Chan",
        title: "Partner",
        profileUrl: "https://terracotta.dev/people/adrian-chan",
        practiceAreas: ["Corporate and Commercial"],
        intro: "Adrian advises on corporate and regulatory matters.",
        imageUrl: null,
      },
      {
        id: 2,
        name: "Jason Wong",
        title: "Associate",
        profileUrl: "https://terracotta.dev/people/jason-wong",
        practiceAreas: ["Regulatory Compliance"],
        intro: "Jason advises on compliance.",
        imageUrl: null,
      },
    ];

    const prompt = buildConsolidatedArticlePrompt({
      newsItems: [news],
      people,
      anonymize: "Use initials for individuals.",
      requirements: "Focus on practical board steps.",
      promptDirections: { "26PR90": ["Explain implications for directors."] },
    });

    expect(prompt).toContain("# Regulatory Enforcement Article Prompt");
    expect(prompt).toContain("80-100 word summary");
    expect(prompt).toContain("## [{{Short subheading for SFC update 1}}]({{sourceUrl}})");
    expect(prompt).toContain("Do not add separate \"SFC announcement\"");
    expect(prompt).not.toContain("[SFC announcement]({{sourceUrl}})");
    expect(prompt).toContain("Explain implications for directors.");
    expect(prompt).toContain("The SFC commenced proceedings under section 214.");
    expect(prompt).not.toContain("Summary only text that should not be used as source article body.");
    expect(prompt).toContain("https://apps.sfc.hk/doc?refNo=26PR90");
    expect(prompt).toContain("Adrian Chan");
    expect(prompt).toContain("https://terracotta.dev/people/adrian-chan");
    expect(prompt).toContain("Jason Wong");
    expect(prompt).toContain("https://terracotta.dev/people/jason-wong");
  });

  it("keeps fallback summaries between 50 and 100 words without ellipses", () => {
    const summary = fallbackSummary(
      "SFC sanctions a licensed corporation",
      "<p>The Securities and Futures Commission imposed sanctions after identifying control failures and record keeping problems. The announcement describes the relevant enforcement outcome and the regulator's stated concerns. The release also explains the disciplinary result and the conduct that prompted regulatory action. It identifies the regulatory context, the affected licensed corporation, and the compliance issues relevant to market participants.</p>",
    );

    expect(summary.split(/\s+/).length).toBeGreaterThanOrEqual(50);
    expect(summary.split(/\s+/).length).toBeLessThanOrEqual(100);
    expect(summary).not.toContain("...");
  });

  it("generates five fallback keywords", () => {
    expect(fallbackKeywords("SFC bans responsible officer", "<p>Licensed corporation misconduct under the SFO.</p>")).toHaveLength(5);
  });

  it("cleans HKEx bilingual boilerplate from fallback summaries", () => {
    const summary = fallbackHkexSummary(
      "Announcement - Cancellation of listing",
      "<p>香港聯合交易所有限公司 THE STOCK EXCHANGE OF HONG KONG LIMITED (A wholly-owned subsidiary of Hong Kong Exchanges and Clearing Limited)</p><p>ANNOUNCEMENT</p><p>The Stock Exchange of Hong Kong Limited announces that the listing of the company's shares will be cancelled with effect from 9:00 am after the company failed to fulfil resumption guidance and resume trading by the applicable deadline. The Listing Review Committee upheld the cancellation decision.</p>",
    );

    expect(summary).not.toMatch(/[\u3400-\u9fff]/);
    expect(summary).toContain("The Exchange announces");
  });
});
