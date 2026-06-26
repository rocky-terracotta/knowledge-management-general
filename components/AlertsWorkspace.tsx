"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { ArticleEditor } from "@/components/ArticleEditor";
import type { ArticleDraft, FirmPerson, StoredNews } from "@/lib/types";
import { formatDate } from "@/lib/text";

type Props = {
  initialNews: StoredNews[];
  people: FirmPerson[];
  syncError: string | null;
  config?: AlertsWorkspaceConfig;
};

type AlertsWorkspaceConfig = {
  title: string;
  subtitle: string;
  sourceName: string;
  sourceUrl: string;
  refreshEndpoint: string;
  articleTitle: string;
  newsNavLimit?: number;
};

type DurableUpdate =
  | { status: "committed"; repository: string; branch: string; commitSha: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

type RefreshPayload = {
  news?: StoredNews[];
  refreshed?: boolean;
  durable?: DurableUpdate;
  error?: string;
};

const defaultConfig: AlertsWorkspaceConfig = {
  title: "SFC Enforcement Daily",
  subtitle: "Daily digest of SFC enforcement news for the knowledge team",
  sourceName: "SFC",
  sourceUrl: "https://apps.sfc.hk/edistributionWeb/gateway/EN/news-and-announcements/news/enforcement-news/",
  refreshEndpoint: "/api/news/sync",
  articleTitle: "Regulatory enforcement update",
  newsNavLimit: 20,
};

export function AlertsWorkspace({ initialNews, people, syncError, config = defaultConfig }: Props) {
  const [news, setNews] = useState(initialNews);
  const [selectedRef, setSelectedRef] = useState(initialNews[0]?.newsRefNo ?? "");
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [selectedPromptIndexes, setSelectedPromptIndexes] = useState<Record<string, number[]>>({});
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string[]>>({});
  const [customPromptDrafts, setCustomPromptDrafts] = useState<Record<string, string>>({});
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>(people[0]?.id ? [people[0].id] : []);
  const [anonymize] = useState("");
  const [requirements, setRequirements] = useState("");
  const [drafts, setDrafts] = useState<ArticleDraft[]>([]);
  const [error, setError] = useState(syncError);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [openOutlineGroups, setOpenOutlineGroups] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedNews = useMemo(() => news.find((item) => item.newsRefNo === selectedRef) ?? news[0] ?? null, [news, selectedRef]);
  const queuedNews = useMemo(() => selectedRefs.map((ref) => news.find((item) => item.newsRefNo === ref)).filter((item): item is StoredNews => Boolean(item)), [news, selectedRefs]);
  const selectedPeople = useMemo(
    () => selectedPersonIds.map((id) => people.find((item) => item.id === id)).filter((item): item is FirmPerson => Boolean(item)),
    [people, selectedPersonIds],
  );
  const latestDate = news[0]?.issueDate ? formatDate(news[0].issueDate) : "No live items";
  const defaultEmailSubject = useMemo(() => buildDefaultEmailSubject(queuedNews), [queuedNews]);
  const newsOutlineGroups = useMemo(() => categorizeNewsForOutline(news.slice(0, config.newsNavLimit ?? 16)), [config.newsNavLimit, news]);

  function refresh() {
    setError(null);
    setRefreshStatus(null);
    startTransition(async () => {
      try {
        const response = await fetch(config.refreshEndpoint, { method: "POST" });
        const payload = (await response.json()) as RefreshPayload;
        if (!response.ok) throw new Error(payload.error ?? "Sync failed.");
        if (payload.news) {
          setNews(payload.news);
          if (payload.news[0]) setSelectedRef(payload.news[0].newsRefNo);
        }
        setRefreshStatus(refreshStatusText(payload));
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : "Sync failed.");
      }
    });
  }

  function toggleQueuedNews(refNo: string) {
    setSelectedRef(refNo);
    setDrafts([]);
    setError(null);
    setSelectedRefs((current) => {
      if (current.includes(refNo)) return current.filter((item) => item !== refNo);
      if (current.length >= 5) {
        setError("Select up to 5 news items for one generation batch.");
        return current;
      }
      return [...current, refNo];
    });
  }

  function togglePrompt(refNo: string, promptIndex: number) {
    setSelectedPromptIndexes((current) => {
      const existing = current[refNo] ?? [];
      const next = existing.includes(promptIndex) ? existing.filter((item) => item !== promptIndex) : [...existing, promptIndex];
      return { ...current, [refNo]: next };
    });
  }

  function updatePromptDraft(refNo: string, promptIndex: number, value: string) {
    setPromptDrafts((current) => {
      const next = [...(current[refNo] ?? [])];
      next[promptIndex] = value;
      return { ...current, [refNo]: next };
    });
  }

  function updateCustomPrompt(refNo: string, value: string) {
    setCustomPromptDrafts((current) => ({ ...current, [refNo]: value }));
  }

  function togglePerson(personId: number) {
    setSelectedPersonIds((current) => (current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]));
  }

  function toggleOutlineGroup(label: string) {
    setOpenOutlineGroups((current) => ({ ...current, [label]: !current[label] }));
  }

  async function generateBatch() {
    if (!queuedNews.length) {
      setError("Add at least one news item to the article list.");
      return;
    }
    setIsGenerating(true);
    setDrafts([]);
    setError(null);
    try {
      const promptDirections = Object.fromEntries(
        queuedNews.map((item) => [
          item.newsRefNo,
          (selectedPromptIndexes[item.newsRefNo] ?? [])
            .map((promptIndex) => promptTextAt(item, promptIndex, promptDrafts, customPromptDrafts))
            .filter(Boolean),
        ]),
      );
      const response = await fetch("/api/generate/consolidated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newsRefNos: queuedNews.map((item) => item.newsRefNo),
          personIds: selectedPersonIds,
          anonymize,
          requirements,
          promptDirections,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Generation failed.");
      setDrafts([payload.draft as ArticleDraft]);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  const buttonClass =
    "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-2.5 py-2 text-sm font-medium whitespace-nowrap shadow-sm transition-colors hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]";

  return (
    <main className="digest-shell min-h-screen">
      <header className="fixed top-0 z-20 w-full border-b border-[color:var(--border)]/80 bg-[color:var(--background)]/85 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-4 px-6 py-[1.02rem]">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[color:var(--foreground)]" aria-label="Knowledge Management home">
              Knowledge Management
            </Link>
            <nav className="flex items-center gap-1 text-xs font-medium text-[color:var(--muted-foreground)]">
              <Link className="rounded-md px-2 py-1.5 hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]" href="/">
                SFC
              </Link>
              <Link className="rounded-md px-2 py-1.5 hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]" href="/hkex">
                HKEx
              </Link>
            </nav>
          </div>
          <nav className="hidden items-center gap-1 text-sm text-[color:var(--muted-foreground)] sm:flex">
            <a className="rounded-md px-3 py-2 hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]" href="https://terracotta.dev" target="_blank" rel="noreferrer">
              Built by Terracotta
            </a>
            <a
              className="rounded-md px-3 py-2 hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]"
              href={config.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {config.sourceName} Source
            </a>
          </nav>
        </div>
      </header>

      <div className="bg-[color:var(--background)]" style={{ paddingTop: 64 }}>
        <div className="mx-auto max-w-[1540px] px-6 pb-2 pt-5">
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-3xl">{config.title}</h1>
          <p className="mt-1.5 text-base text-[color:var(--muted-foreground)]">{config.subtitle}</p>
        </div>

        <div className="sticky z-10 bg-[color:var(--background)]/95 pb-1 pt-2 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--background)]/80" style={{ top: 64 }}>
          <div className="mx-auto max-w-[1540px] px-6">
            <div className="flex flex-wrap items-center gap-2 pb-2 sm:gap-3">
              <span className={`${buttonClass} px-3`}>
                <CalendarDays className="size-3.5 text-[color:var(--muted-foreground)]" />
                {latestDate}
              </span>
              <button type="button" onClick={refresh} disabled={isPending} className={`${buttonClass} disabled:opacity-60`}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Refresh
              </button>
              <div className="flex min-w-0 max-w-full flex-col items-start gap-1 basis-full sm:ml-auto sm:basis-auto sm:items-end">
                <div className="flex min-w-0 max-w-full flex-wrap items-center justify-start gap-x-2 gap-y-1 sm:justify-end">
                  <span className="text-sm text-[color:var(--muted-foreground)]">{news.length} items</span>
                  <span className="text-[color:var(--muted-foreground)]/40">|</span>
                  <span className="text-sm text-[color:var(--muted-foreground)]/70">Updated from {config.sourceName}</span>
                  {refreshStatus ? (
                    <>
                      <span className="text-[color:var(--muted-foreground)]/40">|</span>
                      <span className="text-sm text-[color:var(--muted-foreground)]/70">{refreshStatus}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1540px] px-6">
          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          ) : null}

          <div
            className={`grid gap-5 pb-8 pt-1 sm:pt-5 ${
              sidebarCollapsed ? "lg:grid-cols-[1.75rem_minmax(0,1fr)_28rem]" : "lg:grid-cols-[11.5rem_minmax(0,1fr)_28rem]"
            }`}
          >
            {!sidebarCollapsed ? (
              <aside className="sticky hidden h-[calc(100dvh-10rem)] w-[11.5rem] shrink-0 self-start overflow-y-auto lg:block" style={{ top: 128 }}>
                <nav className="flex h-full flex-col overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="mb-3 flex items-center justify-between gap-2 px-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">Outline</p>
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(true)}
                      className="rounded-md p-1 text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]"
                      aria-label="Collapse news navigation"
                    >
                      <PanelLeftClose className="size-3.5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {newsOutlineGroups.map((group) => (
                      <section key={group.label} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleOutlineGroup(group.label)}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]"
                          aria-expanded={Boolean(openOutlineGroups[group.label])}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <ChevronRight className={`size-3.5 shrink-0 text-[color:var(--muted-foreground)] transition-transform ${openOutlineGroups[group.label] ? "rotate-90" : ""}`} />
                            <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">{group.label}</span>
                          </span>
                          <span className="rounded-md border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] leading-none text-[color:var(--muted-foreground)]">{group.items.length}</span>
                        </button>
                        {openOutlineGroups[group.label] ? (
                          <div className="space-y-0.5 pl-5">
                            {group.items.map((item) => (
                              <a
                                key={`${group.label}-${item.newsRefNo}`}
                                href={`#news-${item.newsRefNo}`}
                                onClick={() => setSelectedRef(item.newsRefNo)}
                                className={`block rounded-md px-2 py-1.5 text-left text-[13px] leading-5 transition-colors hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)] ${
                                  selectedRef === item.newsRefNo ? "bg-[color:var(--accent)]/65 text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"
                                }`}
                              >
                                {shortTitle(item.title)}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    ))}
                  </div>
                </nav>
              </aside>
            ) : (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="sticky top-32 hidden h-9 w-7 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--background)] text-[color:var(--muted-foreground)] shadow-sm hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)] lg:inline-flex"
                aria-label="Show news navigation"
                title="Show news"
              >
                <PanelLeftOpen className="size-3.5" />
              </button>
            )}

            <section className="min-w-0 flex-1">
              {isGenerating || drafts.length ? (
                <GeneratedArticlePanel
                  drafts={drafts}
                  queuedNews={queuedNews}
                  people={people}
                  selectedPersonIds={selectedPersonIds}
                  articleTitle={config.articleTitle}
                  defaultSubject={defaultEmailSubject}
                  isGenerating={isGenerating}
                />
              ) : null}

              <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
                {news.map((item) => {
                  const active = selectedNews?.newsRefNo === item.newsRefNo;
                  const targets = item.targetCeList.map((target) => target.ceName).join(", ");
                  const queued = selectedRefs.includes(item.newsRefNo);
                  return (
                    <article
                      key={item.newsRefNo}
                      id={`news-${item.newsRefNo}`}
                      className={`block w-full scroll-mt-36 px-1 py-4 text-left transition hover:bg-[color:var(--accent)]/60 ${active ? "bg-[color:var(--accent)]/45" : ""}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[color:var(--muted-foreground)]">
                            <span>{formatDate(item.issueDate)}</span>
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="size-3.5 text-[color:var(--primary)]" />
                              {item.summary ? "summarised" : "pending summary"}
                            </span>
                          </div>
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setSelectedRef(item.newsRefNo)}
                            className="group mt-3 inline-flex max-w-4xl items-start gap-2 text-xl font-semibold leading-snug tracking-tight text-[color:var(--foreground)] hover:text-[color:var(--primary)] sm:text-2xl"
                          >
                            <span>{displayTitle(item.title)}</span>
                            <ArrowUpRight className="mt-1 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleQueuedNews(item.newsRefNo)}
                          className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-md px-3 text-sm font-semibold shadow-sm sm:self-auto ${
                            queued ? "border border-[color:var(--primary)] bg-[color:var(--accent)] text-[color:var(--primary)]" : "bg-[color:var(--primary)] text-white"
                          }`}
                        >
                          <Sparkles className="size-3.5" />
                          {queued ? "Added" : "Generate article"}
                        </button>
                      </div>
                      {targets ? <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Target: {targets}</p> : null}
                      <p className="mt-4 max-w-5xl text-[15px] leading-7 text-[color:var(--foreground)]/80">{item.summary ?? "Summary pending."}</p>
                      {item.keywords.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.keywords.map((keyword) => (
                            <span key={keyword} className="rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--muted-foreground)]">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="sticky top-32 hidden h-[calc(100dvh-10rem)] min-w-0 overflow-y-auto lg:block">
              <ArticleQueue
                queuedNews={queuedNews}
                selectedPromptIndexes={selectedPromptIndexes}
                promptDrafts={promptDrafts}
                customPromptDrafts={customPromptDrafts}
                selectedPeople={selectedPeople}
                people={people}
                selectedPersonIds={selectedPersonIds}
                togglePerson={togglePerson}
                requirements={requirements}
                setRequirements={setRequirements}
                toggleQueuedNews={toggleQueuedNews}
                togglePrompt={togglePrompt}
                updatePromptDraft={updatePromptDraft}
                updateCustomPrompt={updateCustomPrompt}
                generateBatch={generateBatch}
                isGenerating={isGenerating}
                idPrefix="desktop"
              />
            </aside>
          </div>

          <div className="pb-8 pt-2 lg:hidden">
            <ArticleQueue
              queuedNews={queuedNews}
              selectedPromptIndexes={selectedPromptIndexes}
              promptDrafts={promptDrafts}
              customPromptDrafts={customPromptDrafts}
              selectedPeople={selectedPeople}
              people={people}
              selectedPersonIds={selectedPersonIds}
              togglePerson={togglePerson}
              requirements={requirements}
              setRequirements={setRequirements}
              toggleQueuedNews={toggleQueuedNews}
              togglePrompt={togglePrompt}
              updatePromptDraft={updatePromptDraft}
              updateCustomPrompt={updateCustomPrompt}
              generateBatch={generateBatch}
              isGenerating={isGenerating}
              idPrefix="mobile"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function refreshStatusText(payload: RefreshPayload): string {
  if (payload.durable?.status === "committed") {
    return payload.refreshed ? "Live refresh complete; durable update committed" : "Durable update committed";
  }
  if (payload.durable?.status === "failed") {
    return payload.refreshed ? "Live refresh complete; durable update failed" : "Durable update failed";
  }
  if (payload.refreshed) return "Live refresh complete";
  return "No live refresh configured";
}

type ArticleQueueProps = {
  queuedNews: StoredNews[];
  selectedPromptIndexes: Record<string, number[]>;
  promptDrafts: Record<string, string[]>;
  customPromptDrafts: Record<string, string>;
  selectedPeople: FirmPerson[];
  people: FirmPerson[];
  selectedPersonIds: number[];
  togglePerson: (personId: number) => void;
  requirements: string;
  setRequirements: (value: string) => void;
  toggleQueuedNews: (refNo: string) => void;
  togglePrompt: (refNo: string, promptIndex: number) => void;
  updatePromptDraft: (refNo: string, promptIndex: number, value: string) => void;
  updateCustomPrompt: (refNo: string, value: string) => void;
  generateBatch: () => void;
  isGenerating: boolean;
  idPrefix: string;
};

function ArticleQueue({
  queuedNews,
  selectedPromptIndexes,
  promptDrafts,
  customPromptDrafts,
  selectedPeople,
  people,
  selectedPersonIds,
  togglePerson,
  requirements,
  setRequirements,
  toggleQueuedNews,
  togglePrompt,
  updatePromptDraft,
  updateCustomPrompt,
  generateBatch,
  isGenerating,
  idPrefix,
}: ArticleQueueProps) {
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-base font-medium text-[color:var(--muted-foreground)]">
          <FileText className="size-4" />
          Article list
        </div>
        <span className="rounded-md border border-[color:var(--border)] px-2 py-1 text-sm text-[color:var(--muted-foreground)]">
          {queuedNews.length}/5
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {queuedNews.length ? (
          queuedNews.map((item) => (
            <div key={item.newsRefNo} className="rounded-md border border-[color:var(--border)] bg-white/40 p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="mt-1 text-base font-semibold leading-snug tracking-tight text-[color:var(--foreground)]">{displayTitle(item.title)}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => toggleQueuedNews(item.newsRefNo)}
                  className="rounded-md px-2 py-1 text-sm font-medium text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]"
                >
                  Remove
                </button>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-[color:var(--muted-foreground)]">Prompt direction</p>
                <div className="flex flex-wrap gap-2">
                  {promptSuggestions(item).map((prompt, promptIndex) => {
                    const value = promptDrafts[item.newsRefNo]?.[promptIndex] ?? prompt;
                    const active = selectedPromptIndexes[item.newsRefNo]?.includes(promptIndex) ?? false;
                    return (
                      <label
                        key={promptIndex}
                        className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-sm leading-6 transition ${
                          active ? "border-[color:var(--primary)] bg-[color:var(--accent)]" : "border-[color:var(--border)] bg-[color:var(--background)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => togglePrompt(item.newsRefNo, promptIndex)}
                          className="mt-1 size-4 accent-[color:var(--primary)]"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(event) => updatePromptDraft(item.newsRefNo, promptIndex, event.target.value)}
                          className="h-7 min-w-0 flex-1 bg-transparent text-[color:var(--foreground)] outline-none"
                          aria-label={`Prompt direction ${promptIndex + 1} for ${item.newsRefNo}`}
                        />
                      </label>
                    );
                  })}
                  <label
                    className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-sm leading-6 transition ${
                      selectedPromptIndexes[item.newsRefNo]?.includes(promptSuggestions(item).length)
                        ? "border-[color:var(--primary)] bg-[color:var(--accent)]"
                        : "border-[color:var(--border)] bg-[color:var(--background)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPromptIndexes[item.newsRefNo]?.includes(promptSuggestions(item).length) ?? false}
                      onChange={() => togglePrompt(item.newsRefNo, promptSuggestions(item).length)}
                      className="mt-1 size-4 accent-[color:var(--primary)]"
                    />
                    <input
                      type="text"
                      value={customPromptDrafts[item.newsRefNo] ?? ""}
                      onChange={(event) => updateCustomPrompt(item.newsRefNo, event.target.value)}
                      placeholder="Add a short angle, audience, or drafting emphasis."
                      className="h-7 min-w-0 flex-1 bg-transparent text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]/70"
                      aria-label={`Custom prompt direction for ${item.newsRefNo}`}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-[color:var(--border)] p-4 text-base leading-7 text-[color:var(--muted-foreground)]">
            Click “Generate article” on any news item to add it here. Select up to 5 items to generate articles in one batch.
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3">
        <p className="block text-base font-medium text-[color:var(--foreground)]" id={`${idPrefix}-people-label`}>
          Contact person
        </p>
        <div
          role="group"
          aria-labelledby={`${idPrefix}-people-label`}
          className="max-h-52 overflow-y-auto rounded-md border border-[color:var(--border)] bg-[color:var(--background)] p-2"
        >
          <PeopleChoices people={people} selectedPersonIds={selectedPersonIds} togglePerson={togglePerson} />
        </div>
        {selectedPeople.length ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedPeople.map((person) => (
              <span key={person.id} className="rounded-md border border-[color:var(--border)] bg-white/40 px-2 py-1 text-sm text-[color:var(--muted-foreground)]">
                {person.name}
                {person.title ? ` · ${person.title}` : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">No Firm contact selected.</p>
        )}

        <label className="block text-base font-medium text-[color:var(--foreground)]" htmlFor={`${idPrefix}-requirements`}>
          Additional requirements
        </label>
        <textarea
          id={`${idPrefix}-requirements`}
          value={requirements}
          onChange={(event) => setRequirements(event.target.value)}
          placeholder="Add tone, angle, audience, anonymisation, or partner-specific requirements."
          rows={7}
          className="min-h-36 resize-y rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-base leading-7 outline-none focus:border-[color:var(--primary)]"
        />

        <button
          type="button"
          onClick={generateBatch}
          disabled={isGenerating || queuedNews.length === 0}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-[color:var(--primary)] px-3 text-base font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Generate article
        </button>
      </div>

    </div>
  );
}

function GeneratedArticlePanel({
  drafts,
  queuedNews,
  people,
  selectedPersonIds,
  articleTitle,
  defaultSubject,
  isGenerating,
}: {
  drafts: ArticleDraft[];
  queuedNews: StoredNews[];
  people: FirmPerson[];
  selectedPersonIds: number[];
  articleTitle: string;
  defaultSubject: string;
  isGenerating: boolean;
}) {
  return (
    <div className="mb-6 rounded-md border border-[color:var(--border)] bg-[color:var(--background)] p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
          <FileText className="size-4 text-[color:var(--primary)]" />
          Generated article
        </div>
        {isGenerating ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--muted-foreground)]">
            <Loader2 className="size-3.5 animate-spin" />
            Generating
          </span>
        ) : null}
      </div>

      {isGenerating && !drafts.length ? (
        <div className="rounded-md border border-dashed border-[color:var(--border)] px-4 py-6 text-sm text-[color:var(--muted-foreground)]">
          Drafting the article. The editor will appear here when generation finishes.
        </div>
      ) : null}

      <div className="space-y-6">
        {drafts.map((draft) => {
          const item = queuedNews.find((newsItem) => newsItem.newsRefNo === draft.newsRefNo);
          return (
            <article key={draft.id} className="border-t border-[color:var(--border)] pt-5 first:border-t-0 first:pt-0">
              <div className="mb-4">
                <h3 className="text-base font-semibold leading-snug tracking-tight text-[color:var(--foreground)]">
                  {item ? displayTitle(item.title) : "Generated article"}
                </h3>
                {draft.personProfileUrl ? (
                  <a href={draft.personProfileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-[color:var(--primary)] underline underline-offset-4">
                    {draft.personName} profile <ArrowUpRight className="size-3" />
                  </a>
                ) : null}
              </div>
              <ArticleEditor
                markdown={draft.markdown}
                title={item ? displayTitle(item.title) : articleTitle}
                people={people}
                defaultRecipientIds={selectedPersonIds}
                defaultSubject={defaultSubject}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}

function shortTitle(title: string): string {
  return displayTitle(title);
}

type NewsOutlineGroup = {
  label: string;
  items: StoredNews[];
};

const outlineCategoryRules: Array<{ label: string; test: (text: string) => boolean }> = [
  {
    label: "Insider Dealing",
    test: (text) => /insider dealing|inside information|inside dealing/.test(text),
  },
  {
    label: "Market Misconduct",
    test: (text) => /market misconduct|false trading|market manipulation|manipulat|matched trades|illegal short selling|securities fraud|section 300/.test(text),
  },
  {
    label: "Court / Prosecution",
    test: (text) => /court proceedings|prosecution|criminal|convicted|conviction|sentenced|jail|magistrates|district court|court of first instance|hearing|injunction/.test(text),
  },
  {
    label: "Shareholder Remedies",
    test: (text) => /shareholder remedies|buy-out|compensation|minority shareholder|section 214|fiduciary duties|compensate|financial statements/.test(text),
  },
  {
    label: "Cancellation",
    test: (text) => /cancellation of listing|delist|delisted|resumption|resume trading|rule 6\.01a|gem rule 9\.14a/.test(text),
  },
  {
    label: "Disqualification",
    test: (text) => /director unsuitability|disqualification|disqualified|unsuitable|ban|banned/.test(text),
  },
  {
    label: "Sanctions",
    test: (text) => /disciplinary action|disciplinary sanctions|censure|censures|sanction|reprimand|criticis|prejudice to investors|statement|prohibited|prohibition|misconduct/.test(text),
  },
  {
    label: "Fines / Compensation",
    test: (text) => /\bfine\b|\bfined\b|fines him|fines .*?\$|penalt|pecuniary|compensation|compensate|buy[- ]out order|sum equivalent to the total profit/.test(text),
  },
  {
    label: "Asset Freeze",
    test: (text) => /freeze assets|freeze suspects|freezing order|interim injunction|worldwide court orders|suspected manipulators/.test(text),
  },
  {
    label: "Licensed Firms",
    test: (text) => /licensed corporations|licensed corporation|responsible officer|licensed representative|manager-in-charge|client money|liquid capital|aml compliance|internal controls|staff trading|client assets/.test(text),
  },
  {
    label: "Governance",
    test: (text) => /director accountability|director|directors|company secretary|senior management|chief financial officer|governance|board|duties|training|internal control/.test(text),
  },
  {
    label: "Listing Rules",
    test: (text) => /listing rules|listing committee|listing review committee|consultation|structured products|listing framework|listing competitiveness|chapter 15a|policy agenda|listing applications/.test(text),
  },
];

function categorizeNewsForOutline(items: StoredNews[]): NewsOutlineGroup[] {
  const groups = outlineCategoryRules
    .map((rule) => ({
      label: rule.label,
      items: items.filter((item) => rule.test(outlineSearchText(item))),
    }))
    .filter((group) => group.items.length > 0);

  const categorizedRefs = new Set(groups.flatMap((group) => group.items.map((item) => item.newsRefNo)));
  const otherItems = items.filter((item) => !categorizedRefs.has(item.newsRefNo));
  return otherItems.length ? [...groups, { label: "Other", items: otherItems }] : groups;
}

function outlineSearchText(item: StoredNews): string {
  return `${item.title} ${item.summary ?? ""} ${item.keywords.join(" ")}`.toLowerCase();
}

function buildDefaultEmailSubject(newsItems: StoredNews[]): string {
  const dates = newsItems
    .map((item) => new Date(item.issueDate))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return "Client alert - recent enforcement trend";

  const first = formatDate(dates[0].toISOString());
  const last = formatDate(dates[dates.length - 1].toISOString());
  const dateRange = first === last ? first : `${first} - ${last}`;
  return `Client alert - recent enforcement trend (${dateRange})`;
}

function displayTitle(title: string): string {
  const raw = title.replace(/\s+/g, " ").trim();

  if (/SFC and ICAC joint operation/i.test(raw)) return "SFC-ICAC insider dealing operation";
  if (/illegal short selling/i.test(raw)) return "Illegal short selling prosecution";
  if (/worldwide court orders/i.test(raw) && /insider dealing/i.test(raw)) return "Insider dealing worldwide asset freeze";
  if (/Retail trader sentenced/i.test(raw) && /false trading/i.test(raw)) return "False trading trader sentenced";

  const sfcBanAndFine = /SFC bans (.+?) for .*? and fines him/i.exec(raw);
  if (sfcBanAndFine) return `${cleanPerson(sfcBanAndFine[1])} banned and fined`;

  if (/SFC bans Nerico Brothers Limited’s former responsible officer/i.test(raw)) return "Nerico Brothers RO banned for life";

  const sfcLifeBan = /SFC bans (.+?) for life$/i.exec(raw);
  if (sfcLifeBan) return `${cleanPerson(sfcLifeBan[1])} banned for life`;

  if (/SFC obtains compensation and disqualification orders against former executive director of Coolpad Group/i.test(raw)) return "Coolpad director compensation order";

  const sfcSeniorExecProceedings = /SFC commences legal proceedings against former senior executives of (.+?) and its subsidiary/i.exec(raw);
  if (sfcSeniorExecProceedings) return `Proceedings against ${cleanEntity(sfcSeniorExecProceedings[1])} executives`;

  const cancellation = /matter of (.+?)\s*\([^)]*\)\s*\(Stock Code:\s*([^)]+)\)\s*Cancellation of listing/i.exec(raw);
  if (cancellation) return `${cleanEntity(cancellation[1])} delisting (${cancellation[2].trim()})`;

  const formerDirectors = /Disciplinary Action against (?:Two|Three|Four|Five|Six)?\s*Former Directors? of (.+?)(?:\s*\(|,|$)/i.exec(raw);
  if (formerDirectors) return `${cleanEntity(formerDirectors[1])} former directors censured`;

  const formerDirector = /Disciplinary Action against a Former Director of (.+?)(?:\s*\(|,|$)/i.exec(raw);
  if (formerDirector) return `${cleanEntity(formerDirector[1])} former director censured`;

  const companySecretary = /Disciplinary Action against Former Company Secretary of (.+?)(?:\s*\(|,|$)/i.exec(raw);
  if (companySecretary) return `${cleanEntity(companySecretary[1])} company secretary censured`;

  const directorsAndManagement = /Disciplinary Action against (.+?)(?:\s*\([^)]*\))?,\s*(?:Six Directors and Two Senior Management Members|a Director and a Senior Management Member|Six Directors and a Subsidiary’s Director)/i.exec(raw);
  if (directorsAndManagement) return `${cleanEntity(directorsAndManagement[1])} management censured`;

  const companyAndDirectors = /Disciplinary Action against (.+?)(?:\s*\([^)]*\))?\s+and\s+(?:Four|Six)\s+Directors/i.exec(raw);
  if (companyAndDirectors) return `${cleanEntity(companyAndDirectors[1])} directors censured`;

  const companyOnly = /Disciplinary Action against (.+?)(?:\s*\(|,|$)/i.exec(raw);
  if (companyOnly) return `${cleanEntity(companyOnly[1])} disciplinary action`;

  if (/Structured Products Listing Framework/i.test(raw)) return "Structured products listing reform";
  if (/Listing Committee Report/i.test(raw)) return "Listing Committee annual report";
  if (/Listing Competitiveness/i.test(raw)) return "Listing competitiveness consultation";

  const cleaned = title
    .replace(/^SFC\s+/i, "")
    .replace(/^Announcement\s+-\s+In relation to the matter of\s+/i, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const buyOut = /seeks share buy-out order against .*? of (.+?)(?: for |$)/i.exec(cleaned);
  if (buyOut) return `${cleanEntity(buyOut[1])} buy-out order sought`;

  const jailBegins = /(?:movie producer\s+)?(.+?) begins .*?jail term/i.exec(cleaned);
  if (jailBegins) return `${cleanPerson(jailBegins[1])} jail term begins`;

  const jailedAndFined = /(?:movie producer\s+)?(.+?) sentenced to jail and fined/i.exec(cleaned);
  if (jailedAndFined) return `${cleanPerson(jailedAndFined[1])} jailed and fined`;

  const convicted = /(?:movie producer\s+)?(.+?) convicted of (.+?)(?: in |$)/i.exec(cleaned);
  if (convicted) return `${cleanPerson(convicted[1])} convicted of ${convicted[2].trim()}`;

  const reprimand = /reprimands and fines (.+?)(?: for | over |$)/i.exec(cleaned);
  if (reprimand) return `${cleanEntity(reprimand[1])} reprimanded and fined`;

  const ban = /bans (.+?)(?:'s|’s)? former (.+?)(?: for |$)/i.exec(cleaned);
  if (ban) return `${cleanEntity(ban[1])} former ${ban[2].replace(/,.*$/, "").trim()} banned`;

  if (/obtains two-year disqualification order/i.test(cleaned)) return "Two-year director disqualification order";

  const disqualification = /obtains disqualification orders against former (.+?) of (.+?)(?: for |$)/i.exec(cleaned);
  if (disqualification) return `${cleanEntity(disqualification[2])} former ${disqualification[1].trim()} disqualified`;

  const proceedings = /commences legal proceedings against former (.+?) of (.+?)(?: for |$)/i.exec(cleaned);
  if (proceedings) return `Proceedings against ${cleanEntity(proceedings[2])} executives`;

  const agreement = /reaches agreement with (.+?)(?: over | for |$)/i.exec(cleaned);
  if (agreement) return `Agreement reached with ${cleanEntity(agreement[1])}`;

  const sanctions = /sanctions (.+?)(?: and | over | for |$)/i.exec(cleaned);
  if (sanctions) return `${cleanEntity(sanctions[1])} sanctioned`;

  if (/freeze assets/i.test(cleaned) && /KNT shares/i.test(cleaned)) return "KNT share manipulation asset freeze";

  return cleaned.split(" ").slice(0, 10).join(" ");
}

function cleanEntity(value: string): string {
  return value
    .replace(/\s+\$[\d.,]+\s*(?:million|billion)?$/i, "")
    .replace(/\s+HK\$[\d.,]+\s*(?:million|billion)?$/i, "")
    .replace(/\s+Holdings Company Limited$/i, "")
    .replace(/\s+\(Holdings\)\s+Limited$/i, "")
    .replace(/\s+Holdings Limited$/i, "")
    .replace(/\s+Company Limited$/i, "")
    .replace(/\s+Limited$/i, "")
    .replace(/\s+Ltd\.?$/i, "")
    .replace(/\s+Co\.?,?$/i, "")
    .replace(/[,\s]+$/g, "")
    .trim();
}

function cleanPerson(value: string): string {
  return value.replace(/^movie producer\s+/i, "").trim();
}

function PeopleChoices({
  people,
  selectedPersonIds,
  togglePerson,
}: {
  people: FirmPerson[];
  selectedPersonIds: number[];
  togglePerson: (personId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPeople = normalizedQuery
    ? people.filter((person) => `${person.name} ${person.title} ${person.practiceAreas.join(" ")} ${person.intro}`.toLowerCase().includes(normalizedQuery))
    : people;
  const grouped = filteredPeople.reduce<Record<string, FirmPerson[]>>((groups, person) => {
    const title = person.title || "Other";
    groups[title] = [...(groups[title] ?? []), person];
    return groups;
  }, {});
  const titles = Object.keys(grouped).sort((a, b) => roleRank(a) - roleRank(b) || a.localeCompare(b));

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Firm contacts"
        className="h-10 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-base outline-none focus:border-[color:var(--primary)]"
      />
      {titles.length ? titles.map((title) => (
        <div key={title}>
          <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">{title}</p>
          <div className="space-y-1">
            {grouped[title].map((person) => (
              <label key={person.id} className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 hover:bg-[color:var(--accent)]">
                <input
                  type="checkbox"
                  checked={selectedPersonIds.includes(person.id)}
                  onChange={() => togglePerson(person.id)}
                  className="mt-1 size-4 accent-[color:var(--primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-base leading-6 text-[color:var(--foreground)]">{person.name}</span>
                  <span className="block text-sm leading-5 text-[color:var(--muted-foreground)]">{person.title}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )) : <p className="px-1 py-2 text-sm text-[color:var(--muted-foreground)]">No matching contacts.</p>}
    </div>
  );
}

function roleRank(title: string): number {
  if (/managing partner|founding partner/i.test(title)) return 0;
  if (/partner/i.test(title)) return 1;
  if (/counsel|consultant/i.test(title)) return 2;
  if (/associate/i.test(title)) return 3;
  if (/trainee/i.test(title)) return 4;
  return 5;
}

function promptTextAt(
  item: StoredNews,
  promptIndex: number,
  promptDrafts: Record<string, string[]>,
  customPromptDrafts: Record<string, string>,
): string {
  const suggestions = promptSuggestions(item);
  if (promptIndex === suggestions.length) return (customPromptDrafts[item.newsRefNo] ?? "").trim();
  return (promptDrafts[item.newsRefNo]?.[promptIndex] ?? suggestions[promptIndex] ?? "").trim();
}

function promptSuggestions(item: StoredNews): string[] {
  const text = `${item.title} ${item.keywords.join(" ")}`.toLowerCase();
  if (text.includes("insider")) {
    return ["Focus on insider dealing controls and disclosure discipline.", "Explain what listed-company boards should review now."];
  }
  if (text.includes("disqualification") || text.includes("director")) {
    return ["Focus on directors' duties and board governance lessons.", "Explain practical implications for listed-company officers."];
  }
  if (text.includes("licensed corporation") || text.includes("responsible officer")) {
    return ["Focus on licensed corporation internal controls and RO accountability.", "Explain SFC expectations for supervision and record keeping."];
  }
  if (text.includes("freeze") || text.includes("asset")) {
    return ["Focus on asset preservation strategy and litigation risk.", "Explain how interim orders affect enforcement response planning."];
  }
  if (text.includes("fine") || text.includes("ban") || text.includes("sanction")) {
    return ["Focus on disciplinary risk and remediation steps.", "Explain compliance lessons for regulated market participants."];
  }
  return ["Focus on the practical compliance takeaway.", "Explain why this enforcement action matters to Hong Kong market participants."];
}
