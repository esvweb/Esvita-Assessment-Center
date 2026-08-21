"use client";

import { useState } from "react";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import type { HrUser } from "@/lib/users";

const input =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

export default function UserManager({ initial }: { initial: HrUser[] }) {
  const [users, setUsers] = useState(initial);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("moderator");
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

  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Panel users</h2>
          <p className="text-sm text-muted">
            Users you add sign in with a one-time code sent to their email. Moderators can build and
            run assessments; only administrators can delete.
          </p>
        </div>
        <button
          type="button"
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
              onChange={(e) => setRole(e.target.value as Role)}
              className={`col-span-2 ${input}`}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
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
              <UserRow key={u.id} data={u} onChanged={refresh} />
            ))}
            {users.length === 0 && <li className="py-3 text-sm text-muted">No users yet.</li>}
          </ul>
        </>
      )}
    </section>
  );
}

function UserRow({ data, onChanged }: { data: HrUser; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(data.username);
  const [email, setEmail] = useState(data.email);
  const [role, setRole] = useState<Role>(data.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.id, ...body }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save");
      setEditing(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete the user "${data.username}"?`)) return;
    await fetch("/api/admin/users", {
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
            onChange={(e) => setRole(e.target.value as Role)}
            className={`col-span-4 ${input}`}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-2 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => void patch({ username, email, role })}
            disabled={busy}
            className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setUsername(data.username);
              setEmail(data.email);
              setRole(data.role);
              setEditing(false);
              setError(null);
            }}
            className="font-medium text-muted"
          >
            Cancel
          </button>
          <p className="ml-auto text-xs text-muted">
            Changing the address changes where their sign-in code is sent.
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between py-2.5 text-sm">
      <span>
        <span className="font-medium">{data.username}</span>{" "}
        <span className="text-muted">· {data.email}</span>{" "}
        <span className="ml-1 rounded bg-surface px-1.5 py-0.5 text-xs text-brand">
          {ROLE_LABELS[data.role] ?? data.role}
        </span>
        {!data.is_active && (
          <span className="ml-1 rounded bg-surface px-1.5 py-0.5 text-xs text-muted">inactive</span>
        )}
        {data.last_login && (
          <span className="ml-2 text-xs text-muted">
            last in {new Date(data.last_login).toLocaleDateString("en-GB")}
          </span>
        )}
      </span>
      <span className="flex gap-3">
        <button type="button" onClick={() => setEditing(true)} className="font-medium text-brand">
          Edit
        </button>
        <button
          type="button"
          onClick={() => void patch({ is_active: !data.is_active })}
          className="font-medium text-muted"
        >
          {data.is_active ? "Deactivate" : "Activate"}
        </button>
        <button type="button" onClick={() => void remove()} className="font-medium text-red-700">
          Delete
        </button>
      </span>
    </li>
  );
}
