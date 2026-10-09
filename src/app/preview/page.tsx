import Link from "next/link";
import Flow from "@/components/Flow";
import { defaultAssessment } from "@/lib/assessments";
import { listBrief } from "@/lib/brief";
import { listTreatments } from "@/lib/treatments";
import { listCases } from "@/lib/cases";
import { isDatabaseReady } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Walk every candidate-facing screen with no backend attached. Voice calls are
 * skipped, the patient's chat replies are faked locally, and nothing is saved —
 * this exists purely so the flow can be reviewed before the services are wired up.
 */
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const { profile: raw } = await searchParams;

  // Preview reads the same content the real assessment does, so what you see
  // here is what a candidate would get.
  const assessment = isDatabaseReady() ? await defaultAssessment() : null;
  const cases = assessment ? await listCases(assessment.id, true) : [];
  const brief = assessment ? await listBrief(assessment.id) : [];
  const treatments = assessment ? await listTreatments(assessment.id) : [];
  const patient = cases.find((c) => String(c.id) === raw) ?? cases[0];

  if (!patient) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-sm text-muted">
          Connect the database and add at least one case to use preview mode.
        </p>
      </main>
    );
  }

  return (
    <main>
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-2.5 text-sm">
          <span className="font-medium text-amber-900">Preview mode</span>
          <span className="text-amber-800">
            Nothing is saved and voice calls are skipped.
          </span>
          <span className="ml-auto flex items-center gap-2 text-amber-800">
            Case:
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/preview?profile=${c.id}`}
                className={
                  c.id === patient.id ? "font-semibold text-amber-900 underline" : "hover:underline"
                }
              >
                {c.name}
              </Link>
            ))}
          </span>
        </div>
      </div>

      <Flow
        token="preview"
        candidateName="Preview"
        patientName={patient.name}
        initialStage={assessment?.briefEnabled === false ? "call_1" : "brief"}
        initialMaxStage={assessment?.briefEnabled === false ? "call_1" : "brief"}
        initialChat={[]}
        brief={assessment?.briefEnabled ? brief : []}
        briefEnabled={assessment?.briefEnabled ?? true}
        plan={null}
        treatments={treatments}
        doctor={{
          text: patient.doctorIndication,
          value: patient.doctorPlanValue,
          currency: patient.doctorPlanCurrency,
        }}
        preview
        previewPhotos={patient.photos}
      />
    </main>
  );
}
