import { isSignedIn } from "@/lib/auth";
import { deleteSection, updateSection } from "@/lib/brief";
import { errorResponse, HttpError } from "@/lib/session";

async function requireLogin() {
  if (!(await isSignedIn())) throw new HttpError(401, "You need to sign in");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireLogin();
    const updated = await updateSection((await params).id, await req.json());
    if (!updated) throw new HttpError(404, "Section not found");
    return Response.json({ section: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireLogin();
    await deleteSection((await params).id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
