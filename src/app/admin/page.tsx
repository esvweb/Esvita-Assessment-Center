import Link from "next/link";
import InviteForm from "@/components/InviteForm";
import LoginForm from "@/components/LoginForm";
import SetupChecklist from "@/components/SetupChecklist";
import SignOut from "@/components/SignOut";
import UserManager from "@/components/UserManager";
import { adminUsername, currentUser } from "@/lib/auth";
import { isDatabaseReady, serviceStatus } from "@/lib/config";
import { sql } from "@/lib/db";
import { listAssessments } from "@/lib/assessments";
import { listCases } from "@/lib/cases";
import type { AssessmentSession } from "@/lib/types";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  brief: "Briefing",
  call_1: "Call 1",
  chat: "Messaging",
  plan: "Treatment plan",
  call_2: "Call 2",
  report: "Report",
  done: "Completed",
};

export default async function AdminPage() {
  const me = await currentUser();
  if (!me) return <LoginForm adminUser={adminUsername()} />;

  const services = serviceStatus();

  // Without a database there are no sessions to show — say so plainly rather
  // than letting the query throw an unexplained 500 during setup.
  if (!isDatabaseReady()) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Candidate assessments</h1>
          <SignOut username={me.username} />
        </div>
        <SetupChecklist services={services} />
      </main>
    );
  }

  type Row = AssessmentSession & {
    overall: number | null;
    hire_signal: string | null;
    outcome: string | null;
  };

  const assessments = await listAssessments();
  const casesByAssessment = await Promise.all(
    assessments.map(async (a) => ({
      id: a.id,
      name: a.name,
      cases: (await listCases(a.id)).map((c) => ({
        id: c.id,
        name: c.name,
        headline: c.headline ?? "",
      })),
    })),
  );
  const allCases = await Promise.all(assessments.map((a) => listCases(a.id, true)));
  const caseById = new Map(allCases.flat().map((c) => [c.id, c]));
  const assessmentById = new Map(assessments.map((a) => [a.id, a]));

  let sessions: Row[];
  try {
    sessions = (await sql()`
      select s.*, r.overall, r.hire_signal, r.outcome
      from sessions s
      left join reports r on r.session_id = s.id
      order by s.created_at desc
      limit 100`) as Row[];
  } catch (e) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-red-700">
          Database error: {e instanceof Error ? e.message : "unknown"}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Candidate assessments</h1>
          <p className="text-sm text-muted">{sessions.length} sessions</p>
        </div>
        <SignOut username={me.username} />
      </div>

      <nav className="flex flex-wrap gap-2">
        <Link
          href="/admin/assessments"
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:border-brand"
        >
          Assessments ({assessments.length})
        </Link>
        {assessments.map((a) => (
          <Link
            key={a.id}
            href={`/admin/assessments/${a.id}/cases`}
            className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-muted hover:border-brand hover:text-ink"
          >
            {a.name}
          </Link>
        ))}
      </nav>

      {services.some((s) => !s.ready) && <SetupChecklist services={services} />}

      {me.role === "admin" && <UserManager initial={await listUsers()} />}

      <InviteForm assessments={casesByAssessment} />

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-surface text-left text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Candidate</th>
              <th className="px-4 py-3">Assessment</th>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Signal</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const c = caseById.get(s.profile_id);
              return (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.candidate_name}</p>
                    <p className="text-xs text-muted">{s.candidate_email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {s.assessment_id ? (assessmentById.get(s.assessment_id)?.name ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c ? `#${c.id} ${c.name}` : `#${s.profile_id} (deleted)`}
                  </td>
                  <td className="px-4 py-3">{STAGE_LABEL[s.stage] ?? s.stage}</td>
                  <td className="px-4 py-3">{s.outcome ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">
                    {s.overall != null ? `${s.overall}/5` : "—"}
                  </td>
                  <td className="px-4 py-3">{s.hire_signal ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/sessions/${s.id}`} className="font-medium text-brand">
                      Review →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  No sessions yet. Create a candidate invitation above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
