import { notFound } from "next/navigation";
import Flow from "@/components/Flow";
import { listBrief } from "@/lib/brief";
import { getCase } from "@/lib/cases";
import { defaultAssessment, getAssessment } from "@/lib/assessments";
import { getSessionByToken, getTranscript } from "@/lib/db";
import { listTreatments } from "@/lib/treatments";
import { priceDoctorPlan } from "@/lib/upsell";

export const dynamic = "force-dynamic";

export default async function AssessmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSessionByToken(token);
  if (!session) notFound();

  const assessment = session.assessment_id
    ? await getAssessment(session.assessment_id)
    : await defaultAssessment();
  const [patient, brief, transcript, catalogue] = await Promise.all([
    getCase(session.profile_id),
    assessment ? listBrief(assessment.id) : Promise.resolve([]),
    getTranscript(session.id),
    // Hidden lines too, so a dentist's plan that uses one is still priced.
    assessment ? listTreatments(assessment.id, true) : Promise.resolve([]),
  ]);
  const doctorPlan =
    patient && patient.doctorPlanItems.length ? priceDoctorPlan(patient.doctorPlanItems, catalogue) : null;
  const briefEnabled = assessment?.briefEnabled ?? true;

  const initialChat = transcript
    .filter((e) => e.channel === "chat" && e.speaker !== "system")
    .map((e) => ({
      speaker: e.speaker as "candidate" | "patient",
      text: e.text,
      attachments: (e.attachments as string[] | undefined) ?? undefined,
    }));

  return (
    <main>
      <Flow
        token={token}
        candidateName={session.candidate_name}
        patientName={patient?.name ?? "the patient"}
        initialStage={session.stage}
        initialMaxStage={session.max_stage ?? session.stage}
        initialChat={initialChat}
        brief={briefEnabled ? brief : []}
        briefEnabled={briefEnabled}
        plan={session.plan}
        treatments={catalogue.filter((t) => t.isActive)}
        doctor={{
          text: patient?.doctorIndication ?? null,
          value: doctorPlan?.total ?? patient?.doctorPlanValue ?? null,
          currency: doctorPlan?.currency ?? patient?.doctorPlanCurrency ?? "EUR",
        }}
      />
    </main>
  );
}
