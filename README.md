# Esvita Clinic — Candidate Assessment Platform

A multi-stage, roleplay-based assessment for the Senior Medical Advisor / Sales
Consultant role. A candidate opens a private link and is taken through:

| Stage | What happens |
|---|---|
| **1. Briefing** | The candidate reads the clinic knowledge base — prices, packages, timelines, guarantee, booking terms. They arrive knowing nothing about Esvita, so this is where they learn it. |
| **2. Voice call 1** | The candidate **rings the patient** — an outbound cold call. The patient is not expecting it and does not recognise the number; they just pick up and wait. Introducing themselves and earning the conversation is the candidate's job. Discovery only; the call ends when they ask for photos. |
| **3. Messaging** | WhatsApp-style chat with the same patient. When the candidate asks for photos, the patient actually sends the case photos. |
| **4. Treatment plan** | The candidate builds and sends a written plan: treatments, quantities, price, trip length, guarantee, next step. |
| **5. Voice call 2** | The patient calls back having read the plan. Technical Q&A, a chained objection sequence, and a close attempt. |
| **6. Report** | A separate grading pass scores the whole session against seven criteria and writes an HR report. |

The patient is the *same character* throughout — one persona prompt drives both
the voice agent and the chat agent, and each stage receives the transcript of
everything that came before.

From call 1 onward the clinic facts stay in a panel beside the candidate, and on
call 2 that panel also holds the deal they proposed. Every stage can be stepped
back to: clicking past a call or the chat by accident does not lose it.

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind v4
- **Vapi** — browser voice calls. Assistants are minted **server-side** per call so
  the persona prompt, hidden signals and objection chain never reach the browser.
- **OpenAI** (`openai`, Chat Completions) — the messaging patient and the evaluation
  grader. The voice layer runs on OpenAI through Vapi too, so the whole system is
  one LLM provider.
- **Neon** (serverless Postgres, `@neondatabase/serverless`) — sessions, unified
  transcript, users, reports. Queries are tagged templates, so every value is a
  bound parameter.

## Setup

```bash
npm install
npm run dev
```

A `.env.local` is already present with a working admin account, so you can sign
in straight away. Everything else starts blank; fill each key in as you connect
the service.

### Reviewing the UI before anything is wired up

Open **`/preview`** to walk every candidate-facing screen with no backend at all.
Voice calls are skipped, the patient's chat replies are faked locally (ask for
photos and the real photo bubbles appear), and nothing is saved. Use the persona
switcher in the top bar to see the flow for each of the seven profiles.

`/admin` also works with only the admin account set — it shows a setup checklist
instead of failing when the database is not connected yet. (Adding panel users
needs Neon, since that is where the user list lives.)

### 1. Neon

Create a project, copy the **pooled** connection string into `DATABASE_URL`, then
apply the schema:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

