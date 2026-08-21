"use client";

import { useState } from "react";
import type { HrUser } from "@/lib/users";

export default function UserManager({ initial }: { initial: HrUser[] }) {
  const [users, setUsers] = useState(initial);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers((await res.json()).users);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add the user");
      setUsername("");
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the user");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(u: HrUser) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, is_active: !u.is_active }),
    });
    await refresh();
  }

  async function remove(u: HrUser) {
    if (!confirm(`Delete the user "${u.username}"?`)) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id }),
    });
    await refresh();
  }

  const input =
    "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Panel users</h2>
          <p className="text-sm text-muted">
            Users you add sign in with a one-time code sent to their email.
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
        >
          {open ? "Hide" : `Manage (${users.length})`}
        </button>
      </div>

      {open && (
        <>
          <form onSubmit={add} className="mt-4 grid grid-cols-12 gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className={`col-span-3 ${input}`}
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={`col-span-5 ${input}`}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "admin")}
              className={`col-span-2 ${input}`}
            >
              <option value="member">Member</option>
              <option value="admin">Administrator</option>
            </select>
            <button
              disabled={busy || !username.trim() || !email.trim()}
              className="col-span-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Add
            </button>
          </form>

          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

          <ul className="mt-4 divide-y divide-line border-t border-line">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-medium">{u.username}</span>{" "}
                  <span className="text-muted">· {u.email}</span>{" "}
                  {u.role === "admin" && (
                    <span className="ml-1 rounded bg-surface px-1.5 py-0.5 text-xs text-brand">
                      admin
                    </span>
                  )}
                  {!u.is_active && (
                    <span className="ml-1 rounded bg-surface px-1.5 py-0.5 text-xs text-muted">
                      inactive
                    </span>
                  )}
                </span>
                <span className="flex gap-3">
                  <button onClick={() => void toggle(u)} className="font-medium text-muted">
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => void remove(u)} className="font-medium text-red-700">
                    Delete
                  </button>
                </span>
              </li>
            ))}
            {users.length === 0 && (
              <li className="py-3 text-sm text-muted">No users yet.</li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}
