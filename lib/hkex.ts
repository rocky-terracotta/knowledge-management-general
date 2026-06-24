import type { SfcNewsContent, SfcNewsListItem } from "@/lib/types";
import { decodeHtml } from "@/lib/text";

const HKEX_BASE = "https://www.hkex.com.hk";
const HKEX_LIST_URL = `${HKEX_BASE}/News/Regulatory-Announcements?sc_lang=en&DateFrom=2026-01-01&DateTo=2026-12-31&Category=undefined&Category2=undefined`;

export type HkexAnnouncement = SfcNewsListItem & {
  sourceUrl: string;
};

export async function fetchHkexRegulatoryAnnouncements(limit = 20): Promise<HkexAnnouncement[]> {
  const response = await fetch(HKEX_LIST_URL, { next: { revalidate: 300 } });
  if (!response.ok) {
    throw new Error(`HKEx announcements failed: ${response.status}`);
  }
  return parseHkexAnnouncements(await response.text()).slice(0, limit);
}

export async function fetchHkexAnnouncementContent(item: HkexAnnouncement): Promise<SfcNewsContent> {
  const response = await fetch(item.sourceUrl, { next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error(`HKEx content failed for ${item.newsRefNo}: ${response.status}`);
  }
  return parseHkexAnnouncementContent(await response.text(), item);
}

export async function fetchHkexAnnouncementContentByUrl(sourceUrl: string): Promise<SfcNewsContent> {
  const refNo = hkexRefFromUrl(sourceUrl);
  const item: HkexAnnouncement = {
    newsRefNo: refNo,
    lang: "EN",
    title: "",
    newsExtLink: null,
    newsType: "HKEX_REGULATORY",
    issueDate: "",
    modificationTime: null,
    targetCeList: [],
    sourceUrl,
  };
  return fetchHkexAnnouncementContent(item);
}

export function parseHkexAnnouncements(html: string): HkexAnnouncement[] {
  const rows = html
    .split('<div class="whats_on_tdy_row">')
    .slice(1)
    .map((row) => row.split('<div class="whats_on_tdy_more_row')[0]);
  const seen = new Set<string>();

  return rows
    .map((row): HkexAnnouncement | null => {
      const day = firstMatch(row, /whats_on_tdy_ball_number">\s*<div>(\d{1,2})<\/div>/);
      const monthYearMatch = /whats_on_tdy_ball_number">[\s\S]*?<\/div>\s*<div>([A-Za-z]{3})\s+(\d{4})<\/div>/.exec(row);
      const linkMatch = /<div class="whats_on_tdy_text_2">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(row);
      if (!day || !monthYearMatch || !linkMatch) return null;

      const sourceUrl = absoluteHkexUrl(decodeHtml(linkMatch[1]));
      const newsRefNo = hkexRefFromUrl(sourceUrl);
      if (seen.has(newsRefNo)) return null;
      seen.add(newsRefNo);

      return {
        newsRefNo,
        lang: "EN",
        title: decodeHtml(linkMatch[2]),
        newsExtLink: null,
        newsType: "HKEX_REGULATORY",
        issueDate: toIsoDate(Number(monthYearMatch[2]), monthYearMatch[1], Number(day)),
        modificationTime: null,
        targetCeList: [],
        sourceUrl,
      };
    })
    .filter((item): item is HkexAnnouncement => Boolean(item));
}

export function parseHkexAnnouncementContent(html: string, fallback: HkexAnnouncement): SfcNewsContent {
  const title = decodeHtml(firstMatch(html, /<h1>\s*([\s\S]*?)\s*<\/h1>/) || firstMatch(html, /<meta property="og:title" content="([^"]+)"/) || fallback.title);
  const dateText = decodeHtml(firstMatch(html, /<div class="news-timetag-container"[^>]*>\s*([\s\S]*?)\s*<\/div>/) || "");
  const bodyHtml = firstMatch(html, /<div class="listing-committee__brief">([\s\S]*?)<div class="container loadMore__timetag-container"/) || "";

  return {
    newsRefNo: fallback.newsRefNo,
    lang: "EN",
    title: title || fallback.title,
    html: bodyHtml,
    issueDate: dateText ? parseHkexDateText(dateText) : fallback.issueDate,
    modificationTime: null,
    imageList: [],
    appendixDocList: [],
    maskedFooterType: null,
  };
}

function absoluteHkexUrl(url: string): string {
  const absolute = url.startsWith("http") ? url : `${HKEX_BASE}${url}`;
  return absolute.replace(/\?.*$/, "?sc_lang=en");
}

function hkexRefFromUrl(sourceUrl: string): string {
  const match = /\/([^/?]+news)\?/.exec(sourceUrl);
  return `hkex-${match?.[1] ?? encodeURIComponent(sourceUrl)}`;
}

function firstMatch(value: string, pattern: RegExp): string {
  return pattern.exec(value)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function toIsoDate(year: number, monthName: string, day: number): string {
  const month = monthIndex(monthName);
  return new Date(Date.UTC(year, month, day, 8, 0, 0)).toISOString();
}

function parseHkexDateText(value: string): string {
  const match = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/.exec(value);
  if (!match) return value;
  return toIsoDate(Number(match[3]), match[2], Number(match[1]));
}

function monthIndex(monthName: string): number {
  const index = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthName.toLowerCase());
  return index >= 0 ? index : 0;
}
