"use client";

import { useState } from "react";
import type { BriefSection } from "@/lib/brief";

const input =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";
const label = "block text-xs font-medium tracking-wide text-muted uppercase mb-1.5";

export default function BriefManager({
  assessmentId,
  initial,
  canDestroy,
}: {
  assessmentId: string;
  initial: BriefSection[];
  canDestroy: boolean;
}) {
  const [sections, setSections] = useState(initial);

  async function refresh() {
    const res = await fetch(`/api/admin/brief?assessmentId=${assessmentId}`);
    if (res.ok) setSections((await res.json()).sections);
  }

  async function add() {
    await fetch("/api/admin/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId, title: "New section", body: "" }),
    });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Company information</h2>
          <p className="mt-1 text-sm text-muted">
            What the candidate reads in the briefing and keeps in the panel beside them. The report
            also checks their answers against it.
          </p>
        </div>
        <button
          onClick={() => void add()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + New section
        </button>
      </div>

      <div className="space-y-3">
        {sections.map((s) => (
          <SectionRow key={s.id} data={s} onChanged={refresh} canDestroy={canDestroy} />
        ))}
        {sections.length === 0 && (
          <p className="rounded-xl border border-line bg-white px-5 py-8 text-center text-sm text-muted">
            No sections yet.
          </p>
        )}
      </div>
    </div>
  );
}

function SectionRow({
  data,
  onChanged,
  canDestroy,
}: {
  data: BriefSection;
  onChanged: () => Promise<void>;
  canDestroy: boolean;
}) {
  const [title, setTitle] = useState(data.title);
  const [body, setBody] = useState(data.body);
  const [bullets, setBullets] = useState(data.bullets.join("\n"));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/brief/${data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        bullets: bullets.split("\n").map((b) => b.trim()).filter(Boolean),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await onChanged();
  }

  async function remove() {
    if (!confirm(`Delete the section "${title}"?`)) return;
    await fetch(`/api/admin/brief/${data.id}`, { method: "DELETE" });
    await onChanged();
  }

  return (
    <section className="rounded-xl border border-line bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted">
          {data.bullets.length} bullets · {open ? "close" : "edit"}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line px-5 py-5">
          <div>
            <label className={label}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Body</label>
            <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Bullets — one per line</label>
            <textarea rows={6} value={bullets} onChange={(e) => setBullets(e.target.value)} className={input} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-sm text-brand">Saved</span>}
            {canDestroy && (
              <button
                type="button"
                onClick={() => void remove()}
                className="ml-auto text-sm font-medium text-red-700"
              >
                Delete section
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
