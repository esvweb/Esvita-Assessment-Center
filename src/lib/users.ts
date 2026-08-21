import { sql } from "./db";
import type { Role } from "./auth";

export interface HrUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export async function findUserByUsername(username: string): Promise<HrUser | null> {
  const db = sql();
  const rows = await db`
    select * from users where lower(username) = lower(${username.trim()}) limit 1`;
  return (rows[0] as HrUser) ?? null;
}

export async function findUserByEmail(email: string): Promise<HrUser | null> {
  const db = sql();
  const rows = await db`
    select * from users where lower(email) = lower(${email.trim()}) limit 1`;
  return (rows[0] as HrUser) ?? null;
}

export async function listUsers(): Promise<HrUser[]> {
  const db = sql();
  return (await db`select * from users order by created_at asc`) as HrUser[];
}

export async function createUser(input: {
  username: string;
  email: string;
  role?: Role;
}): Promise<HrUser> {
  const db = sql();
  const rows = await db`
    insert into users (username, email, role)
    values (${input.username.trim()}, ${input.email.trim().toLowerCase()}, ${input.role ?? "moderator"})
    returning *`;
  return rows[0] as HrUser;
}

/** Renames a user, changes their address or their role. */
export async function updateUser(
  id: string,
  input: { username?: string; email?: string; role?: Role },
): Promise<HrUser | null> {
  const db = sql();
  const rows = await db`
    update users set
      username = coalesce(${input.username?.trim() ?? null}, username),
      email    = coalesce(${input.email?.trim().toLowerCase() ?? null}, email),
      role     = coalesce(${input.role ?? null}, role)
    where id = ${id}
    returning *`;
  return (rows[0] as HrUser) ?? null;
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  const db = sql();
  await db`update users set is_active = ${active} where id = ${id}`;
}

export async function deleteUser(id: string): Promise<void> {
  const db = sql();
  await db`delete from users where id = ${id}`;
}

export async function touchLogin(id: string): Promise<void> {
  const db = sql();
  await db`update users set last_login = now() where id = ${id}`;
}
