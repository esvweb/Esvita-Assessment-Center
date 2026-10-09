"use client";

import { useState } from "react";
import type { Treatment } from "@/lib/treatments";

const input =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

export default function PricingManager({
  assessmentId,
  initial,
  canDelete,
}: {
  assessmentId: string;
  initial: Treatment[];
  canDelete: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [unit, setUnit] = useState("unit");
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/admin/treatments?assessment=${assessmentId}`);
    if (res.ok) setRows((await res.json()).treatments);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          name,
          minPrice: Number(minPrice) || 0,
          unit,
          currency,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not add");
      setName("");
      setMinPrice("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold">Price list</h2>
        <p className="mt-1 text-sm text-muted">
          These are the lines a candidate can put on a treatment plan. The minimum is the floor: the
          plan form starts each line at this price and refuses to send anything below it, so what
          separates candidates is how far above the floor they sell and how they justify it.
        </p>

        <form onSubmit={add} className="mt-4 grid grid-cols-12 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Treatment name"
            className={`col-span-4 ${input}`}
          />
          <input
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            inputMode="decimal"
            placeholder="Minimum"
            className={`col-span-2 ${input}`}
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={`col-span-2 ${input}`}
          >
            <option>EUR</option>
            <option>GBP</option>
            <option>USD</option>
          </select>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="per…"
            className={`col-span-2 ${input}`}
          />
          <button
            disabled={busy || !name.trim()}
            className="col-span-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

        <ul className="mt-4 divide-y divide-line border-t border-line">
          {rows.map((t) => (
            <Row key={t.id} data={t} canDelete={canDelete} onChanged={refresh} />
          ))}
          {rows.length === 0 && (
            <li className="py-3 text-sm text-muted">
              Nothing priced yet. Until you add lines here, candidates cannot build a plan.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Row({
  data,
  canDelete,
  onChanged,
}: {
  data: Treatment;
  canDelete: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(data.name);
  const [minPrice, setMinPrice] = useState(String(data.minPrice));
  const [unit, setUnit] = useState(data.unit);
  const [currency, setCurrency] = useState(data.currency);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/admin/treatments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: data.id, ...body }),
    });
    setEditing(false);
    setBusy(false);
    await onChanged();
  }

  async function remove() {
    if (!confirm(`Remove "${data.name}" from the price list?`)) return;
    await fetch("/api/admin/treatments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: data.id }),
    });
    await onChanged();
  }

  if (editing) {
    return (
      <li className="py-3">
        <div className="grid grid-cols-12 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`col-span-4 ${input}`}
          />
          <input
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            inputMode="decimal"
            className={`col-span-2 ${input}`}
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={`col-span-2 ${input}`}
          >
            <option>EUR</option>
            <option>GBP</option>
            <option>USD</option>
          </select>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={`col-span-2 ${input}`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void patch({ name, minPrice: Number(minPrice) || 0, unit, currency })
            }
            className="col-span-1 rounded-lg bg-brand px-2 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="col-span-1 text-sm font-medium text-muted"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between py-2.5 text-sm">
      <span>
        <span className="font-medium">{data.name}</span>{" "}
        <span className="text-muted">
          · minimum {data.minPrice.toLocaleString("en-GB")} {data.currency} per {data.unit}
        </span>
        {!data.isActive && (
          <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-xs text-muted">hidden</span>
        )}
      </span>
      <span className="flex gap-3">
        <button type="button" onClick={() => setEditing(true)} className="font-medium text-brand">
          Edit
        </button>
        <button
          type="button"
          onClick={() => void patch({ isActive: !data.isActive })}
          className="font-medium text-muted"
        >
          {data.isActive ? "Hide" : "Show"}
        </button>
        {canDelete && (
          <button type="button" onClick={() => void remove()} className="font-medium text-red-700">
            Delete
          </button>
        )}
      </span>
    </li>
  );
}
