"use client";

export default function SignOut({ username }: { username: string }) {
  const [name, role] = username.split(" · ");
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-right leading-tight">
        <span className="block">{name}</span>
        {role && <span className="block text-xs text-muted">{role}</span>}
      </span>
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.reload();
        }}
        className="font-medium text-brand"
      >
        Sign out
      </button>
    </div>
  );
}
