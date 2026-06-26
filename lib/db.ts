import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { ArticleDraft, FirmPerson, SfcNewsContent, SfcNewsListItem, StoredNews } from "@/lib/types";
import { sourceUrl } from "@/lib/text";

const { DatabaseSync } = (
  process as typeof process & { getBuiltinModule(name: "node:sqlite"): typeof import("node:sqlite") }
).getBuiltinModule("node:sqlite");

let db: DatabaseSyncType | null = null;

export function getDb(): DatabaseSyncType {
  if (db) return db;
  const dbPath = resolveDatabasePath();
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS news (
      newsRefNo TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'sfc',
      lang TEXT NOT NULL,
      title TEXT NOT NULL,
      newsExtLink TEXT,
      newsType TEXT NOT NULL,
      issueDate TEXT NOT NULL,
      modificationTime TEXT,
      targetCeList TEXT NOT NULL,
      sourceUrl TEXT NOT NULL,
      summary TEXT,
      keywords TEXT NOT NULL DEFAULT '[]',
      contentHtml TEXT,
      seen INTEGER NOT NULL DEFAULT 0,
      sent INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      profileUrl TEXT NOT NULL,
      title TEXT NOT NULL,
      practiceAreas TEXT NOT NULL,
      intro TEXT NOT NULL,
      imageUrl TEXT,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS article_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      newsRefNo TEXT NOT NULL,
      personId INTEGER,
      personName TEXT,
      personProfileUrl TEXT,
      anonymize TEXT NOT NULL,
      requirements TEXT NOT NULL,
      markdown TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(newsRefNo) REFERENCES news(newsRefNo)
    );
  `);
  ensureColumn("news", "source", "TEXT NOT NULL DEFAULT 'sfc'");
  ensureColumn("news", "keywords", "TEXT NOT NULL DEFAULT '[]'");
  return db;
}

export function closeDb(): void {
  if (!db) return;
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  db.close();
  db = null;
}

function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH);
  }

  const seedPath = join(process.cwd(), "data", "knowledge-alerts.sqlite");
  if (!process.env.VERCEL) {
    return seedPath;
  }

  const deployId = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "runtime").replace(/[^a-zA-Z0-9_-]/g, "");
  const runtimePath = `/tmp/knowledge-alerts-${deployId}.sqlite`;
  if (!existsSync(runtimePath) && existsSync(seedPath)) {
    copyFileSync(seedPath, runtimePath);
  }
  return runtimePath;
}

function ensureColumn(table: string, column: string, definition: string): void {
  const columns = getDb().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    getDb().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function upsertNewsItem(item: SfcNewsListItem): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(`
      INSERT INTO news (
        newsRefNo, source, lang, title, newsExtLink, newsType, issueDate, modificationTime,
        targetCeList, sourceUrl, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(newsRefNo) DO UPDATE SET
        source = excluded.source,
        title = excluded.title,
        newsExtLink = excluded.newsExtLink,
        issueDate = excluded.issueDate,
        modificationTime = excluded.modificationTime,
        targetCeList = excluded.targetCeList,
        sourceUrl = excluded.sourceUrl,
        updatedAt = excluded.updatedAt
    `)
    .run(
      item.newsRefNo,
      "sfc",
      item.lang,
      item.title.trim(),
      item.newsExtLink,
      item.newsType,
      item.issueDate,
      item.modificationTime,
      JSON.stringify(item.targetCeList ?? []),
      sourceUrl(item.newsRefNo),
      now,
      now,
    );
}

export function upsertExternalNewsItem(input: {
  newsRefNo: string;
  source: "hkex";
  lang: string;
  title: string;
  newsType: string;
  issueDate: string;
  modificationTime?: string | null;
  targetCeList?: Array<{ ceName: string; lang: string; masked: boolean }>;
  sourceUrl: string;
}): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(`
      INSERT INTO news (
        newsRefNo, source, lang, title, newsExtLink, newsType, issueDate, modificationTime,
        targetCeList, sourceUrl, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(newsRefNo) DO UPDATE SET
        source = excluded.source,
        title = excluded.title,
        newsType = excluded.newsType,
        issueDate = excluded.issueDate,
        modificationTime = excluded.modificationTime,
        targetCeList = excluded.targetCeList,
        sourceUrl = excluded.sourceUrl,
        updatedAt = excluded.updatedAt
    `)
    .run(
      input.newsRefNo,
      input.source,
      input.lang,
      input.title.trim(),
      null,
      input.newsType,
      input.issueDate,
      input.modificationTime ?? null,
      JSON.stringify(input.targetCeList ?? []),
      input.sourceUrl,
      now,
      now,
    );
}

export function attachNewsContent(content: SfcNewsContent, summary?: string, keywords?: string[]): void {
  getDb()
    .prepare("UPDATE news SET contentHtml = ?, summary = COALESCE(?, summary), keywords = COALESCE(?, keywords), updatedAt = ? WHERE newsRefNo = ?")
    .run(content.html, summary ?? null, keywords ? JSON.stringify(keywords) : null, new Date().toISOString(), content.newsRefNo);
}

export function setNewsSummary(refNo: string, summary: string, keywords: string[]): void {
  getDb()
    .prepare("UPDATE news SET summary = ?, keywords = ?, updatedAt = ? WHERE newsRefNo = ?")
    .run(summary, JSON.stringify(keywords), new Date().toISOString(), refNo);
}

export function listStoredNews(limit = 30, source: "sfc" | "hkex" = "sfc"): StoredNews[] {
  return getDb()
    .prepare("SELECT * FROM news WHERE source = ? ORDER BY datetime(issueDate) DESC LIMIT ?")
    .all(source, limit)
    .map(rowToNews);
}

export function getStoredNews(refNo: string): StoredNews | null {
  const row = getDb().prepare("SELECT * FROM news WHERE newsRefNo = ?").get(refNo);
  return row ? rowToNews(row) : null;
}

export function markSeen(refNo: string): void {
  getDb().prepare("UPDATE news SET seen = 1, updatedAt = ? WHERE newsRefNo = ?").run(new Date().toISOString(), refNo);
}

export function upsertPeople(people: FirmPerson[]): void {
  const statement = getDb().prepare(`
    INSERT INTO people (id, name, profileUrl, title, practiceAreas, intro, imageUrl, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      profileUrl = excluded.profileUrl,
      title = excluded.title,
      practiceAreas = excluded.practiceAreas,
      intro = excluded.intro,
      imageUrl = excluded.imageUrl,
      updatedAt = excluded.updatedAt
  `);
  const now = new Date().toISOString();
  for (const person of people) {
    statement.run(
      person.id,
      person.name,
      person.profileUrl,
      person.title,
      JSON.stringify(person.practiceAreas),
      person.intro,
      person.imageUrl,
      now,
    );
  }
}

export function listPeople(): FirmPerson[] {
  return getDb()
    .prepare(
      "SELECT * FROM people ORDER BY CASE WHEN lower(title) LIKE '%partner%' THEN 0 ELSE 1 END, name ASC",
    )
    .all()
    .map(rowToPerson);
}

export function getPerson(id: number): FirmPerson | null {
  const row = getDb().prepare("SELECT * FROM people WHERE id = ?").get(id);
  return row ? rowToPerson(row) : null;
}

export function saveArticleDraft(input: {
  newsRefNo: string;
  person: FirmPerson | null;
  anonymize: string;
  requirements: string;
  markdown: string;
}): ArticleDraft {
  const createdAt = new Date().toISOString();
  const result = getDb()
    .prepare(`
      INSERT INTO article_drafts (
        newsRefNo, personId, personName, personProfileUrl, anonymize, requirements, markdown, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.newsRefNo,
      input.person?.id ?? null,
      input.person?.name ?? null,
      input.person?.profileUrl ?? null,
      input.anonymize,
      input.requirements,
      input.markdown,
      createdAt,
    );

  return {
    id: Number(result.lastInsertRowid),
    newsRefNo: input.newsRefNo,
    personId: input.person?.id ?? null,
    personName: input.person?.name ?? null,
    personProfileUrl: input.person?.profileUrl ?? null,
    anonymize: input.anonymize,
    requirements: input.requirements,
    markdown: input.markdown,
    createdAt,
  };
}

export function listDrafts(refNo: string): ArticleDraft[] {
  return getDb()
    .prepare("SELECT * FROM article_drafts WHERE newsRefNo = ? ORDER BY datetime(createdAt) DESC")
    .all(refNo)
    .map(rowToDraft);
}

function rowToNews(row: unknown): StoredNews {
  const item = row as Record<string, unknown>;
  return {
    newsRefNo: String(item.newsRefNo),
    source: item.source === "hkex" ? "hkex" : "sfc",
    lang: String(item.lang),
    title: String(item.title),
    newsExtLink: item.newsExtLink ? String(item.newsExtLink) : null,
    newsType: String(item.newsType),
    issueDate: String(item.issueDate),
    modificationTime: item.modificationTime ? String(item.modificationTime) : null,
    targetCeList: JSON.parse(String(item.targetCeList)),
    sourceUrl: String(item.sourceUrl),
    summary: item.summary ? String(item.summary) : null,
    keywords: item.keywords ? JSON.parse(String(item.keywords)) : [],
    contentHtml: item.contentHtml ? String(item.contentHtml) : null,
    seen: Boolean(item.seen),
    sent: Boolean(item.sent),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  };
}

function rowToPerson(row: unknown): FirmPerson {
  const item = row as Record<string, unknown>;
  return {
    id: Number(item.id),
    name: String(item.name),
    profileUrl: String(item.profileUrl),
    title: String(item.title),
    practiceAreas: JSON.parse(String(item.practiceAreas)),
    intro: String(item.intro),
    imageUrl: item.imageUrl ? String(item.imageUrl) : null,
  };
}

function rowToDraft(row: unknown): ArticleDraft {
  const item = row as Record<string, unknown>;
  return {
    id: Number(item.id),
    newsRefNo: String(item.newsRefNo),
    personId: item.personId ? Number(item.personId) : null,
    personName: item.personName ? String(item.personName) : null,
    personProfileUrl: item.personProfileUrl ? String(item.personProfileUrl) : null,
    anonymize: String(item.anonymize),
    requirements: String(item.requirements),
    markdown: String(item.markdown),
    createdAt: String(item.createdAt),
  };
}
