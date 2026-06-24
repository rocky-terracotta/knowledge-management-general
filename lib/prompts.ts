import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FirmPerson, StoredNews } from "@/lib/types";
import { limitWords, stripHtml, truncateWords } from "@/lib/text";

const ARTICLE_PROMPT_PATH = join(process.cwd(), "prompts", "sfc-enforcement-article.md");

export function buildSummaryPrompt(title: string, html: string): string {
  return [
    "Write neutral digest metadata for this Hong Kong SFC enforcement news item.",
    "Use only the supplied title and article text. Do not add legal analysis or external facts.",
    "Return JSON only with this shape: {\"summary\":\"50 to 100 words, no ellipsis\", \"keywords\":[\"keyword 1\",\"keyword 2\",\"keyword 3\",\"keyword 4\",\"keyword 5\"]}.",
    "The keywords must be short legal or regulatory topic labels, not names of people unless the person is central to the enforcement action.",
    "",
    `Title: ${title}`,
    "",
    `Article text: ${truncateWords(stripHtml(html), 900)}`,
  ].join("\n");
}

export function buildHkexSummaryPrompt(title: string, html: string): string {
  return [
    "Write neutral digest metadata for this HKEx regulatory announcement.",
    "Use only the supplied title and article text. Do not add legal analysis or external facts.",
    "Return JSON only with this shape: {\"summary\":\"about 50 words, no ellipsis\", \"keywords\":[\"keyword 1\",\"keyword 2\",\"keyword 3\",\"keyword 4\",\"keyword 5\"]}.",
    "The keywords must be short listing, disciplinary, delisting, governance, or regulatory topic labels.",
    "",
    `Title: ${title}`,
    "",
    `Article text: ${truncateWords(stripHtml(html), 900)}`,
  ].join("\n");
}

export function buildArticlePrompt(input: {
  news: StoredNews;
  person?: FirmPerson | null;
  people?: FirmPerson[];
  anonymize: string;
  requirements: string;
}): string {
  const sourceText = stripHtml(input.news.contentHtml ?? "");
  const targets = input.news.targetCeList.map((item) => item.ceName).join(", ") || "Not specified";
  const sourceLabel = input.news.source === "hkex" ? "HKEx regulatory announcement" : "SFC";
  const people = input.people ?? (input.person ? [input.person] : []);
  const personBlock = people.length
    ? people
        .map((person, index) =>
          [
            `Selected Firm contact ${index + 1}: ${person.name}`,
            `Title: ${person.title || "Not specified"}`,
            `Profile URL: ${person.profileUrl}`,
            `Practice areas: ${person.practiceAreas.join(", ") || "Not specified"}`,
            `Profile introduction: ${truncateWords(person.intro, 180) || "Not supplied"}`,
          ].join("\n"),
        )
        .join("\n\n")
    : "Selected Firm lawyer: Not selected.";

  return [
    "You are drafting a practitioner-facing legal alert for the knowledge team.",
    "The style must be practical, commercially aware, legally precise, and restrained. Do not write marketing copy.",
    `Use only the ${sourceLabel} source text and metadata supplied below for facts, names, dates, procedural steps, allegations, orders, and legal references.`,
    "If a requested promotional angle is unsupported by the source, keep the article legal and add a brief drafting note.",
    "If Firm contacts are selected, include a restrained Team section linking each selected person's name to the supplied profile URL and tying only their supplied practice profile to the topic.",
    "Apply these output headings exactly where supported: Background, The Development, Key Takeaways, Strategic Question, Team, Drafting Notes.",
    "After the standfirst, include a single line: Keywords: keyword 1; keyword 2; keyword 3; keyword 4; keyword 5.",
    "Default output length: about 900 words. Article type: client alert.",
    "",
    "Anonymization requirements:",
    input.anonymize || "None.",
    "",
    "Additional user requirements:",
    input.requirements || "None.",
    "",
    "Firm lawyer profile package:",
    personBlock,
    "",
    `${sourceLabel} metadata:`,
    JSON.stringify(
      {
        newsRefNo: input.news.newsRefNo,
        title: input.news.title,
        issueDate: input.news.issueDate,
        sourceUrl: input.news.sourceUrl,
        targetNames: targets,
      },
      null,
      2,
    ),
    "",
    `${sourceLabel} source text:`,
    truncateWords(sourceText, 2800),
    "",
    "Return Markdown only using this shape:",
    "# {{Editorial Title}}",
    "",
    "{{Short standfirst}}",
    "",
    "Keywords: {{five concise legal/regulatory keywords}}",
    "",
    "## Background",
    "## The Development",
    "## Key Takeaways",
    "## Strategic Question",
    "## Team",
    "## Drafting Notes",
  ].join("\n");
}

