import { currentUser } from "./auth";
import { permissionsFor, type Permissions } from "./roles";
import { HttpError } from "./session";

export { ASSIGNABLE_ROLES, ROLE_LABELS, permissionsFor } from "./roles";
export type { Permissions, Role } from "./roles";

/** Server-side gate. Throws rather than returning false, so a route cannot forget to check. */
export async function requirePermission(key: keyof Permissions): Promise<void> {
  const me = await currentUser();
  if (!me) throw new HttpError(401, "You need to sign in");
  if (!permissionsFor(me.role)[key]) {
    throw new HttpError(403, "Your role does not allow this action");
  }
}

export async function myPermissions(): Promise<Permissions | null> {
  const me = await currentUser();
  return me ? permissionsFor(me.role) : null;
}
