import { currentUser, isSignedIn } from "@/lib/auth";
import { listRubricVersions, saveRubric } from "@/lib/rubric";
import { errorResponse, HttpError } from "@/lib/session";

async function requireLogin() {
  if (!(await isSignedIn())) throw new HttpError(401, "You need to sign in");
}

export async function GET(req: Request) {
  try {
    await requireLogin();
    const assessmentId = new URL(req.url).searchParams.get("assessmentId");
    if (!assessmentId) throw new HttpError(400, "assessmentId is required");
    return Response.json({ versions: await listRubricVersions(assessmentId) });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Saving appends a new version rather than editing in place. Nothing is ever
 * overwritten or deleted, so every past edition stays auditable — which matters
 * because reports are graded against whichever version was active at the time.
 */
export async function POST(req: Request) {
  try {
    await requireLogin();
    const me = await currentUser();
    const { assessmentId, criteria, instructions, note } = (await req.json()) as {
      assessmentId?: string;
      criteria?: { key: string; label: string; description: string }[];
      instructions?: string;
      note?: string;
    };

    if (!assessmentId) throw new HttpError(400, "assessmentId is required");
    if (!Array.isArray(criteria) || criteria.length === 0) {
      throw new HttpError(400, "At least one criterion is required");
    }
    for (const c of criteria) {
      if (!/^[a-z][a-z0-9_]*$/.test(c.key ?? "")) {
        throw new HttpError(
          400,
          `Invalid criterion key: "${c.key}" — use lowercase letters, digits and underscores`,
        );
      }
      if (!c.label?.trim()) throw new HttpError(400, `A label is required for "${c.key}"`);
    }
    const keys = criteria.map((c) => c.key);
    if (new Set(keys).size !== keys.length) throw new HttpError(400, "Criterion keys must be unique");

    const version = await saveRubric({
      assessmentId,
      criteria,
      instructions: instructions ?? "",
      note: note ?? "",
      createdBy: me?.username ?? "",
    });
    return Response.json({ version });
  } catch (err) {
    return errorResponse(err);
  }
}