(or paste the file into Neon's SQL editor). Only the server ever connects, so
there is no row-level security to configure.

To check the schema and the trickier queries without a database:

```bash
npm run db:verify
```

That applies `db/schema.sql` to an in-process Postgres and exercises the bulk
transcript insert, the OTP interval windows, the reports upsert and the dashboard
join.

Then load the starting content — the seven cases with their photos, and the
clinic briefing:

```bash
npm run db:seed
```

### 2. Vapi

From the Vapi dashboard take the **public** key (browser) and the **private** key
(server). You do not need to create any assistants by hand — the app creates a
throwaway assistant per call and deletes it afterwards.

Voices are set per persona in `src/lib/personas.ts` (`voice.voiceId`, ElevenLabs).
Swap in cloned voices there when you want stronger accents.

### 3. OpenAI

Set `OPENAI_API_KEY`. Models are configurable per role, since the two jobs have
opposite priorities:

| Variable | Default | Why |
|---|---|---|
| `OPENAI_CHAT_MODEL` | `gpt-5.4` | The messaging patient — short turns, so latency matters |
| `OPENAI_REPORT_MODEL` | `gpt-5.5` | The grader — one long, judgement-heavy call per session |
| `VAPI_VOICE_MODEL` | `gpt-4.1` | Drives the patient during voice calls; must be a model Vapi supports |

One model constraint worth knowing: on the gpt-5 series, Chat Completions
rejects function tools combined with a reasoning effort. The messaging patient
uses a tool (`send_photos`), so that call runs with `reasoning_effort: "none"` —
which is the right setting anyway for short, in-character replies where latency
is what the candidate feels. The grader has no tools and runs at `high`.

The grader uses structured outputs (`json_schema`, strict) so the report always
comes back with the seven scores, the outcome and the hire signal as typed
fields — the Markdown is one field among them, not something that has to be
parsed back out.

### 4. Panel access

Two ways into `/admin`:

- **Admin** — username and password from the environment (`ADMIN_USERNAME` /
  `ADMIN_PASSWORD`). No code, and no
  database needed, so an administrator can sign in while Neon is still being
  set up.
- **Everyone else** — the admin adds them in the panel with a username and email.
  They enter their username, press **Giriş kodu gönder**, and a 6-digit code is
  emailed to them. Codes are stored hashed, expire after 10 minutes, are
  single-use, allow 5 attempts, and are rate limited to 5 per 15 minutes.

Sessions are stateless HMAC-signed cookies (`AUTH_SECRET`), valid 12 hours.
Changing `AUTH_SECRET` signs everyone out.

**Email delivery** uses [Resend](https://resend.com): set `RESEND_API_KEY` and
`MAIL_FROM`. Until you do, codes are written to the **server log** instead, so
the flow is testable without an email provider — the login screen says so when
that happens. Codes are never returned to the browser.

Inside the panel you create candidate invitations. Choose a persona explicitly,
or leave it on *auto* to rotate profiles evenly across candidates so results stay
comparable.

## Assessments

Everything content-related hangs off an **assessment**. The one that ships is
**Esvita Dental V1**; creating a second (hair transplant, say) from
`/admin/assessments` gives it its own cases, its own clinic briefing and its own
grading rubric, with no effect on the first. Each candidate invitation picks an
assessment, and the session remembers which one it ran on.

### Duplicating an assessment

**Kopyala** on `/admin/assessments` copies every case (with its photos and the
dentist's indication), every briefing section, and the active rubric as the
copy's v1. Sessions and reports are not copied — they belong to the original run.
The copy is fully independent from the moment it exists; editing one never
touches the other.

This is how variants are made: duplicate the dental assessment, rename it
"Esvita Dental Sr V1", and tune the copy.

### Withholding the briefing

Each assessment has a **"Şirket bilgileri adaya gösterilsin"** switch. Turn it off
and the candidate never sees the briefing stage or the reference panel — they go
straight into the outbound call with nothing to look up.

The patient and the grader still know the clinic's real facts; only the candidate
doesn't. The grader is told explicitly not to penalise missing figures, and to
judge instead how the candidate handled not knowing — staying credible, promising
to confirm rather than inventing a number, and still moving the patient forward.
Inventing a confident wrong figure scores worse than saying they will check.

Use it to separate juniors (who need the crib sheet) from seniors (who should be
able to carry the conversation without one).

## Grading rubric — versioned, append-only

`/admin/assessments/<id>/rubric` holds the criteria the report is scored against
and the instructions the grader follows. Both are editable.

Saving **never overwrites**. Each save appends a new version that becomes active;
every earlier edition stays below it, readable forever, and can be loaded back
into the editor as the basis for a new version. Reports record the version that
produced them, so a score from six months ago can still be explained by the
criteria that were in force at the time.

The criteria drive the report's JSON schema, so adding or removing one changes
the scores the model returns — no code change needed. The legal disclaimer is
held in code and appended to every report, so it cannot be edited away.

## Editing the content

The two things that change most often are edited in the panel, not in code:

- **`/admin/assessments/<id>/cases`** — the patient cases. Basic details, the pieces the persona
  prompt is assembled from (situation, personality, case plan, hidden signals,
  objection chain, technical banks, special rule, free-form extra prompt), the
  voice, and the photos the patient sends when asked. Photos are uploaded and
  stored in Postgres, so they work identically on Vercel, whose filesystem is
  read-only at runtime.
- **`/admin/assessments/<id>/brief`** — the clinic briefing. Add, edit, reorder or delete
  sections. This is what the candidate reads before the first call, what stays in
  the panel beside them, and what the grader checks their answers against.

A case that has already been used by a session is deactivated rather than
deleted, so finished reports keep their context.

`src/lib/personas.ts` and `src/lib/company.ts` are now **seed data only** —
`npm run db:seed` loads them into the database on first run. The app never reads
them at runtime.

⚠️ Every price, timeline and guarantee term in the seeded briefing is invented
placeholder data. Replace it in the panel before running a real assessment:
the technical scoring is only as accurate as that content. The seeded case photos
are labelled placeholders too — replace them in the cases tab.

## Why Vapi, and how context survives across stages

Vapi is doing one job here: browser voice with turn-taking. Endpointing, barge-in
and echo cancellation are the hard part of voice, and they are load-bearing for
this assessment — the patient is meant to interrupt a rambling candidate and cool
off under pressure, which a request/response STT→LLM→TTS chain cannot express.
It also records the calls, which HR needs for tone and pacing.

Context is **not** a fixed prompt. Before each call, `/api/voice` rebuilds the
persona prompt from the live session — everything said so far on every channel,
plus the treatment plan the candidate submitted — and mints a throwaway Vapi
assistant with it, deleting it when the call ends. So the patient walks into call
2 remembering call 1, the chat, the photos they sent and the plan they were
given, and reacts if the candidate contradicts themselves.

If voice ever needs to leave Vapi, the blast radius is `src/lib/vapi.ts`,
`src/components/VoiceCall.tsx` and `src/app/api/voice/route.ts` — the persona,
prompt and transcript layers are provider-agnostic by design.

## Reviewing a session

`/admin/sessions/<id>` shows the report, the plan the candidate sent, and the
session itself split into three panels — call 1, the messaging stage, call 2 —
open by default and collapsible. Each call's recording sits inside its own panel,
and the messaging stage is replayed as the chat it was, photos included, rather
than as a flat log.

## Call recordings

Recording is enabled per call (`artifactPlan.recordingEnabled`). The HR session
page fetches the recording URL from Vapi on view rather than storing it, because
those URLs are signed and expire; the private key never leaves the server.

Candidates are told before they accept the call, and again in the briefing
checkbox, that the call is recorded and transcribed. Set a retention period that
matches your obligations — recordings live in Vapi, not in this database.

## How transcripts are captured

The browser streams final transcript turns during the call and saves them when it
ends, which is what makes local development work without a public URL. In
production, set `NEXT_PUBLIC_APP_URL` to your deployed origin and the app also
registers `/api/vapi/webhook` on each assistant — so if a candidate's tab crashes
mid-call, Vapi's end-of-call report still lands in the database. The webhook skips
any call the browser already saved.

---

# Deploying to Vercel

## 1. Rotate every credential first

All of the keys currently in `.env.local` were shared over chat during setup.
Before this handles real candidates, reissue each one and use the new values in
Vercel — keep the old ones locally if you like, but nothing shared should reach
production.

| Credential | Where to reissue |
|---|---|
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `DATABASE_URL` | Neon → Roles → reset password |
| `VAPI_PRIVATE_KEY`, `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | Vapi dashboard → API Keys |
| `SMTP_PASS` | Brevo → SMTP & API → SMTP keys |
| `ADMIN_PASSWORD` | Pick a new one |
| `AUTH_SECRET` | Any long random string — `openssl rand -base64 48` |

## 2. Use a separate production database

The development database holds test sessions, transcripts and reports. Real
candidates should not land in the same tables. Neon branching is the cheapest
split: create a `production` branch, take its connection string, then

```bash
psql "$PRODUCTION_DATABASE_URL" -f db/schema.sql
DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run db:seed
```

The seed loads the seven cases with their photos, the briefing and a v1 rubric.
Content you have edited since — dentist indications, rubric versions — lives only
in the development branch, so copy anything you want to keep across, or branch
*from* development instead of creating an empty one.

## 3. Push and import

The project is not a git repository yet:

```bash
git init && git add -A && git commit -m "Esvita assessment platform"
```

Push to GitHub, then import the repo in Vercel. No build settings to change —
`npm run build` and the default output directory are correct.

## 4. Environment variables in Vercel

Set all seventeen. Two differ from local:

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Your real origin, e.g. `https://assessment.esvitaclinic.com` |
| `DATABASE_URL` | The production branch connection string |

Setting `NEXT_PUBLIC_APP_URL` to a non-localhost origin automatically registers
the Vapi webhook, so a candidate whose tab crashes mid-call still gets their
transcript saved. Set `VAPI_WEBHOOK_SECRET` to any random string and it will be
verified on every webhook call.

## 5. Vapi allowed origins

Add the production origin to the **public** key's Allowed Origins in the Vapi
dashboard. Without it, calls fail with `Key doesn't allow origin`. Leave the
private key's origins empty — it is used server to server and sends no `Origin`.

## 6. Email deliverability

Brevo accepts the sender, but candidates' and reviewers' mail providers judge it
separately. Add Brevo's **SPF** and **DKIM** records for `esvitaclinic.com` in
your DNS, or sign-in codes will land in spam for exactly the corporate inboxes
that matter.

## 7. Smoke test after the first deploy

1. Sign in at `/admin` with the admin account.
2. Add an HR user and have them request a code — confirms SMTP and DNS.
3. Create an invitation and open the candidate link.
4. Take the first call to the point where audio flows both ways, then end it.
5. Open the session in `/admin` and confirm the transcript and the recording.

Step 4 is the one that exercises everything at once: Vapi keys, allowed origins,
the server-side assistant, and the transcript write.
