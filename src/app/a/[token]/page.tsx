import { notFound } from "next/navigation";
import Flow from "@/components/Flow";
import { listBrief } from "@/lib/brief";
import { getCase } from "@/lib/cases";
import { defaultAssessment, getAssessment } from "@/lib/assessments";
import { getSessionByToken, getTranscript } from "@/lib/db";
import { listTreatments } from "@/lib/treatments";

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
    assessment ? listTreatments(assessment.id) : Promise.resolve([]),
  ]);
  // A dental case is offered dental treatments only, a hair case hair ones.
  const specialty = patient?.specialty ?? "dental";
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
        treatments={catalogue.filter((t) => t.specialty === specialty)}
        pricingNotes={assessment?.pricingNotes ?? ""}
        doctor={{ text: patient?.doctorIndication ?? null }}
      />
    </main>
  );
}
