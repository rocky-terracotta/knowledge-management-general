"use client";

import { useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, Loader2, Mail, Send } from "lucide-react";
import type { FirmPerson } from "@/lib/types";

type Props = {
  markdown: string;
  title: string;
  people: FirmPerson[];
  defaultRecipientIds: number[];
  defaultSubject?: string;
};

type RecipientOption = {
  id: string;
  name: string;
  email: string;
  group: string;
  detail: string;
};

const testRecipients: RecipientOption[] = [
  {
    id: "test:leona",
    name: "Leona Zhang",
    email: "leona@terracotta.dev",
    group: "Test recipients",
    detail: "leona@terracotta.dev",
  },
  {
    id: "test:rocky",
    name: "Rocky Li",
    email: "rocky@terracotta.dev",
    group: "Test recipients",
    detail: "rocky@terracotta.dev",
  },
];

export function ArticleEditor({ markdown, title, people, defaultRecipientIds, defaultSubject }: Props) {
  const [recipientIds, setRecipientIds] = useState<string[]>(() => [
    ...testRecipients.map((recipient) => recipient.id),
    ...defaultRecipientIds.map((id) => `person:${id}`),
  ]);
  const [subject, setSubject] = useState(defaultSubject ?? title);
  const [message, setMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit],
    content: markdownToHtml(markdown),
    editorProps: {
      attributes: {
        class:
          "client-alert-editor prose prose-sm max-w-none min-h-80 rounded-md border border-[color:var(--border)] bg-white/60 px-5 py-4 text-[color:var(--foreground)] outline-none",
      },
    },
    immediatelyRender: false,
  });

  const recipientOptions = useMemo<RecipientOption[]>(
    () => [
      ...testRecipients,
      ...people.map((person) => ({
        id: `person:${person.id}`,
        name: person.name,
        email: emailForPerson(person),
        group: person.title || "Other",
        detail: `${person.title} · ${emailForPerson(person)}`,
      })),
    ],
    [people],
  );

  const recipients = useMemo(() => {
    const selected = new Set(recipientIds);
    return recipientOptions.filter((recipient) => selected.has(recipient.id)).map(({ name, email }) => ({ name, email }));
  }, [recipientOptions, recipientIds]);

  function toggleRecipient(recipientId: string) {
    setRecipientIds((current) => (current.includes(recipientId) ? current.filter((id) => id !== recipientId) : [...current, recipientId]));
  }

  async function sendArticle() {
    if (!editor) return;
    if (!recipients.length) return;
    const recipientList = recipients.map((recipient) => `${recipient.name} <${recipient.email}>`).join(", ");
    const confirmed = window.confirm(`Send this email to ${recipientList}?`);
    if (!confirmed) return;

    setIsSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          html: editor.getHTML(),
          text: editor.getText(),
          recipients,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to send email.");
      setMessage("Email sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send email.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
          <Mail className="size-4" />
          Editor
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`rounded-md border border-[color:var(--border)] p-1.5 ${editor?.isActive("bold") ? "bg-[color:var(--accent)] text-[color:var(--primary)]" : ""}`}
            aria-label="Bold"
          >
            <Bold className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`rounded-md border border-[color:var(--border)] p-1.5 ${editor?.isActive("italic") ? "bg-[color:var(--accent)] text-[color:var(--primary)]" : ""}`}
            aria-label="Italic"
          >
            <Italic className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`rounded-md border border-[color:var(--border)] p-1.5 ${editor?.isActive("bulletList") ? "bg-[color:var(--accent)] text-[color:var(--primary)]" : ""}`}
            aria-label="Bullet list"
          >
            <List className="size-3.5" />
          </button>
        </div>
      </div>
      <EditorContent editor={editor} />
      <label className="grid gap-1 text-sm font-medium text-[color:var(--foreground)]">
        Email subject
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-sm font-normal outline-none focus:border-[color:var(--primary)]"
        />
      </label>
      <div className="space-y-2">
        <p className="text-sm font-medium text-[color:var(--foreground)]">Internal recipients</p>
        <p className="rounded-md border border-[color:var(--border)] bg-white/40 px-3 py-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
          Selected to send: {recipients.length ? recipients.map((recipient) => `${recipient.name} <${recipient.email}>`).join("; ") : "No recipients selected."}
        </p>
        <div className="max-h-52 overflow-y-auto rounded-md border border-[color:var(--border)] p-2">
          <RecipientChoices recipients={recipientOptions} recipientIds={recipientIds} toggleRecipient={toggleRecipient} />
        </div>
      </div>
      <button
        type="button"
        onClick={sendArticle}
        disabled={isSending || !recipients.length}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--primary)] px-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Send
      </button>
      {message ? <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">{message}</p> : null}
    </section>
  );
}

function RecipientChoices({
  recipients,
  recipientIds,
  toggleRecipient,
}: {
  recipients: RecipientOption[];
  recipientIds: string[];
  toggleRecipient: (recipientId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecipients = normalizedQuery
    ? recipients.filter((recipient) => `${recipient.name} ${recipient.email} ${recipient.detail} ${recipient.group}`.toLowerCase().includes(normalizedQuery))
    : recipients;
  const grouped = filteredRecipients.reduce<Record<string, RecipientOption[]>>((groups, recipient) => {
    groups[recipient.group] = [...(groups[recipient.group] ?? []), recipient];
    return groups;
  }, {});
  const titles = Object.keys(grouped).sort((a, b) => roleRank(a) - roleRank(b) || a.localeCompare(b));

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search recipients by name or email"
        className="h-9 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-sm outline-none focus:border-[color:var(--primary)]"
      />
      {titles.length ? titles.map((title) => (
        <div key={title}>
          <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">{title}</p>
          <div className="space-y-1">
            {grouped[title].map((recipient) => (
              <label key={recipient.id} className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 hover:bg-[color:var(--accent)]">
                <input
                  type="checkbox"
                  checked={recipientIds.includes(recipient.id)}
                  onChange={() => toggleRecipient(recipient.id)}
                  className="mt-1 size-3 accent-[color:var(--primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm leading-5 text-[color:var(--foreground)]">{recipient.name}</span>
                  <span className="block text-xs leading-4 text-[color:var(--muted-foreground)]">{recipient.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )) : <p className="px-1 py-2 text-xs text-[color:var(--muted-foreground)]">No matching recipients.</p>}
    </div>
  );
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      closeList();
      html.push(`<h1>${inlineMarkdown(trimmed.slice(2))}</h1>`);
    } else if (/^[-*]\s+/.test(trimmed)) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inlineMarkdown(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${inlineMarkdown(trimmed.replace(/^\d+\.\s+/, ""))}</li>`);
    } else {
      closeList();
      html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
    }
  }
  closeList();
  return html.join("\n");
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function emailForPerson(person: FirmPerson): string {
  const slug = person.profileUrl.split("/").filter(Boolean).at(-1) ?? person.name.toLowerCase().replace(/\s+/g, ".");
  const localPart = slug
    .toLowerCase()
    .replace(/-/g, ".")
    .replace(/[^a-z0-9.]+/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${localPart}@terracotta.dev`;
}

function roleRank(title: string): number {
  if (/test recipients/i.test(title)) return -1;
  if (/managing partner|founding partner/i.test(title)) return 0;
  if (/partner/i.test(title)) return 1;
  if (/counsel|consultant/i.test(title)) return 2;
  if (/associate/i.test(title)) return 3;
  if (/trainee/i.test(title)) return 4;
  return 5;
}
