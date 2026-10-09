import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReportView from "@/components/ReportView";
import TranscriptView from "@/components/TranscriptView";
import { getAssessment } from "@/lib/assessments";
import { isSignedIn } from "@/lib/auth";
import { getCase } from "@/lib/cases";
import { getSessionById, getTranscript, sql } from "@/lib/db";
import { getCallArtifacts } from "@/lib/vapi";

export const dynamic = "force-dynamic";

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) redirect("/?as=staff");

  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) notFound();

  const [patient, assessment, transcript] = await Promise.all([
    getCase(session.profile_id),
    session.assessment_id ? getAssessment(session.assessment_id) : Promise.resolve(null),
    getTranscript(id),
  ]);

  const reportRows = await sql()`
    select r.*, rv.version as rubric_version
    from reports r
    left join rubric_versions rv on rv.id = r.rubric_version_id
    where r.session_id = ${id} limit 1`;
  const report =
    (reportRows[0] as
      | { markdown: string; overall: number; rubric_version: number | null }
      | undefined) ?? null;

  // Recording URLs are signed and expire, so they are fetched per view rather
  // than stored. Missing keys degrade to a note instead of failing the page.
  const hasVapiKey = Boolean(process.env.VAPI_PRIVATE_KEY);
  const [call1, call2] = await Promise.all(
    [session.call_1_id, session.call_2_id].map(async (callId) => ({
      callId: callId ?? null,
      artifacts: callId && hasVapiKey ? await getCallArtifacts(callId) : null,
    })),
  );

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <Link href="/admin" className="text-sm font-medium text-brand">
        ← All sessions
      </Link>

      <header className="rounded-xl border border-line bg-white p-6">
        <h1 className="text-2xl font-semibold">{session.candidate_name}</h1>
        <p className="mt-1 text-sm text-muted">
          {assessment ? `${assessment.name} · ` : ""}
          {patient
            ? `#${patient.id} ${patient.name}, ${patient.age}, ${patient.country} — ${patient.headline}`
            : `#${session.profile_id} — this case has been deleted`}
        </p>
        <dl className="mt-4 grid grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-xs text-muted uppercase">Stage</dt>
            <dd className="font-medium">{session.stage}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted uppercase">Photos requested</dt>
            <dd className="font-medium">{session.photos_requested ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted uppercase">Plan sent</dt>
            <dd className="font-medium">{session.plan ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted uppercase">Overall score</dt>
            <dd className="font-medium">
              {report?.overall != null ? `${report.overall}/5` : "—"}
              {report?.rubric_version != null && (
                <span className="ml-1 text-xs text-muted">· criteria v{report.rubric_version}</span>
              )}
            </dd>
          </div>
        </dl>
      </header>

      <ReportView sessionId={id} markdown={report?.markdown ?? null} />

      {session.plan && (
        <section className="rounded-xl border border-line bg-white p-6">
          <h2 className="text-base font-semibold">Treatment plan the candidate sent</h2>
          <p className="mt-2 text-sm whitespace-pre-wrap">{session.plan.summary}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {session.plan.items.map((i, k) => (
              <li key={k}>
                • {i.treatment} × {i.quantity}
                {i.unit_price
                  ? ` — ${i.unit_price} ${session.plan!.currency} each${
                      i.min_price ? ` (floor ${i.min_price})` : ""
                    }`
                  : ""}
                {i.note ? ` — ${i.note}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            Total: {session.plan.total_price} {session.plan.currency} · {session.plan.trip_days} days
            · {session.plan.visits} visit(s)
          </p>
        </section>
      )}

      <TranscriptView
        transcript={transcript}
        patientName={patient?.name ?? "Patient"}
        call1={call1}
        call2={call2}
      />
    </main>
  );
}
