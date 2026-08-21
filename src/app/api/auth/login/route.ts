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
import { findUserByEmail, findUserByUsername, touchLogin } from "@/lib/users";

/**
 * Staff sign-in.
 *
 * The normal route is an email address plus the one-time code sent to it. The
 * environment's admin username and password still work as a break-glass path, so
 * an email outage cannot lock everybody out of their own hiring tool.
 */
export async function POST(req: Request) {
  try {
    const { username, email, password, code } = (await req.json()) as {
      username?: string;
      email?: string;
      password?: string;
      code?: string;
    };

    // Email + code is the normal path.
    if (email?.trim()) {
      if (!isDatabaseReady()) {
        throw new HttpError(503, "User sign-in requires a database connection.");
      }
      if (!code?.trim()) throw new HttpError(400, "Enter the code that was emailed to you");

      const user = await findUserByEmail(email.trim());
      if (!user || !user.is_active) throw new HttpError(401, "Incorrect address or code");

      try {
        await verifyCode(user.id, code.trim());
      } catch (e) {
        if (e instanceof OtpError) throw new HttpError(e.status, e.message);
        throw e;
      }

      await touchLogin(user.id);
      const token = signSession({ username: user.username, role: user.role });
      return new Response(JSON.stringify({ ok: true, role: user.role }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookieHeader(token) },
      });
    }

    const name = username?.trim();
    const secret = password?.trim();
    if (!name || !secret) throw new HttpError(400, "Username and password are required");

    let role: Role;

    if (name.toLowerCase() === adminUsername().toLowerCase()) {
      const expected = process.env.ADMIN_PASSWORD;
      if (!expected) throw new HttpError(500, "ADMIN_PASSWORD is not configured");
      if (!safeEqual(secret, expected)) throw new HttpError(401, "Incorrect username or password");
      role = "superadmin";
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
