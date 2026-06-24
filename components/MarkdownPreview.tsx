"use client";

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements = lines.map((line, index) => {
    if (line.startsWith("# ")) {
      return (
        <h1 key={index} className="mb-4 text-2xl font-semibold leading-tight tracking-tight text-[color:var(--foreground)]">
          {line.replace(/^# /, "")}
        </h1>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2 key={index} className="mb-3 mt-7 text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
          {line.replace(/^## /, "")}
        </h2>
      );
    }
    if (/^\s*[-*]\s+/.test(line)) {
      return (
        <li key={index} className="ml-5 list-disc text-[15px] leading-7 text-zinc-700">
          {renderInline(line.replace(/^\s*[-*]\s+/, ""))}
        </li>
      );
    }
    if (!line.trim()) return <div key={index} className="h-3" />;
    return (
      <p key={index} className="text-[15px] leading-7 text-zinc-700">
        {renderInline(line)}
      </p>
    );
  });

  return <div className="max-w-none">{elements}</div>;
}

function renderInline(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (!match) return part;
    return (
          <a key={index} href={match[2]} target="_blank" rel="noreferrer" className="text-[color:var(--primary)] underline underline-offset-4">
        {match[1]}
      </a>
    );
  });
}
