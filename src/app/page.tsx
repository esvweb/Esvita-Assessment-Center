import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-medium tracking-widest text-brand uppercase">Esvita Clinic</p>
        <h1 className="mt-2 text-3xl font-semibold">Candidate Assessment Platform</h1>
        <p className="mt-3 text-muted">
          Candidates receive a private link by email. There is nothing to see here without one.
        </p>
      </div>
      <Link
        href="/admin"
        className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        HR panel →
      </Link>
    </main>
  );
}
