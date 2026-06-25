import { getPerson, getStoredNews, saveArticleDraft } from "@/lib/db";
import { generateText } from "@/lib/openai";
import { buildArticlePrompt, buildConsolidatedArticlePrompt } from "@/lib/prompts";
import { ensureNewsContent } from "@/lib/sync";
import { stripHtml, truncateWords } from "@/lib/text";
import type { ArticleDraft, FirmPerson, GenerateArticleInput, StoredNews } from "@/lib/types";

export async function generateArticleDraft(input: GenerateArticleInput): Promise<ArticleDraft> {
  await ensureNewsContent(input.newsRefNo);
  const news = getStoredNews(input.newsRefNo);
  if (!news?.contentHtml) {
    throw new Error(`News content is unavailable for ${input.newsRefNo}.`);
  }

  const personIds = input.personIds?.length ? input.personIds : input.personId ? [input.personId] : [];
  const people = personIds.map((id) => getPerson(id)).filter((person): person is NonNullable<ReturnType<typeof getPerson>> => Boolean(person));
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
    .filter((person): person is NonNullable<ReturnType<typeof getPerson>> => Boolean(person));
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
  const title = newsItems.length === 1 ? displayMarkdownTitle(newsItems[0].title) : "Regulatory Enforcement Update";
  const keywords = Array.from(new Set(newsItems.flatMap((item) => item.keywords))).slice(0, 5);
  const sections = newsItems
    .map((item) => {
      const sourceText = truncateWords(stripHtml(item.contentHtml ?? ""), 650);
      return [
        `## [${displayMarkdownTitle(item.title)}](${item.sourceUrl})`,
        "",
        sourceText || "Source article text is unavailable.",
      ].join("\n");
    })
    .join("\n\n");
  const team = people.length
    ? people.map((person) => `- [${person.name}](${person.profileUrl}), ${person.title}`).join("\n")
    : "- No contact selected.";

  return [
    `# ${title}`,
    "",
    "This draft is generated from the stored full source article text because live AI generation was unavailable.",
    "",
    `Keywords: ${keywords.length ? keywords.join("; ") : "Regulatory update"}`,
    "",
    "## Background",
    "",
    sections,
    "",
    "## Key Takeaways",
    "",
    "- Review the source facts and procedural posture before circulation.",
    "- Tailor the legal analysis to the intended client audience and transaction context.",
    requirements ? `- User requirements noted: ${requirements}` : "- Add any client-specific requirements before sending.",
    "",
    "## Team",
    "",
    team,
    "",
    "## Drafting Notes",
    "",
    "This fallback draft is intentionally conservative and should be reviewed before external use.",
  ].join("\n");
}

function displayMarkdownTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}
