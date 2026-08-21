"use client";

import { useState } from "react";

/**
 * Renders the model's Markdown safely: the text is escaped first, so nothing
 * the model wrote can inject markup, and only bold/heading/list formatting is
 * applied afterwards.
 */
function render(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split("\n")
    .map((line) => {
      const bolded = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (/^#{1,6}\s/.test(line)) {
        return `<h3 class="mt-5 mb-1 text-base font-semibold">${bolded.replace(/^#{1,6}\s/, "")}</h3>`;
      }
      if (/^[-*]\s/.test(line)) {
        return `<li class="ml-5 list-disc">${bolded.replace(/^[-*]\s/, "")}</li>`;
      }
      if (!line.trim()) return "<div class='h-3'></div>";
      return `<p class="leading-relaxed">${bolded}</p>`;
    })
    .join("");
}

export default function ReportView({
  sessionId,
  markdown,
}: {
  sessionId: string;
  markdown: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate the report");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the report");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Evaluation report</h2>
        <button
          onClick={() => void regenerate()}
          disabled={busy}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {busy ? "Generating…" : markdown ? "Regenerate" : "Generate report"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {markdown ? (
        <div
          className="mt-4 text-sm"
          dangerouslySetInnerHTML={{ __html: render(markdown) }}
        />
      ) : (
        <p className="mt-4 text-sm text-muted">No report has been generated for this session yet.</p>
      )}
    </section>
  );
}
