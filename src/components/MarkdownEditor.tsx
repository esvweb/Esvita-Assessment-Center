"use client";

import { useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

/**
 * A plain text editor with a formatting toolbar and a preview. It writes
 * Markdown underneath, which keeps what is stored readable and safe to render
 * (see lib/markdown) — no pasted HTML ever reaches a candidate's screen.
 */
export default function MarkdownEditor({
  value,
  onChange,
  rows = 10,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  /** Replaces the selection, then puts the cursor back where it makes sense. */
  function edit(transform: (selected: string) => { text: string; select?: [number, number] }) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const { text, select } = transform(value.slice(start, end));
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const [a, b] = select ?? [text.length, text.length];
      el.setSelectionRange(start + a, start + b);
    });
  }

  const wrap = (mark: string, fallback: string) =>
    edit((sel) => {
      const inner = sel || fallback;
      return { text: `${mark}${inner}${mark}`, select: [mark.length, mark.length + inner.length] };
    });

  /** Applies a prefix to every line the selection touches. */
  function prefixLines(prefix: (i: number) => string, strip: RegExp) {
    const el = ref.current;
    if (!el) return;
    const lineStart = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const nl = value.indexOf("\n", el.selectionEnd);
    const lineEnd = nl === -1 ? value.length : nl;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    // Pressing the same button again takes the formatting off.
    const already = lines.every((l) => strip.test(l));
    const next = lines
      .map((l, i) => (already ? l.replace(strip, "") : prefix(i) + l.replace(strip, "")))
      .join("\n");
    onChange(value.slice(0, lineStart) + next + value.slice(lineEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + next.length);
    });
  }

  const tool =
    "rounded px-2 py-1 text-sm text-muted hover:bg-surface hover:text-ink disabled:opacity-40";

  return (
    <div className="rounded-lg border border-line focus-within:border-brand">
      <div className="flex items-center gap-0.5 border-b border-line px-2 py-1">
        <button type="button" disabled={preview} onClick={() => wrap("**", "bold text")} className={`${tool} font-semibold`} title="Bold">
          B
        </button>
        <button type="button" disabled={preview} onClick={() => wrap("*", "italic text")} className={`${tool} italic`} title="Italic">
          I
        </button>
        <span className="mx-1 h-4 w-px bg-line" />
        <button type="button" disabled={preview} onClick={() => prefixLines(() => "## ", /^#{1,3}\s+/)} className={tool} title="Heading">
          Heading
        </button>
        <button type="button" disabled={preview} onClick={() => prefixLines(() => "### ", /^#{1,3}\s+/)} className={tool} title="Subheading">
          Subheading
        </button>
        <span className="mx-1 h-4 w-px bg-line" />
        <button type="button" disabled={preview} onClick={() => prefixLines(() => "- ", /^\s*[-*]\s+/)} className={tool} title="Bulleted list">
          • List
        </button>
        <button type="button" disabled={preview} onClick={() => prefixLines((i) => `${i + 1}. `, /^\s*\d+[.)]\s+/)} className={tool} title="Numbered list">
          1. List
        </button>
        <div className="ml-auto flex rounded-md bg-surface p-0.5 text-xs">
          {(["Write", "Preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPreview(m === "Preview")}
              className={`rounded px-2 py-0.5 font-medium ${
                (m === "Preview") === preview ? "bg-white text-ink shadow-sm" : "text-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {preview ? (
        <div
          className="min-h-32 space-y-3 px-3 py-3"
          // Safe: renderMarkdown escapes everything before adding its own tags.
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(value) || '<p class="text-sm text-muted">Nothing to preview yet.</p>',
          }}
        />
      ) : (
        <textarea
          ref={ref}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="block w-full resize-y rounded-b-lg px-3 py-2 text-sm leading-relaxed outline-none"
        />
      )}
    </div>
  );
}
