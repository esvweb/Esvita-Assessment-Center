import { isDatabaseReady } from "@/lib/config";
import { sendLoginCode } from "@/lib/mailer";
import { OtpError, issueCode } from "@/lib/otp";
import { errorResponse, HttpError } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

/** Emails a one-time login code to the address registered for this username. */
export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const address = email?.trim();
    if (!address) throw new HttpError(400, "An email address is required");
    if (!isDatabaseReady()) {
      throw new HttpError(503, "User sign-in requires a database connection.");
    }

    const user = await findUserByEmail(address);

    // Told plainly rather than vaguely. This does let someone test whether an
    // address is registered, which is an accepted trade: the panel serves a
    // handful of named colleagues, and a silent non-answer sends people hunting
    // through spam folders for a code that was never sent.
    if (!user || !user.is_active) {
      throw new HttpError(403, "unauthorised");
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
