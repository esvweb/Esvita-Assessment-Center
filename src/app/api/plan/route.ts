import { appendTranscript, savePlan } from "@/lib/db";
import { errorResponse, requireSession, HttpError } from "@/lib/session";
import type { TreatmentPlan } from "@/lib/types";

/** The candidate sends the written treatment plan to the patient. */
export async function POST(req: Request) {
  try {
    const { token, plan } = (await req.json()) as { token?: string; plan?: TreatmentPlan };
    const session = await requireSession(token);

    if (session.stage !== "plan") {
      throw new HttpError(409, `The plan step is not open at the "${session.stage}" stage`);
    }
    if (!plan || typeof plan.summary !== "string" || !Array.isArray(plan.items)) {
      throw new HttpError(400, "Malformed treatment plan");
    }
    if (!plan.summary.trim() || plan.items.length === 0) {
      throw new HttpError(400, "The plan needs a summary and at least one treatment item");
    }

    await savePlan(session.id, plan);

    const rendered = [
      `TREATMENT PLAN SENT TO PATIENT`,
      ``,
      plan.summary,
      ``,
      ...plan.items.map((i) => `• ${i.treatment} × ${i.quantity}${i.note ? ` — ${i.note}` : ""}`),
      ``,
      `Total: ${plan.total_price} ${plan.currency}`,
      `Trip: ${plan.trip_days} days across ${plan.visits} visit(s)`,
      `Guarantee: ${plan.guarantee}`,
      `Included: ${plan.included}`,
      `Next step proposed: ${plan.next_step}`,
    ].join("\n");

    await appendTranscript([
      { session_id: session.id, channel: "chat", speaker: "candidate", text: rendered },
    ]);

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
