"use client";

import { useState } from "react";

interface Block {
  key: string;
  label: string;
  help: string;
  placeholders: string[];
  body: string;
  isDefault: boolean;
}

interface Bank {
  key: string;
  title: string;
  questions: string[];
}

const area =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-brand";

export default function PromptManager({
  assessmentId,
  initialBlocks,
  initialBanks,
  initialObjections,
}: {
  assessmentId: string;
  initialBlocks: Block[];
  initialBanks: Bank[];
  initialObjections: Bank;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold">What the patient is told</h2>
        <p className="mt-1 text-sm text-muted">
          Every word the simulated patient receives is below or on the case itself — nothing is held
          back in the code. Edit a block to change how the agent behaves across this whole
          assessment; a block you have not touched shows as default and can be restored at any time.
        </p>
      </div>

      {initialBlocks.map((b) => (
        <BlockEditor key={b.key} assessmentId={assessmentId} initial={b} />
      ))}

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold">Question and objection banks</h2>
        <p className="mt-1 text-sm text-muted">
          Cases pull their technical questions from these banks by letter. One line per question.
          Objection lines are written as <code className="text-xs">key :: the objection</code> — a
          case&apos;s objection chain refers to the key, or carries its own text.
        </p>
      </div>

      {initialBanks.map((b) => (
        <BankEditor key={b.key} assessmentId={assessmentId} initial={b} />
      ))}
      <BankEditor assessmentId={assessmentId} initial={initialObjections} />
    </div>
  );
}

function BlockEditor({ assessmentId, initial }: { assessmentId: string; initial: Block }) {
  const [body, setBody] = useState(initial.body);
  const [isDefault, setIsDefault] = useState(initial.isDefault);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const dirty = body !== initial.body;

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, key: initial.key, body }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save");
      setNote("Saved.");
      setIsDefault(false);
      initial.body = body;
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!confirm(`Restore "${initial.label}" to the built-in default?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/prompt", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, key: initial.key }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not restore");
      setBody(d.body);
      initial.body = d.body;
      setIsDefault(true);
      setNote("Restored to default.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not restore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">
            {initial.label}
            {!isDefault && (
              <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-xs font-normal text-brand">
                edited
              </span>
            )}
          </h3>
          <p className="mt-1 text-sm text-muted">{initial.help}</p>
          {initial.placeholders.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              Placeholders:{" "}
              {initial.placeholders.map((ph) => (
                <code key={ph} className="mr-1 rounded bg-surface px-1">
                  {ph}
                </code>
              ))}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
        >
          {open ? "Hide" : "Edit"}
        </button>
      </div>

      {open && (
        <>
          <textarea
            rows={Math.min(30, body.split("\n").length + 2)}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`mt-4 ${area}`}
          />
          <div className="mt-3 flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !dirty}
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            {!isDefault && (
              <button type="button" onClick={() => void restore()} className="font-medium text-muted">
                Restore default
              </button>
            )}
            {note && <span className="text-muted">{note}</span>}
          </div>
        </>
      )}
    </section>
  );
}

function BankEditor({ assessmentId, initial }: { assessmentId: string; initial: Bank }) {
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.questions.join("\n"));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/banks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          key: initial.key,
          title,
          questions: text.split("\n").map((l) => l.trim()).filter(Boolean),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save");
      setNote("Saved.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const count = text.split("\n").filter((l) => l.trim()).length;

  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">
            Bank {initial.key} — {title}
          </h3>
          <p className="mt-1 text-sm text-muted">{count} lines</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
        >
          {open ? "Hide" : "Edit"}
        </button>
      </div>

      {open && (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bank title"
            className="mt-4 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <textarea
            rows={Math.min(24, count + 3)}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`mt-2 ${area}`}
          />
          <div className="mt-3 flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            {note && <span className="text-muted">{note}</span>}
          </div>
        </>
      )}
    </section>
  );
}
