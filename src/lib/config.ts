/** Which external services are wired up. Used to degrade the UI helpfully
 *  instead of throwing when a key is still missing during setup. */
export interface ServiceStatus {
  key: string;
  label: string;
  ready: boolean;
  hint: string;
}

export function serviceStatus(): ServiceStatus[] {
  return [
    {
      key: "database",
      label: "Neon (database)",
      ready: Boolean(process.env.DATABASE_URL),
      hint: "DATABASE_URL · then run db/schema.sql in the Neon SQL editor",
    },
    {
      key: "vapi",
      label: "Vapi (voice)",
      ready: Boolean(
        process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY && process.env.VAPI_PRIVATE_KEY,
      ),
      hint: "NEXT_PUBLIC_VAPI_PUBLIC_KEY + VAPI_PRIVATE_KEY",
    },
    {
      key: "mail",
      label: "Brevo (sign-in code emails)",
      ready: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      hint: "SMTP_HOST + SMTP_USER + SMTP_PASS + MAIL_FROM",
    },
    {
      key: "openai",
      label: "OpenAI (messaging + report)",
      ready: Boolean(process.env.OPENAI_API_KEY),
      hint: "OPENAI_API_KEY",
    },
  ];
}

export function isDatabaseReady(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