export function buildConsolidatedArticlePrompt(input: {
  newsItems: StoredNews[];
  people: FirmPerson[];
  anonymize: string;
  requirements: string;
  promptDirections: Record<string, string[]>;
}): string {
  const isHkex = input.newsItems.every((news) => news.source === "hkex");
  const sourceLabel = isHkex ? "HKEx regulatory announcement" : "SFC enforcement update";
  const governingPrompt = isHkex
    ? readFileSync(ARTICLE_PROMPT_PATH, "utf8")
        .replace(/SFC enforcement news/g, "HKEx regulatory announcements")
        .replace(/SFC enforcement update/g, "HKEx regulatory update")
        .replace(/SFC updates/g, "HKEx updates")
        .replace(/SFC source text/g, "HKEx source text")
        .replace(/SFC/g, "HKEx")
    : readFileSync(ARTICLE_PROMPT_PATH, "utf8");
  const peopleBlock = input.people.length
    ? input.people
        .map((person, index) =>
          [
            `Selected Firm contact ${index + 1}: ${person.name}`,
            `Title: ${person.title || "Not specified"}`,
            `Profile URL: ${person.profileUrl}`,
            `Practice areas: ${person.practiceAreas.join(", ") || "Not specified"}`,
            `Profile introduction: ${truncateWords(person.intro, 180) || "Not supplied"}`,
          ].join("\n"),
        )
        .join("\n\n")
    : "No Firm contact selected.";
  const newsBlock = input.newsItems
    .map((news, index) => {
      const sourceText = stripHtml(news.contentHtml ?? "");
      return [
        `${sourceLabel} ${index + 1}:`,
        JSON.stringify(
          {
            newsRefNo: news.newsRefNo,
            title: news.title,
            issueDate: news.issueDate,
            sourceUrl: news.sourceUrl,
            targetNames: news.targetCeList.map((item) => item.ceName),
            keywords: news.keywords,
            selectedPromptDirections: input.promptDirections[news.newsRefNo] ?? [],
          },
          null,
          2,
        ),
        `${sourceLabel} source text:`,
        truncateWords(sourceText, 1800),
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return [
    governingPrompt,
    "",
    "## User-Supplied Inputs",
    "",
    "Anonymization requirements:",
    input.anonymize || "None.",
    "",
    "Additional requirements:",
    input.requirements || "None.",
    "",
    "Selected Firm contacts:",
    peopleBlock,
    "",
    `Selected ${isHkex ? "HKEx" : "SFC"} updates:`,
    newsBlock,
    "",
    `Final instruction: generate one consolidated article covering all selected ${isHkex ? "HKEx" : "SFC"} updates. Do not generate separate standalone articles.`,
  ].join("\n");
}

export function fallbackSummary(title: string, html: string): string {
  const text = stripHtml(html);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let source = "";
  for (const sentence of sentences) {
    const next = [source, sentence].filter(Boolean).join(" ");
    if (next.split(/\s+/).length > 100) break;
    source = next;
    if (source.split(/\s+/).length >= 50) break;
  }
  if (!source || source.split(/\s+/).length < 50) {
    source = [title.trim(), source, ...sentences.slice(0, 2)].filter(Boolean).join(". ");
  }
  return limitWords(source, 50, 100);
}

export function fallbackHkexSummary(title: string, html: string): string {
  const text = stripHtml(html)
    .replace(/[\u3400-\u9fff]+/g, " ")
    .replace(/THE STOCK EXCHANGE OF HONG KONG LIMITED\s*\(A wholly-owned subsidiary of Hong Kong Exchanges and Clearing Limited\)/gi, " ")
    .replace(/HONG KONG EXCHANGES AND CLEARING LIMITED/gi, " ")
    .replace(/\bANNOUNCEMENT\b/gi, " ")
    .replace(/\bThe Stock Exchange of Hong Kong Limited\b/gi, "The Exchange")
    .replace(/\(\s*\)/g, " ")
    .replace(/The Exchange\s*\(\s*the\s+Exchange\s*\)/gi, "The Exchange")
    .replace(/\s+/g, " ")
    .trim();
  const operative = /\b(?:The\s+Exchange|Exchange)\s+(?:announces|announced|imposes|publishes|has\s+requested|censures|criticises)\b/i.exec(text);
  return fallbackSummary(title, operative ? text.slice(operative.index) : text);
}

export function fallbackKeywords(title: string, html: string): string[] {
  const text = `${title} ${stripHtml(html)}`.toLowerCase();
  const candidates: Array<[RegExp, string]> = [
    [/insider dealing|inside information/, "Insider dealing"],
    [/market manipulation|false trading|manipulat/, "Market misconduct"],
    [/disqualif/, "Director disqualification"],
    [/buy-out|compensation|shareholder/, "Shareholder remedies"],
    [/licensed corporation|responsible officer|type \d|regulated activit/, "Licensed corporations"],
    [/asset freeze|restriction notice|freeze assets/, "Asset preservation"],
    [/fine|reprimand|sanction|ban/, "Disciplinary sanctions"],
    [/section 214|sfo|securities and futures ordinance/, "SFO enforcement"],
    [/anti-money laundering|aml/, "AML compliance"],
    [/court|prosecution|jail|sentence|convict/, "Court proceedings"],
  ];
  const keywords = candidates.filter(([pattern]) => pattern.test(text)).map(([, keyword]) => keyword);
  return Array.from(
    new Set([...keywords, "SFC enforcement", "Regulatory action", "Hong Kong securities", "Compliance risk", "Enforcement outcome"]),
  ).slice(0, 5);
}

export function fallbackHkexKeywords(title: string, html: string): string[] {
  const text = `${title} ${stripHtml(html)}`.toLowerCase();
  const candidates: Array<[RegExp, string]> = [
    [/disciplinary action|disciplin/, "Listing disciplinary action"],
    [/director|company secretary|senior management/, "Director accountability"],
    [/cancellation of listing|delist|resume trading|resumption/, "Listing cancellation"],
    [/listing committee|listing review committee/, "Listing Committee review"],
    [/rule 6\.01a|listing rules|rule/, "Listing Rules compliance"],
    [/consultation paper|listing competitiveness/, "Listing consultation"],
    [/report/, "Listing governance"],
  ];
  const keywords = candidates.filter(([pattern]) => pattern.test(text)).map(([, keyword]) => keyword);
  return Array.from(new Set([...keywords, "HKEx regulation", "Listed issuers", "Hong Kong listing", "Compliance risk", "Regulatory announcement"])).slice(0, 5);
}
