import { currentUser } from "@/lib/auth";
import { ASSIGNABLE_ROLES, requirePermission } from "@/lib/permissions";
import { errorResponse, HttpError } from "@/lib/session";
import { createUser, deleteUser, listUsers, setUserActive, updateUser } from "@/lib/users";

const requireAdmin = () => requirePermission("manageUsers");

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
      role?: string;
    };
    // superadmin is the environment account and can never be handed out here.
    const assigned = ASSIGNABLE_ROLES.find((r) => r === role) ?? "moderator";

    if (!username?.trim()) throw new HttpError(400, "A username is required");
    if (!email?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      throw new HttpError(400, "A valid email address is required");
    }

    try {
      const user = await createUser({ username, email, role: assigned });
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
    const me = await currentUser();
    const { id, is_active, username, email, role } = (await req.json()) as {
      id?: string;
      is_active?: boolean;
      username?: string;
      email?: string;
      role?: string;
    };
    if (!id) throw new HttpError(400, "id is required");

    if (typeof is_active === "boolean") {
      // Deactivating yourself locks you out of the panel you are standing in.
      const target = (await listUsers()).find((u) => u.id === id);
      if (!is_active && target && target.username === me?.username) {
        throw new HttpError(400, "You cannot deactivate your own account");
      }
      await setUserActive(id, is_active);
      return Response.json({ ok: true });
    }

    if (email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      throw new HttpError(400, "A valid email address is required");
    }
    if (username !== undefined && !username.trim()) {
      throw new HttpError(400, "A username is required");
    }

    try {
      const updated = await updateUser(id, {
        username,
        email,
        role: ASSIGNABLE_ROLES.find((r) => r === role),
      });
      if (!updated) throw new HttpError(404, "User not found");
      return Response.json({ user: updated });
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
