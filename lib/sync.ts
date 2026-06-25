import {
  attachNewsContent,
  getStoredNews,
  listStoredNews,
  markSeen,
  upsertExternalNewsItem,
  upsertNewsItem,
  upsertPeople,
} from "@/lib/db";
import { fetchHkexAnnouncementContent, fetchHkexAnnouncementContentByUrl, fetchHkexRegulatoryAnnouncements } from "@/lib/hkex";
import { generateText, hasLlmConfig } from "@/lib/openai";
import { firmPeople } from "@/lib/people";
import { buildHkexSummaryPrompt, buildSummaryPrompt, fallbackHkexKeywords, fallbackHkexSummary, fallbackKeywords, fallbackSummary } from "@/lib/prompts";
import { fetchSfcEnforcementNews, fetchSfcNewsContent } from "@/lib/sfc";
import type { DigestPayload } from "@/lib/types";

export async function syncPeople(): Promise<void> {
  upsertPeople(firmPeople);
}

export async function syncLatestNews(options: { pageSize?: number; summarize?: boolean } = {}): Promise<void> {
  const pageSize = options.pageSize ?? 20;
  const { items } = await fetchSfcEnforcementNews(0, pageSize);
  for (const item of items) {
    upsertNewsItem(item);
  }

  if (options.summarize === false) return;

  for (const item of items) {
    const stored = getStoredNews(item.newsRefNo);
    if (stored?.summary && stored.contentHtml && stored.keywords.length === 5 && isCurrentSummary(stored.summary)) continue;
    const content = await fetchSfcNewsContent(item.newsRefNo);
    const metadata = await summarizeNews(content.title, content.html);
    attachNewsContent(content, metadata.summary, metadata.keywords);
  }
}

export async function syncLatestHkexNews(options: { pageSize?: number; summarize?: boolean } = {}): Promise<void> {
  const pageSize = options.pageSize ?? 20;
  const items = await fetchHkexRegulatoryAnnouncements(pageSize);
  for (const item of items) {
    upsertExternalNewsItem({
      newsRefNo: item.newsRefNo,
      source: "hkex",
      lang: item.lang,
      title: item.title,
      newsType: item.newsType,
      issueDate: item.issueDate,
      modificationTime: item.modificationTime,
      targetCeList: item.targetCeList,
      sourceUrl: item.sourceUrl,
    });
  }

  if (options.summarize === false) return;

  for (const item of items) {
    const stored = getStoredNews(item.newsRefNo);
    if (stored?.summary && stored.contentHtml && stored.keywords.length === 5 && isCurrentHkexSummary(stored.summary)) continue;
    const content = await fetchHkexAnnouncementContent(item);
    const metadata = await summarizeHkexNews(content.title, content.html);
    attachNewsContent(content, metadata.summary, metadata.keywords);
  }
}

export async function ensureNewsContent(refNo: string): Promise<void> {
  const stored = getStoredNews(refNo);
  if (stored?.contentHtml) return;
  if (process.env.ENABLE_LIVE_NEWS_SYNC !== "true") {
    throw new Error(`Stored full source article is unavailable for ${refNo}.`);
  }
  if (stored?.source === "hkex") {
    const content = await fetchHkexAnnouncementContentByUrl(stored.sourceUrl);
    const metadata = stored.summary
      ? { summary: stored.summary, keywords: stored.keywords.length === 5 ? stored.keywords : fallbackHkexKeywords(content.title, content.html) }
      : await summarizeHkexNews(content.title, content.html);
    attachNewsContent(content, metadata.summary, metadata.keywords);
    return;
  }
  const content = await fetchSfcNewsContent(refNo);
  const metadata = stored?.summary
    ? { summary: stored.summary, keywords: stored.keywords.length === 5 ? stored.keywords : fallbackKeywords(content.title, content.html) }
    : await summarizeNews(content.title, content.html);
  attachNewsContent(content, metadata.summary, metadata.keywords);
}

