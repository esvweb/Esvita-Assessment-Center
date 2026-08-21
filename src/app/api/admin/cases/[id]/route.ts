import { requirePermission } from "@/lib/permissions";
import { deleteCase, getCase, updateCase } from "@/lib/cases";
import { sql } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/session";

const requireLogin = () => requirePermission("editContent");

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new HttpError(400, "Invalid case id");
  return id;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireLogin();
    const found = await getCase(parseId((await params).id));
    if (!found) throw new HttpError(404, "Case not found");
    return Response.json({ case: found });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireLogin();
    const updated = await updateCase(parseId((await params).id), await req.json());
    if (!updated) throw new HttpError(404, "Case not found");
    return Response.json({ case: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("destroy");
    const id = parseId((await params).id);

    // Sessions reference the case they were run against, and their reports quote
    // it. Deleting one out from under a finished assessment would strand it, so
    // deactivate instead once it has been used.
    const used = (await sql()`select count(*)::int as n from sessions where profile_id = ${id}`)[0] as {
      n: number;
    };
    if (used.n > 0) {
      await updateCase(id, { isActive: false });
      return Response.json({
        ok: true,
        deactivated: true,
        message: `This case has been used in ${used.n} session(s), so it was deactivated rather than deleted. It will not be assigned to new candidates, and past reports keep their context.`,
      });
    }

    await deleteCase(id);
    return Response.json({ ok: true, deactivated: false });
  } catch (err) {
    return errorResponse(err);
  }
}
