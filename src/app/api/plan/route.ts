import { appendTranscript, savePlan } from "@/lib/db";
import { assessmentIdFor, errorResponse, requireSession, HttpError } from "@/lib/session";
import { listTreatments } from "@/lib/treatments";
import type { TreatmentPlan } from "@/lib/types";

const num = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

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

    // The floor is re-read from the catalogue rather than trusted from the
    // request: the candidate's quote is scored, so the one number they must not
    // be able to talk the form out of cannot be enforced in the browser alone.
    const catalogue = await listTreatments(await assessmentIdFor(session));
    const floors = new Map(catalogue.map((t) => [t.name, t]));

    const priced = plan.items.map((item) => {
      const t = floors.get(item.treatment);
      if (!t) return item;
      const quoted = num(item.unit_price);
      if (quoted < t.minPrice) {
        throw new HttpError(
          400,
          `"${t.name}" is priced below the minimum of ${t.minPrice} ${t.currency}`,
        );
      }
      return { ...item, min_price: String(t.minPrice) };
    });

    const total = priced.reduce((sum, i) => sum + num(i.quantity) * num(i.unit_price), 0);
    const stored: TreatmentPlan = { ...plan, items: priced, total_price: String(total) };

    await savePlan(session.id, stored);

    const lineText = (i: TreatmentPlan["items"][number]) => {
      const price = i.unit_price ? ` — ${i.unit_price} ${stored.currency} each` : "";
      const note = i.note ? ` (${i.note})` : "";
      return `• ${i.treatment} × ${i.quantity}${price}${note}`;
    };

    const rendered = [
      `TREATMENT PLAN SENT TO PATIENT`,
      ``,
      stored.summary,
      ``,
      ...priced.map(lineText),
      ``,
      `Total: ${stored.total_price} ${stored.currency}`,
      `Trip: ${stored.trip_days} days across ${stored.visits} visit(s)`,
      `Guarantee: ${stored.guarantee}`,
      `Included: ${stored.included}`,
      `Next step proposed: ${stored.next_step}`,
    ].join("\n");

    await appendTranscript([
      { session_id: session.id, channel: "chat", speaker: "candidate", text: rendered },
    ]);

    return Response.json({ ok: true, total: stored.total_price });
  } catch (err) {
    return errorResponse(err);
  }
}
