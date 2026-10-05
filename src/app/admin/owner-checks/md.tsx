import type { ReactNode } from "react";

/**
 * Renders the checklist's verbatim text: **bold**, *italic*, `code`, http(s) links, and
 * lines starting with "- " as bullets. Nothing is added or reworded.
 */
export function Md({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="grid list-disc gap-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const line of lines) {
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
      continue;
    }
    flush();
    blocks.push(<p key={`p-${blocks.length}`}>{inline(line)}</p>);
  }
  flush();
  return <div className={className ?? "grid gap-2"}>{blocks}</div>;
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/[^\s)]+)/g;

function inline(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-fg">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    if (/^https?:\/\//.test(part)) {
      const url = part.replace(/[.,;]+$/, "");
      const rest = part.slice(url.length);
      return (
        <span key={i}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-fg underline underline-offset-4">
            {url}
          </a>
          {rest}
        </span>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}
