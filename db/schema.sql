-- Esvita candidate assessment — database schema
-- Run once against your Neon database (SQL editor, or: psql "$DATABASE_URL" -f db/schema.sql).
-- Access is server-side only through DATABASE_URL, so there is no row-level
-- security to configure — nothing else ever connects.

-- gen_random_uuid() is built into Postgres 13+, so no extension is needed.

-- One row per candidate invitation / assessment session.
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  token           text unique not null,
  candidate_name  text not null,
  candidate_email text,
  profile_id      int  not null,
  stage           text not null default 'brief',
  status          text not null default 'not_started',
  plan            jsonb,
  photos_requested boolean not null default false,
  -- Vapi call ids, so artifacts (recording, structured transcript) can be pulled later
  call_1_id       text,
  call_2_id       text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists sessions_token_idx on sessions (token);
create index if not exists sessions_created_idx on sessions (created_at desc);

-- Unified transcript: voice turns, chat messages and system events in one ordered log.
create table if not exists transcript (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  channel     text not null,            -- voice_1 | chat | voice_2 | system
  speaker     text not null,            -- candidate | patient | system
  text        text not null,
  attachments jsonb,                    -- array of public photo urls
  seq         bigserial,
  created_at  timestamptz not null default now()
);

create index if not exists transcript_session_idx on transcript (session_id, seq);

-- One evaluation report per session (regenerating replaces it).
create table if not exists reports (
  session_id   uuid primary key references sessions(id) on delete cascade,
  outcome      text,
  scores       jsonb,
  overall      numeric,
  hire_signal  text,
  markdown     text not null,
  model        text,
  created_at   timestamptz not null default now()
);

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sessions_touch on sessions;
create trigger sessions_touch before update on sessions
  for each row execute function touch_updated_at();


-- ---------------------------------------------------------------------------
-- HR users and one-time login codes
-- The admin account lives in the environment, not here, so an administrator can
-- still sign in while the database is being set up.
-- ---------------------------------------------------------------------------

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  username    text unique not null,
  email       text not null,
  role        text not null default 'member',
  is_active   boolean not null default true,
  last_login  timestamptz,
  created_at  timestamptz not null default now()
);

create unique index if not exists users_username_lower_idx on users (lower(username));

create table if not exists otp_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  attempts    int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists otp_user_idx on otp_codes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Editable content: patient cases and the clinic briefing
-- Both used to be hardcoded. They live here so HR can maintain them without a
-- deploy — the assessment content is the part that changes most often.
-- ---------------------------------------------------------------------------

