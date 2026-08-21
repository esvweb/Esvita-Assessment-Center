"use client";

export default function SignOut({ username }: { username: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted">{username}</span>
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
