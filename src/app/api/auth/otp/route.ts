import { adminUsername } from "@/lib/auth";
import { isDatabaseReady } from "@/lib/config";
import { mailConfigured, sendLoginCode } from "@/lib/mailer";
import { OtpError, issueCode } from "@/lib/otp";
import { errorResponse, HttpError } from "@/lib/session";
import { findUserByUsername } from "@/lib/users";

/** Emails a one-time login code to the address registered for this username. */
export async function POST(req: Request) {
  try {
    const { username } = (await req.json()) as { username?: string };
    const name = username?.trim();
    if (!name) throw new HttpError(400, "A username is required");

    if (name.toLowerCase() === adminUsername().toLowerCase()) {
      throw new HttpError(400, "The admin account does not use codes — sign in with its password.");
    }
    if (!isDatabaseReady()) {
      throw new HttpError(503, "User sign-in requires a database connection.");
    }

    const user = await findUserByUsername(name);

    // A configured mail provider means this is live: stay vague so the endpoint
    // cannot be used to enumerate accounts. Before that, during setup, say
    // plainly that the username is unknown — otherwise a typo looks like a
    // silent failure.
    const live = mailConfigured();
    if (!user || !user.is_active) {
      if (live) return Response.json({ ok: true, sent: true, fallbackToLog: false });
      throw new HttpError(404, `No active user named "${name}".`);
    }

    let code: string;
    try {
      code = await issueCode(user.id);
    } catch (e) {
      if (e instanceof OtpError) throw new HttpError(e.status, e.message);
      throw e;
    }

    const result = await sendLoginCode(user.email, user.username, code);

    return Response.json({
      ok: true,
      sent: true,
      fallbackToLog: result.fallbackToLog,
      maskedEmail: maskEmail(user.email),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}