create table if not exists cases (
  id              serial primary key,
  name            text not null,
  age             int,
  country         text,
  headline        text,
  -- The structured pieces the patient prompt is assembled from.
  situation       text,
  personality     text,
  case_plan       text,
  hidden_signals  text[] not null default '{}',
  objection_chain text[] not null default '{}',
  extra_questions text[] not null default '{}',
  technical_banks text[] not null default '{}',
  special_rule    text,
  -- Anything else to append verbatim to the patient prompt.
  extra_prompt    text,
  voice_id        text not null default 'matilda',
  accent          text,
  -- What the patient says when they pick up an unknown number.
  pickup_line     text not null default 'Hello?',
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists cases_touch on cases;
create trigger cases_touch before update on cases
  for each row execute function touch_updated_at();

-- Case photos live in the database rather than on disk: Vercel's filesystem is
-- read-only at runtime, and this keeps uploads working identically everywhere.
create table if not exists case_photos (
  id          uuid primary key default gen_random_uuid(),
  case_id     int not null references cases(id) on delete cascade,
  caption     text not null default '',
  mime_type   text not null,
  bytes       bytea not null,
  size_bytes  int not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists case_photos_case_idx on case_photos (case_id, sort_order);

create table if not exists brief_sections (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null default '',
  bullets     text[] not null default '{}',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists brief_touch on brief_sections;
create trigger brief_touch before update on brief_sections
  for each row execute function touch_updated_at();

-- Sessions remember the furthest stage reached, so a candidate can step back to
-- a call or the chat without losing it and then return.
alter table sessions add column if not exists max_stage text;

-- ---------------------------------------------------------------------------
-- Assessments
-- Everything content-related hangs off an assessment, so a second one (hair
-- transplant, say) gets its own cases, briefing and grading rubric without
-- touching the first.
-- ---------------------------------------------------------------------------

create table if not exists assessments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  description text not null default '',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists assessments_touch on assessments;
create trigger assessments_touch before update on assessments
  for each row execute function touch_updated_at();

-- The grading rubric, versioned. Saving never overwrites: a new row is appended
-- and becomes active, and every earlier edition stays readable forever.
create table if not exists rubric_versions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  version       int not null,
  criteria      jsonb not null default '[]',
  instructions  text not null default '',
  note          text not null default '',
  created_by    text not null default '',
  created_at    timestamptz not null default now(),
  unique (assessment_id, version)
);

create index if not exists rubric_assessment_idx on rubric_versions (assessment_id, version desc);

-- Existing content belongs to the first assessment.
alter table cases          add column if not exists assessment_id uuid references assessments(id) on delete cascade;
alter table brief_sections add column if not exists assessment_id uuid references assessments(id) on delete cascade;
alter table sessions       add column if not exists assessment_id uuid references assessments(id) on delete set null;
-- Which edition of the rubric produced a report, so old scores stay explainable.
alter table reports        add column if not exists rubric_version_id uuid references rubric_versions(id) on delete set null;

insert into assessments (name, slug, description)
select 'Esvita Dental V1', 'esvita-dental-v1',
       'Dental treatments — Senior Medical Advisor / Sales Consultant assessment.'
where not exists (select 1 from assessments);

update cases          set assessment_id = (select id from assessments order by created_at limit 1) where assessment_id is null;
update brief_sections set assessment_id = (select id from assessments order by created_at limit 1) where assessment_id is null;
update sessions       set assessment_id = (select id from assessments order by created_at limit 1) where assessment_id is null;

create index if not exists cases_assessment_idx on cases (assessment_id, sort_order);
create index if not exists brief_assessment_idx on brief_sections (assessment_id, sort_order);
create index if not exists sessions_assessment_idx on sessions (assessment_id, created_at desc);

-- ---------------------------------------------------------------------------
-- The treating dentist's indication for a case.
-- The candidate sees it while writing their plan, and the report compares what
-- the doctor prescribed against what the candidate actually quoted — so upsell
-- can be measured, in both directions.
-- ---------------------------------------------------------------------------
alter table cases add column if not exists doctor_indication text;
alter table cases add column if not exists doctor_plan_value numeric;
alter table cases add column if not exists doctor_plan_currency text not null default 'EUR';

-- Whether the candidate gets the clinic briefing at all. Turning it off lets a
-- senior candidate be tested on what they can carry without a crib sheet — the
-- patient and the grader still know the real facts, only the candidate doesn't.
alter table assessments add column if not exists brief_enabled boolean not null default true;

-- ---------------------------------------------------------------------------
-- Candidates sign in with a code and a password rather than a magic link, so
-- the credentials can be sent separately and the link cannot be forwarded.
-- ---------------------------------------------------------------------------
alter table sessions add column if not exists candidate_code text;
alter table sessions add column if not exists candidate_password_hash text;

create unique index if not exists sessions_candidate_code_idx
  on sessions (candidate_code) where candidate_code is not null;

-- ---------------------------------------------------------------------------
-- Candidates sign in with a single six-character code: five digits identifying
-- the person, then a letter for which attempt this is (A, B, C…). Re-testing
-- the same candidate keeps their number and advances the letter.
-- ---------------------------------------------------------------------------
alter table sessions drop column if exists candidate_password_hash;
-- Normalised identity (email when known, else name) used to group attempts.
alter table sessions add column if not exists candidate_key text;

-- A six-character code is a small secret, so failed attempts are counted and
-- throttled rather than left open to guessing.
create table if not exists candidate_login_attempts (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  ip         text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists candidate_attempts_code_idx on candidate_login_attempts (code, created_at desc);
create index if not exists candidate_attempts_ip_idx   on candidate_login_attempts (ip, created_at desc);

-- Roles: superadmin lives only in the environment and is never stored here.
alter table users drop constraint if exists users_role_check;
update users set role = 'moderator' where role = 'member';