export async function summarizeNews(title: string, html: string): Promise<{ summary: string; keywords: string[] }> {
  if (!hasLlmConfig()) {
    return { summary: fallbackSummary(title, html), keywords: fallbackKeywords(title, html) };
  }
  try {
    const text = await generateText(buildSummaryPrompt(title, html), { maxOutputTokens: 260 });
    const parsed = JSON.parse(text.replace(/^```json|```$/g, "").trim()) as { summary?: string; keywords?: string[] };
    const summary = (parsed.summary ?? fallbackSummary(title, html)).replace(/\s*\.\.\.$/, "").trim();
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.map((item) => item.trim()).filter(Boolean).slice(0, 5) : [];
    return { summary, keywords: keywords.length === 5 ? keywords : fallbackKeywords(title, html) };
  } catch {
    return { summary: fallbackSummary(title, html), keywords: fallbackKeywords(title, html) };
  }
}

export async function summarizeHkexNews(title: string, html: string): Promise<{ summary: string; keywords: string[] }> {
  if (!hasLlmConfig()) {
    return { summary: limitSummaryWords(fallbackHkexSummary(title, html)), keywords: fallbackHkexKeywords(title, html) };
  }
  try {
    const text = await generateText(buildHkexSummaryPrompt(title, html), { maxOutputTokens: 220 });
    const parsed = JSON.parse(text.replace(/^```json|```$/g, "").trim()) as { summary?: string; keywords?: string[] };
    const summary = (parsed.summary ?? fallbackHkexSummary(title, html)).replace(/\s*\.\.\.$/, "").trim();
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.map((item) => item.trim()).filter(Boolean).slice(0, 5) : [];
    return { summary: limitSummaryWords(summary), keywords: keywords.length === 5 ? keywords : fallbackHkexKeywords(title, html) };
  } catch {
    return { summary: limitSummaryWords(fallbackHkexSummary(title, html)), keywords: fallbackHkexKeywords(title, html) };
  }
}

function isCurrentSummary(summary: string): boolean {
  const words = summary.trim().split(/\s+/).filter(Boolean);
  return words.length >= 50 && words.length <= 100 && !summary.includes("...") && /[.!?)]$/.test(summary.trim());
}

function isCurrentHkexSummary(summary: string): boolean {
  const words = summary.trim().split(/\s+/).filter(Boolean);
  return words.length >= 45 && words.length <= 50 && !summary.includes("...") && !/[\u3400-\u9fff]/.test(summary) && /[.!?)]$/.test(summary.trim());
}

function limitSummaryWords(summary: string): string {
  const words = summary.trim().split(/\s+/).filter(Boolean);
  const value = words.length <= 50 ? words.join(" ") : words.slice(0, 50).join(" ").replace(/[,\s]+$/, "");
  return /[.!?)]$/.test(value) ? value : `${value}.`;
}

export async function prepareEmailDigest(): Promise<DigestPayload> {
  await syncLatestNews({ pageSize: 20, summarize: true });
  const items = listStoredNews(20)
    .filter((item) => !item.sent)
    .map((item) => {
      markSeen(item.newsRefNo);
      return {
        newsRefNo: item.newsRefNo,
        title: item.title,
        issueDate: item.issueDate,
        summary: item.summary ?? "",
        keywords: item.keywords,
        sourceUrl: item.sourceUrl,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    subject: `Regulatory enforcement digest: ${items.length} item${items.length === 1 ? "" : "s"}`,
    items,
  };
}

export function previewEmailDigest(): DigestPayload {
  const items = listStoredNews(20).map((item) => ({
    newsRefNo: item.newsRefNo,
    title: item.title,
    issueDate: item.issueDate,
    summary: item.summary ?? "",
    keywords: item.keywords,
    sourceUrl: item.sourceUrl,
  }));

  return {
    generatedAt: new Date().toISOString(),
    subject: `Regulatory enforcement digest: ${items.length} item${items.length === 1 ? "" : "s"}`,
    items,
  };
}
