import { notFound } from "next/navigation";
import Flow from "@/components/Flow";
import { listBrief } from "@/lib/brief";
import { getCase } from "@/lib/cases";
import { defaultAssessment, getAssessment } from "@/lib/assessments";
import { getSessionByToken, getTranscript } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AssessmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSessionByToken(token);
  if (!session) notFound();

  const assessment = session.assessment_id
    ? await getAssessment(session.assessment_id)
    : await defaultAssessment();
  const [patient, brief, transcript] = await Promise.all([
    getCase(session.profile_id),
    assessment ? listBrief(assessment.id) : Promise.resolve([]),
    getTranscript(session.id),
  ]);
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
        doctor={{
          text: patient?.doctorIndication ?? null,
          value: patient?.doctorPlanValue ?? null,
          currency: patient?.doctorPlanCurrency ?? "EUR",
        }}
      />
    </main>
  );
}
