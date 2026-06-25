import { getPerson, getStoredNews, saveArticleDraft } from "@/lib/db";
import { generateText } from "@/lib/openai";
import { buildArticlePrompt, buildConsolidatedArticlePrompt } from "@/lib/prompts";
import { ensureNewsContent } from "@/lib/sync";
import type { ArticleDraft, FirmPerson, GenerateArticleInput } from "@/lib/types";

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
  const markdown = await generateText(prompt, { maxOutputTokens: 2800 });

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
  const markdown = await generateText(prompt, { maxOutputTokens: 4200 });

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

function normalizeArticleContact(person: FirmPerson): FirmPerson {
  const traineeUrl = TRAINEE_PROFILE_URLS[person.name.trim().toLowerCase()];
  return {
    ...person,
    profileUrl: traineeUrl ?? DEFAULT_CONTACT_PROFILE_URL,
  };
}
