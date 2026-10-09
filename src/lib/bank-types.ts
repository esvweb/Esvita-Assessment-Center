/**
 * The pure half of the question banks. It lives apart from `banks.ts` because
 * the case editor is a client component: importing the store would drag the
 * database driver into the browser bundle.
 */

export interface QuestionBank {
  key: string;
  title: string;
  questions: string[];
}

/** "key :: text" lines parsed back into the lookup the objection chain uses. */
export function objectionMap(bank: QuestionBank): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of bank.questions) {
    const at = line.indexOf("::");
    if (at === -1) continue;
    map[line.slice(0, at).trim()] = line.slice(at + 2).trim();
  }
  return map;
}
