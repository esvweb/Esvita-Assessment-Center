/**
 * Roles and what each one may do.
 *
 * Deliberately free of server-only imports so client components can render
 * role labels and hide controls without pulling `next/headers` into the browser
 * bundle. Enforcement lives in `permissions.ts`, which runs on the server.
 */

/**
 * `superadmin` exists only in the environment — it is never stored in the users
 * table and never listed in the panel, so administrators cannot see or remove
 * the account that can recover the system.
 */
export type Role = "superadmin" | "admin" | "moderator";

export const ROLES: Role[] = ["superadmin", "admin", "moderator"];

export interface Permissions {
  /** Create and edit assessments, cases, briefing sections and rubrics. */
  editContent: boolean;
  /** Invite candidates and generate reports. */
  runAssessments: boolean;
  /** Delete assessments, cases, sections, sessions and reports. */
  destroy: boolean;
  /** Add, deactivate and remove panel users. */
  manageUsers: boolean;
}

/**
 * Moderators build and run assessments; they cannot destroy anything. Deleting
 * a case, a session or a report throws away evidence a hiring decision may rest
 * on, so it stays with administrators.
 */
export function permissionsFor(role: Role): Permissions {
  switch (role) {
    case "superadmin":
    case "admin":
      return { editContent: true, runAssessments: true, destroy: true, manageUsers: true };
    case "moderator":
      return { editContent: true, runAssessments: true, destroy: false, manageUsers: false };
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Superadmin",
  admin: "Administrator",
  moderator: "Moderator",
};

/** Roles an administrator is allowed to hand out — superadmin is not one of them. */
export const ASSIGNABLE_ROLES: Role[] = ["admin", "moderator"];
