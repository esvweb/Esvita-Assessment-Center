import { isAdmin } from "@/lib/auth";
import { errorResponse, HttpError } from "@/lib/session";
import { createUser, deleteUser, listUsers, setUserActive } from "@/lib/users";

async function requireAdmin() {
  if (!(await isAdmin())) throw new HttpError(403, "This action requires admin access");
}

export async function GET() {
  try {
    await requireAdmin();
    return Response.json({ users: await listUsers() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { username, email, role } = (await req.json()) as {
      username?: string;
      email?: string;
      role?: "admin" | "member";
    };

    if (!username?.trim()) throw new HttpError(400, "A username is required");
    if (!email?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      throw new HttpError(400, "A valid email address is required");
    }

    try {
      const user = await createUser({ username, email, role: role ?? "member" });
      return Response.json({ user });
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message.includes("duplicate") || message.includes("unique")) {
        throw new HttpError(409, "That username is already taken");
      }
      throw e;
    }
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const { id, is_active } = (await req.json()) as { id?: string; is_active?: boolean };
    if (!id || typeof is_active !== "boolean") throw new HttpError(400, "id and is_active are required");
    await setUserActive(id, is_active);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const { id } = (await req.json()) as { id?: string };
    if (!id) throw new HttpError(400, "id is required");
    await deleteUser(id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
