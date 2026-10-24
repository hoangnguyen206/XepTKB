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

const WEEK_RANGE = /học\s+tuần\s+(\d+)\s*[-–]\s*(\d+)/i;
const WEEK_FROM = /học\s+từ\s+tuần\s+(\d+)/i;
const WEEK_LIST = /học\s+tuần\s+(\d[\d,\s]*)/i;
const PERIOD_OVERRIDE = /học\s+tiết\s+(\d+)\s*[-–]\s*(\d+)/i;

/** teachingWeeks is config (Term.teachingWeeks); never hardcoded per DOMAIN_MODEL §7. */
export function parseNote(note: string | undefined, teachingWeeks: number): NoteParse {
  const issues: ParseIssue[] = [];
  if (!note || !note.trim()) {
    issues.push({ code: "DEFAULT_WEEKS_APPLIED", severity: "warning", message: `no week info — default [1..${teachingWeeks}]` });
    return { weeks: range(1, teachingWeeks), weekOrigin: "parser-default", issues };
  }
  const n = note.normalize("NFC");

  let weeks: number[] | undefined;
  let matched = 0;
  // A recognised week pattern with out-of-term or inverted numbers fails closed instead of falling back to the default.
  let invalid = false;

  const mRange = n.match(WEEK_RANGE);
  if (mRange) {
    matched++;
    const a = Number(mRange[1]); const b = Number(mRange[2]);
    if (a >= 1 && b <= teachingWeeks && a <= b) weeks = range(a, b);
    else invalid = true;
  }
  const mFrom = n.match(WEEK_FROM);
  if (mFrom) {
    matched++;
    const a = Number(mFrom[1]);
    if (a >= 1 && a <= teachingWeeks) weeks = range(a, teachingWeeks);
    else invalid = true;
  }
  const mList = n.match(WEEK_LIST);
  if (mList && !mRange) {
    matched++;
    const list = mList[1]!.split(/[,\s]+/).filter(Boolean).map(Number);
    if (list.every((w) => Number.isInteger(w) && w >= 1 && w <= teachingWeeks)) {
      weeks = [...new Set(list)].sort((x, y) => x - y);
    } else invalid = true;
  }

  if (matched > 1) {
    issues.push({ code: "AMBIGUOUS_NOTE", severity: "error", field: "note", rawValue: note, message: "conflicting week patterns in note" });
    return { issues };
  }
  if (invalid) {
    issues.push({ code: "INVALID_DAY_OR_PERIOD", severity: "error", field: "weeks", rawValue: note, message: `note weeks must be ascending and within 1..${teachingWeeks}` });
    return { issues };
  }

  let periodOverride: NoteParse["periodOverride"];
  const mPeriod = n.match(PERIOD_OVERRIDE);
  if (mPeriod) {
    periodOverride = { startPeriod: Number(mPeriod[1]), endPeriod: Number(mPeriod[2]) };
  }

  let weekOrigin: WeekOrigin = "explicit";
  if (!weeks) {
    if (!periodOverride) {
      issues.push({ code: "UNPARSED_NOTE", severity: "warning", field: "note", rawValue: note, message: "note did not match any known week pattern — default applied" });
    }
    issues.push({ code: "DEFAULT_WEEKS_APPLIED", severity: "warning", message: `default weeks [1..${teachingWeeks}]` });
    weeks = range(1, teachingWeeks);
    weekOrigin = "parser-default";
  }
  return { weeks, weekOrigin, ...(periodOverride ? { periodOverride } : {}), issues };
}
