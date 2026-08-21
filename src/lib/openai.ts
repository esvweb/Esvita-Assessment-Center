import OpenAI from "openai";

let cached: OpenAI | null = null;

export function openai(): OpenAI {
  if (cached) return cached;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  cached = new OpenAI();
  return cached;
}

/** The patient during the messaging stage — short turns, so latency matters. */
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.4";

/** The grader — one long, judgement-heavy call per session. */
export const REPORT_MODEL = process.env.OPENAI_REPORT_MODEL ?? "gpt-5.5";
