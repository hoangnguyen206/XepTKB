/**
 * Deterministic note → weeks/period-override parsing (PARSER_SPEC §6).
 * Pure functions, no inference beyond the documented pattern table.
 */
import type { ParseIssue, WeekOrigin } from "@ky-nay/domain";

export type NoteParse = {
  weeks?: number[];
  weekOrigin?: WeekOrigin;
  periodOverride?: { startPeriod: number; endPeriod: number };
  issues: ParseIssue[];
};

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

const WEEK_RANGE = /học\s+tuần\s+(\d+)\s*[-–]\s*(\d+)/iu;
const WEEK_FROM = /học\s+từ\s+tuần\s+(\d+)/iu;
const WEEK_LIST = /học\s+tuần\s+(\d+(?:\s*,\s*\d+)*)/iu;
const PERIOD_OVERRIDE = /học\s+tiết\s+(\d+)\s*[-–]\s*(\d+)/iu;
const BENIGN_WEEK_FREQUENCY = /\b(?:học\s+)?\d+\s*ca\s*\/\s*\d+\s*tuần\b/giu;
const WEEK_CONTINUATION_TAIL = /^(?:[-–~]|,\s*(?:tuần\b|\d)|đến\b|tới\b|cho\s+đến\b|hết\b|tuần\b|\d)/iu;
const WEEK_WORD = /\btuần\b/iu;

function isCompleteClause(text: string, match: RegExpMatchArray): boolean {
  const end = (match.index ?? 0) + match[0].length;
  const tail = text.slice(end).trimStart();
  return !WEEK_CONTINUATION_TAIL.test(tail);
}

/**
 * teachingWeeks is config (Term.teachingWeeks); never hardcoded per DOMAIN_MODEL §7.
 * Q-012 & REV-M3-101: a note is information for the student. Only a complete, unambiguous week/period pattern
 * changes the session; partial or unrecognised week phrasings ("Học tuần 1 đến tuần 8", "Tuần 1-8", etc.)
 * keep default weeks (`weekOrigin: "parser-default"`) and emit `UNPARSED_NOTE` so the Data Reviewer must inspect them.
 */
export function parseNote(note: string | undefined, teachingWeeks: number): NoteParse {
  const issues: ParseIssue[] = [];
  if (!note || !note.trim()) {
    return { weeks: range(1, teachingWeeks), weekOrigin: "parser-default", issues };
  }
  const n = note.normalize("NFC");
  const withoutBenign = n.replace(BENIGN_WEEK_FREQUENCY, " ");

  let weeks: number[] | undefined;
  let matched = 0;
  let matchedSpan = "";
  let partialWeekMatch = false;
  // A recognised week pattern with out-of-term or inverted numbers fails closed instead of falling back to the default.
  let invalid = false;

  const mRange = withoutBenign.match(WEEK_RANGE);
  if (mRange) {
    if (isCompleteClause(withoutBenign, mRange)) {
      matched++;
      matchedSpan = mRange[0];
      const a = Number(mRange[1]); const b = Number(mRange[2]);
      if (a >= 1 && b <= teachingWeeks && a <= b) weeks = range(a, b);
      else invalid = true;
    } else {
      partialWeekMatch = true;
    }
  }
  const mFrom = withoutBenign.match(WEEK_FROM);
  if (mFrom) {
    if (isCompleteClause(withoutBenign, mFrom)) {
      matched++;
      matchedSpan = mFrom[0];
      const a = Number(mFrom[1]);
      if (a >= 1 && a <= teachingWeeks) weeks = range(a, teachingWeeks);
      else invalid = true;
    } else {
      partialWeekMatch = true;
    }
  }
  const mList = withoutBenign.match(WEEK_LIST);
  if (mList && !mRange) {
    if (isCompleteClause(withoutBenign, mList)) {
      matched++;
      matchedSpan = mList[0];
      const list = mList[1]!.split(/[,\s]+/).filter(Boolean).map(Number);
      if (list.every((w) => Number.isInteger(w) && w >= 1 && w <= teachingWeeks)) {
        weeks = [...new Set(list)].sort((x, y) => x - y);
      } else invalid = true;
    } else {
      partialWeekMatch = true;
    }
  }

  if (matched > 1) {
    issues.push({ code: "AMBIGUOUS_NOTE", severity: "error", field: "note", rawValue: note, message: "conflicting week patterns in note" });
    return { issues };
  }
  if (invalid) {
    issues.push({ code: "INVALID_DAY_OR_PERIOD", severity: "error", field: "weeks", rawValue: note, message: `note weeks must be ascending and within 1..${teachingWeeks}` });
    return { issues };
  }

  const residual = (matchedSpan ? withoutBenign.replace(matchedSpan, " ") : withoutBenign).replace(PERIOD_OVERRIDE, " ");
  if (partialWeekMatch || WEEK_WORD.test(residual)) {
    weeks = undefined;
    issues.push({
      code: "UNPARSED_NOTE",
      severity: "warning",
      field: "note",
      rawValue: note,
      message: "note mentions 'tuần' in an unreviewed phrasing; default weeks were applied and require Data Reviewer check",
    });
  }

  let periodOverride: NoteParse["periodOverride"];
  const mPeriod = n.match(PERIOD_OVERRIDE);
  if (mPeriod) {
    periodOverride = { startPeriod: Number(mPeriod[1]), endPeriod: Number(mPeriod[2]) };
  }

  let weekOrigin: WeekOrigin = "explicit";
  if (!weeks) {
    weeks = range(1, teachingWeeks);
    weekOrigin = "parser-default";
  }
  return { weeks, weekOrigin, ...(periodOverride ? { periodOverride } : {}), issues };
}
