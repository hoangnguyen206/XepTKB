import type { DayNo, SessionKind } from "@ky-nay/domain";
import { COLUMN_SYNONYMS, KIND_ALIASES, UET_CONFIG } from "./uet-config.js";

export type PeriodRange = { startPeriod: number; endPeriod: number };

export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[Đđ]/g, "d")
    .toLowerCase()
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeHeader(value: string): string {
  return foldText(value).replace(/[.:()[\]{}_+]/g, " ").replace(/\s+/g, " ").trim();
}

const HEADER_LOOKUP = new Map<string, string>();
for (const [canonical, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
  HEADER_LOOKUP.set(normalizeHeader(canonical), canonical);
  for (const synonym of synonyms) HEADER_LOOKUP.set(normalizeHeader(synonym), canonical);
}

export function canonicalColumn(value: string): string | undefined {
  return HEADER_LOOKUP.get(normalizeHeader(value));
}

export function normalizeDisplay(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.normalize("NFC").replace(/[ \t\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

export function normalizeCode(value: string): string {
  return value.normalize("NFC").replace(/\*/g, "").replace(/\s+/g, "").trim().toUpperCase();
}

export function normalizeSectionId(value: string): string {
  return value.normalize("NFC").replace(/\*/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

/** A section id needs a course-like token and a separate section suffix. */
export function isCanonicalSectionId(value: string): boolean {
  return /^[A-Z][A-Z0-9._-]*\s+[A-Z0-9][A-Z0-9._/-]*$/.test(value);
}

export function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!normalized) return undefined;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

export function parseCredits(value: string | undefined): number | undefined {
  const n = parseNumber(value);
  return n !== undefined && n >= 0 ? n : undefined;
}

export function parseDay(value: string): DayNo | undefined {
  const n = normalizeHeader(value);
  if (/^(?:cn|chu nhat|chu nhat)$/.test(n)) return 8;
  const match = n.match(/^(?:t|thu)\s*([2-7])$/) ?? n.match(/^([2-7])$/);
  if (!match) return undefined;
  const day = Number(match[1]);
  return day >= 2 && day <= 7 ? day as DayNo : undefined;
}

export function parseDays(value: string | undefined): DayNo[] {
  if (!value) return [];
  const tokens = value.split(/[;,|/]+/).map((token) => token.trim()).filter(Boolean);
  const days: DayNo[] = [];
  for (const token of tokens) {
    const day = parseDay(token);
    if (day !== undefined) days.push(day);
    else {
      const match = normalizeHeader(token).match(/(?:t|thu)\s*([2-7])|\bcn\b|\b([2-7])\b/);
      if (match?.[0]) {
        const parsed = parseDay(match[0]);
        if (parsed !== undefined) days.push(parsed);
      }
    }
  }
  return [...new Set(days)].sort((a, b) => a - b);
}

function rangesFromNumbers(numbers: number[]): PeriodRange[] {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const ranges: PeriodRange[] = [];
  let start = sorted[0]!;
  let previous = start;
  for (const current of sorted.slice(1)) {
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    ranges.push({ startPeriod: start, endPeriod: previous });
    start = current;
    previous = current;
  }
  ranges.push({ startPeriod: start, endPeriod: previous });
  return ranges;
}

export function parsePeriodRanges(value: string | undefined): PeriodRange[] {
  if (!value) return [];
  const normalized = value.normalize("NFC").replace(/[–—]/g, "-").trim();
  const ranges: PeriodRange[] = [];
  for (const part of normalized.split(/[;,|/]+/).map((p) => p.trim()).filter(Boolean)) {
    const rangeMatch = part.match(/^(?:ti[eế]t\s*)?(\d+)\s*-\s*(\d+)$/i);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (Number.isInteger(start) && Number.isInteger(end)) ranges.push({ startPeriod: start, endPeriod: end });
      continue;
    }
    const singleNumbers = part.match(/\d+/g)?.map(Number) ?? [];
    if (singleNumbers.length > 0) ranges.push(...rangesFromNumbers(singleNumbers));
  }
  return ranges;
}

export function periodsFromShift(value: string | undefined): PeriodRange[] {
  if (!value) return [];
  const normalized = normalizeHeader(value);
  const named = UET_CONFIG.namedShiftRanges[normalized];
  if (named) return [{ startPeriod: named.start, endPeriod: named.end }];
  const number = normalized.match(/^(?:ca\s*)?(\d+)$/)?.[1];
  if (!number) return [];
  const shift = UET_CONFIG.frame.shifts.find((candidate) => candidate.name === number);
  if (!shift || shift.periods.length === 0) return [];
  return [{ startPeriod: Math.min(...shift.periods), endPeriod: Math.max(...shift.periods) }];
}

export function normalizeKind(value: string | undefined): SessionKind {
  const key = foldText(value ?? "").replace(/\s*\/\s*/g, "/").replace(/\s*\+\s*/g, "+").replace(/\s+/g, "_");
  return KIND_ALIASES[key] ?? (key.includes("online") ? "ONL" : "OTHER");
}

export function normalizeGroup(value: string | undefined): string | undefined {
  const normalized = normalizeDisplay(value);
  if (!normalized) return undefined;
  const folded = foldText(normalized);
  if (folded === "ca lop" || folded === "cl") return "CL";
  return normalized.replace(/^nhom\s*/i, "").trim() || undefined;
}

export function normalizeLecturers(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/[+;|]/).map((item) => normalizeDisplay(item)).filter((item): item is string => Boolean(item));
}

export function detectCampus(room: string | undefined): string | undefined {
  if (!room) return undefined;
  const folded = foldText(room);
  return UET_CONFIG.campusPatterns.find((pattern) => folded.includes(foldText(pattern.token)))?.campus;
}

export function normalizeRoom(value: string | undefined): string | undefined {
  return normalizeDisplay(value);
}

export function hasFixedTime(kind: SessionKind, day: DayNo | undefined, ranges: PeriodRange[]): boolean {
  return kind !== "ONL" && day !== undefined && ranges.length > 0;
}

export function normalizedSynonymCount(value: string): number {
  const canonical = canonicalColumn(value);
  return canonical ? 1 : 0;
}
