"use client";

import Link from "next/link";
import { useState } from "react";
import type { Assessment } from "@/lib/assessments";

export default function AssessmentList({
  initial,
  canDestroy,
}: {
  initial: Assessment[];
  canDestroy: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [working, setWorking] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not create");
      setName("");
      setDescription("");
      const list = await fetch("/api/admin/assessments");
      if (list.ok) setItems((await list.json()).assessments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const list = await fetch("/api/admin/assessments");
    if (list.ok) setItems((await list.json()).assessments);
  }

  async function duplicate(a: Assessment) {
    const proposed = window.prompt(
      "Name for the copy?\n\nCases, photos, company info and grading criteria are copied. Sessions and reports are not.",
      `${a.name} — copy`,
    );
    if (!proposed?.trim()) return;
    setWorking(a.id);
    try {
      const res = await fetch(`/api/admin/assessments/${a.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: proposed.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not duplicate");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not duplicate");
    } finally {
      setWorking(null);
    }
  }

  async function toggleBrief(a: Assessment) {
    setWorking(a.id);
    await fetch("/api/admin/assessments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, briefEnabled: !a.briefEnabled }),
    });
    await refresh();
    setWorking(null);
  }

  const input =
    "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-medium text-brand">
          ← Panel
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Assessments</h1>
        <p className="mt-1 text-sm text-muted">
          Each assessment has its own cases, company information and grading criteria. Editing the
          dental one never touches the one you build for hair.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="rounded-xl border border-line bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-medium">
                  {a.name}
                  {!a.isActive && (
                    <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-xs text-muted">
                      inactive
                    </span>
                  )}
                </h2>
                {a.description && <p className="mt-1 text-sm text-muted">{a.description}</p>}
                <p className="mt-2 text-sm text-muted">
                  {a.caseCount} cases · {a.sessionCount} sessions ·{" "}
                  {a.rubricVersion ? `criteria v${a.rubricVersion}` : "default criteria"}
                </p>

                <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={a.briefEnabled}
                    disabled={working === a.id}
                    onChange={() => void toggleBrief(a)}
                    className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                  />
                  <span>
                    Show company information to the candidate
                    {!a.briefEnabled && (
                      <span className="ml-2 text-xs text-amber-700">
                        off — the candidate sees neither the briefing nor the side panel
                      </span>
                    )}
                  </span>
                </label>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin/assessments/${a.id}/cases`}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-brand"
                >
                  Cases
                </Link>
                <Link
                  href={`/admin/assessments/${a.id}/brief`}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-brand"
                >
                  Company info
                </Link>
                <Link
                  href={`/admin/assessments/${a.id}/rubric`}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-brand"
                >
                  Criteria
                </Link>
                <button
                  onClick={() => void duplicate(a)}
                  disabled={working === a.id}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-brand disabled:opacity-40"
                >
                  {working === a.id ? "…" : "Duplicate"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={create} className="space-y-3 rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold">New assessment</h2>
        <p className="text-sm text-muted">
          Starts empty — you add its cases, company information and criteria yourself.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Esvita Hair V1"
            className={input}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            className={input}
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          disabled={busy || !name.trim()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create"}
        </button>
      </form>
    </div>
  );
}
