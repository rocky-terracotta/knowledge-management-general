import { getPerson, getStoredNews, saveArticleDraft } from "@/lib/db";
import { generateText } from "@/lib/openai";
import { buildArticlePrompt, buildConsolidatedArticlePrompt } from "@/lib/prompts";
import { ensureNewsContent } from "@/lib/sync";
import { limitWords, stripHtml } from "@/lib/text";
import type { ArticleDraft, FirmPerson, GenerateArticleInput, StoredNews } from "@/lib/types";

const DEFAULT_CONTACT_PROFILE_URL = "https://casebyte.ai?utm_source=LZ&utm_medium=linkedin&utm_campaign=kms";
const TRAINEE_PROFILE_URLS: Record<string, string> = {
  "leona zhang": "https://www.linkedin.com/in/leona-zhang/",
  "rocky li": "https://www.linkedin.com/in/itsrocky/",
};

export async function generateArticleDraft(input: GenerateArticleInput): Promise<ArticleDraft> {
  await ensureNewsContent(input.newsRefNo);
  const news = getStoredNews(input.newsRefNo);
  if (!news?.contentHtml) {
    throw new Error(`News content is unavailable for ${input.newsRefNo}.`);
  }

  const personIds = input.personIds?.length ? input.personIds : input.personId ? [input.personId] : [];
  const people = personIds
    .map((id) => getPerson(id))
    .filter((person): person is NonNullable<ReturnType<typeof getPerson>> => Boolean(person))
    .map(normalizeArticleContact);
  const person = people[0] ?? null;
  const prompt = buildArticlePrompt({
    news,
    people,
    anonymize: input.anonymize,
    requirements: input.requirements,
  });
  const markdown = await generateWithFallback(prompt, () => fallbackArticleMarkdown([news], people, input.requirements), 2800);

  return saveArticleDraft({
    newsRefNo: input.newsRefNo,
    person: people.length
      ? {
          ...people[0],
          name: people.map((item) => item.name).join(", "),
          profileUrl: people[0].profileUrl,
        }
      : person,
    anonymize: input.anonymize,
    requirements: input.requirements,
    markdown,
  });
}

export async function generateConsolidatedArticleDraft(input: {
  newsRefNos: string[];
  personIds: number[];
  anonymize: string;
  requirements: string;
  promptDirections: Record<string, string[]>;
}): Promise<ArticleDraft> {
  const refs = Array.from(new Set(input.newsRefNos)).slice(0, 5);
  if (!refs.length) {
    throw new Error("Select at least one SFC update.");
  }

  await Promise.all(refs.map((refNo) => ensureNewsContent(refNo)));
  const newsItems = refs.map((refNo) => getStoredNews(refNo)).filter((news): news is NonNullable<ReturnType<typeof getStoredNews>> => Boolean(news?.contentHtml));
  if (newsItems.length !== refs.length) {
    throw new Error("One or more selected SFC updates are unavailable.");
  }

  const people = Array.from(new Set(input.personIds))
    .map((id) => getPerson(id))
    .filter((person): person is NonNullable<ReturnType<typeof getPerson>> => Boolean(person))
    .map(normalizeArticleContact);
  const prompt = buildConsolidatedArticlePrompt({
    newsItems,
    people,
    anonymize: input.anonymize,
    requirements: input.requirements,
    promptDirections: input.promptDirections,
  });
  const markdown = await generateWithFallback(prompt, () => fallbackArticleMarkdown(newsItems, people, input.requirements), 4200);

  return saveArticleDraft({
    newsRefNo: refs[0],
    person: people.length
      ? {
          ...people[0],
          name: people.map((item) => item.name).join(", "),
          profileUrl: people[0].profileUrl,
        }
      : null,
    anonymize: input.anonymize,
    requirements: input.requirements,
    markdown,
  });
}

async function generateWithFallback(prompt: string, fallback: () => string, maxOutputTokens: number): Promise<string> {
  try {
    return await generateText(prompt, { maxOutputTokens });
  } catch (error) {
    console.error("LLM generation failed; using full-source fallback draft.", error);
    return fallback();
  }
}

function fallbackArticleMarkdown(newsItems: StoredNews[], people: FirmPerson[], requirements: string): string {
  const title = newsItems.length === 1 ? displayMarkdownTitle(newsItems[0].title) : "Regulatory enforcement themes for boards and compliance teams";
  const standfirst =
    newsItems.length === 1
      ? "This update summarises the enforcement development and highlights practical governance, controls, and response points for market participants."
      : "These updates point to continuing regulatory attention on governance, controls, disclosure discipline, and timely remediation by market participants.";
  const background =
    "The developments should be read as source-limited regulatory news rather than findings beyond the published material. Boards, senior management, responsible officers, and compliance teams should consider whether their control framework, escalation process, and records would support a clear response if similar issues arose.";
  const sections = newsItems
    .map((item) => {
      const sourceText = articleSectionSummary(item);
      return [
        `## [${displayMarkdownTitle(item.title)}](${item.sourceUrl})`,
        "",
        sourceText || "Source article text is unavailable.",
      ].join("\n");
    })
    .join("\n\n");
  const team = people.length
    ? people.map((person) => `[${person.name}](${person.profileUrl})`).join(", ")
    : "the knowledge team";

  return [
    `# ${title}`,
    "",
    standfirst,
    "",
    background,
    "",
    sections,
    "",
    "## What this suggests",
    "",
    "The update reinforces the need to treat regulatory news as an operational signal, not only a legal development. Firms should connect the facts reported in the source materials with governance routines, board reporting, supervision, record keeping, and remediation planning. Where multiple updates are selected, the common theme is that regulators continue to expect disciplined controls and a documented response to emerging issues.",
    "",
    "## Takeaways",
    "",
    "1. ***Review governance records early.*** Boards and senior management should be able to show how issues were escalated, considered, and followed through.",
    "2. ***Test controls against real scenarios.*** Compliance procedures should be checked against the types of failures, allegations, or sanctions described in the source update.",
    requirements
      ? `3. ***Reflect the requested angle.*** The draft should be reviewed against this user requirement before circulation: ${requirements}`
      : "3. ***Plan remediation before pressure builds.*** A clear remediation plan, with owners and evidence, is often as important as the initial legal analysis.",
    "",
    "## Contact",
    "",
    `For questions about the issues discussed in this update, please contact ${team}.`,
  ].join("\n");
}

function displayMarkdownTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

function articleSectionSummary(item: StoredNews): string {
  const text = stripHtml(item.contentHtml ?? "");
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let summary = "";
  for (const sentence of sentences) {
    const next = [summary, sentence].filter(Boolean).join(" ");
    if (next.split(/\s+/).length > 100) break;
    summary = next;
    if (summary.split(/\s+/).length >= 80) break;
  }
  if (!summary || summary.split(/\s+/).length < 80) {
    summary = [item.title, text].filter(Boolean).join(". ");
  }
  const limited = limitWords(summary, 80, 100);
  return /[.!?)]$/.test(limited) ? limited : `${limited}.`;
}

function normalizeArticleContact(person: FirmPerson): FirmPerson {
  const traineeUrl = TRAINEE_PROFILE_URLS[person.name.trim().toLowerCase()];
  return {
    ...person,
    profileUrl: traineeUrl ?? DEFAULT_CONTACT_PROFILE_URL,
  };
}
