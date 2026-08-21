import { isSignedIn } from "@/lib/auth";
import { createSection, listBrief } from "@/lib/brief";
import { errorResponse, HttpError } from "@/lib/session";

async function requireLogin() {
  if (!(await isSignedIn())) throw new HttpError(401, "You need to sign in");
}

export async function GET(req: Request) {
  try {
    await requireLogin();
    const assessmentId = new URL(req.url).searchParams.get("assessmentId");
    if (!assessmentId) throw new HttpError(400, "assessmentId is required");
    return Response.json({ sections: await listBrief(assessmentId) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireLogin();
    const body = await req.json();
    if (!body?.assessmentId) throw new HttpError(400, "assessmentId is required");
    return Response.json({ section: await createSection(body.assessmentId, body) });
  } catch (err) {
    return errorResponse(err);
  }
}
