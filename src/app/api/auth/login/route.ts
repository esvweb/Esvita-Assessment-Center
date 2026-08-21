import {
  adminUsername,
  safeEqual,
  sessionCookieHeader,
  signSession,
  type Role,
} from "@/lib/auth";
import { isDatabaseReady } from "@/lib/config";
import { OtpError, verifyCode } from "@/lib/otp";
import { errorResponse, HttpError } from "@/lib/session";
import { findUserByUsername, touchLogin } from "@/lib/users";

/**
 * Two ways in:
 *   • the admin account — username + password from the environment, no code
 *   • everyone else — username + the one-time code emailed to them
 */
export async function POST(req: Request) {
  try {
    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };

    const name = username?.trim();
    const secret = password?.trim();
    if (!name || !secret) throw new HttpError(400, "Username and password are required");

    let role: Role;

    if (name.toLowerCase() === adminUsername().toLowerCase()) {
      const expected = process.env.ADMIN_PASSWORD;
      if (!expected) throw new HttpError(500, "ADMIN_PASSWORD is not configured");
      if (!safeEqual(secret, expected)) throw new HttpError(401, "Incorrect username or password");
      role = "admin";
    } else {
      if (!isDatabaseReady()) {
        throw new HttpError(
          503,
          "User sign-in requires a database connection. Sign in with the admin account instead.",
        );
      }
      const user = await findUserByUsername(name);
      if (!user || !user.is_active) throw new HttpError(401, "Incorrect username or code");

      try {
        await verifyCode(user.id, secret);
      } catch (e) {
        if (e instanceof OtpError) throw new HttpError(e.status, e.message);
        throw e;
      }

      await touchLogin(user.id);
      role = user.role;
    }

    const token = signSession({ username: name, role });
    return new Response(JSON.stringify({ ok: true, role }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookieHeader(token) },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
