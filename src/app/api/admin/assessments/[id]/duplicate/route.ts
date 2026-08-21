import { isSignedIn } from "@/lib/auth";
import { duplicateAssessment, getAssessment } from "@/lib/assessments";
import { errorResponse, HttpError } from "@/lib/session";

/** Copies an assessment's content so a variant can start from a working base. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSignedIn())) throw new HttpError(401, "You need to sign in");

    const { id } = await params;
    const source = await getAssessment(id);
    if (!source) throw new HttpError(404, "The assessment to copy was not found");

    const { name } = (await req.json().catch(() => ({}))) as { name?: string };
    const copy = await duplicateAssessment(id, name?.trim() || `${source.name} — kopya`);
    if (!copy) throw new HttpError(500, "Could not duplicate");

    return Response.json({ assessment: copy });
  } catch (err) {
    return errorResponse(err);
  }
}
