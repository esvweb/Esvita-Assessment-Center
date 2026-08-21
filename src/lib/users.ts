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
    values (${input.username.trim()}, ${input.email.trim().toLowerCase()}, ${input.role ?? "member"})
    returning *`;
  return rows[0] as HrUser;
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
