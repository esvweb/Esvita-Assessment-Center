export type Stage = "brief" | "call_1" | "chat" | "plan" | "call_2" | "report" | "done";

export const STAGE_ORDER: Stage[] = ["brief", "call_1", "chat", "plan", "call_2", "report", "done"];

export function nextStage(current: Stage): Stage {
  const i = STAGE_ORDER.indexOf(current);
  return STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];
}

/** Everything the patient says or hears, in one ordered log. */
export type Channel = "voice_1" | "chat" | "voice_2" | "system";
export type Speaker = "candidate" | "patient" | "system";

export interface TranscriptEntry {
  id?: string;
  session_id: string;
  channel: Channel;
  speaker: Speaker;
  text: string;
  /** Public URLs of photos attached to this turn (patient sending case photos). */
  attachments?: string[];
  created_at?: string;
  seq?: number;
}

export interface TreatmentPlan {
  summary: string;
  items: { treatment: string; quantity: string; note?: string }[];
  total_price: string;
  currency: string;
  trip_days: string;
  visits: string;
  guarantee: string;
  included: string;
  next_step: string;
}

export type SessionStatus = "not_started" | "in_progress" | "completed" | "abandoned";

export interface AssessmentSession {
  id: string;
  token: string;
  assessment_id: string | null;
  candidate_name: string;
  candidate_email: string | null;
  profile_id: number;
  stage: Stage;
  /** Furthest stage reached; lets the candidate step back and return. */
  max_stage: Stage | null;
  status: SessionStatus;
  plan: TreatmentPlan | null;
  photos_requested: boolean;
  call_1_id: string | null;
  call_2_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationReport {
  session_id: string;
  outcome: "CLOSED" | "WARM-CLOSE" | "LOST";
  scores: Record<string, number>;
  overall: number;
  hire_signal: "STRONG YES" | "YES" | "BORDERLINE" | "NO";
  markdown: string;
  created_at: string;
}
