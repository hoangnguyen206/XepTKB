/**
 * RFC 5545 calendar export. One VEVENT per fixed session per teaching week; times are converted
 * from Asia/Ho_Chi_Minh (fixed UTC+7, no daylight saving) to UTC so every client agrees.
 */
import { formatPeriods, formatWeeks, kindLabel } from "./format.js";
import type { Occurrence } from "./schedule.js";

export const VIETNAM_UTC_OFFSET_MINUTES = 7 * 60;

export type IcsInput = {
  calendarName: string;
  datasetVersion: string;
  /** One-line provenance, e.g. "Dataset … · Nguồn …"; repeated in every event description. */
  sourceLine: string;
  disclaimer: string;
  /** ISO-8601 UTC instant used for DTSTAMP. */
  generatedAt: string;
  occurrences: readonly Occurrence[];
  utcOffsetMinutes?: number;
};

/** Escape a TEXT value (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line at 75 octets without splitting a UTF-8 character (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = 74; // continuation lines start with one space
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function stampFromMs(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** Local civil date + `HH:MM` at a fixed UTC offset → `YYYYMMDDTHHMMSSZ`. */
export function toUtcStamp(date: string, time: string, utcOffsetMinutes = VIETNAM_UTC_OFFSET_MINUTES): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return stampFromMs(Date.UTC(year!, month! - 1, day!, hour!, minute!) - utcOffsetMinutes * 60_000);
}

function uidPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-");
}

export function buildIcs(input: IcsInput): string {
  const offset = input.utcOffsetMinutes ?? VIETNAM_UTC_OFFSET_MINUTES;
  const stamp = stampFromMs(Date.parse(input.generatedAt));
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ky Nay//Timetable export//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.calendarName)}`,
    "X-WR-TIMEZONE:Asia/Ho_Chi_Minh",
    `X-WR-CALDESC:${escapeText(`${input.sourceLine}. ${input.disclaimer}`)}`,
  ];
  for (const occurrence of input.occurrences) {
    const details = [
      `Lớp ${occurrence.sectionId}${occurrence.group ? ` · nhóm ${occurrence.group}` : ""} · ${kindLabel(occurrence.kind)}`,
      `${formatPeriods(occurrence.startPeriod, occurrence.endPeriod)} · tuần ${occurrence.week} (học các tuần ${formatWeeks(occurrence.weeks)})`,
      ...(occurrence.lecturers.length > 0 ? [`Giảng viên: ${occurrence.lecturers.join(", ")}`] : []),
      input.sourceLine,
      input.disclaimer,
    ];
    const location = [occurrence.room, occurrence.campus].filter(Boolean).join(" · ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uidPart(input.datasetVersion)}-${uidPart(occurrence.sectionId)}-${uidPart(occurrence.sessionId)}-w${occurrence.week}@ky-nay`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toUtcStamp(occurrence.date, occurrence.startTime, offset)}`,
      `DTEND:${toUtcStamp(occurrence.date, occurrence.endTime, offset)}`,
      `SUMMARY:${escapeText(`${occurrence.courseCode} ${occurrence.courseName} (${kindLabel(occurrence.kind)})`)}`,
      ...(location ? [`LOCATION:${escapeText(location)}`] : []),
      `DESCRIPTION:${escapeText(details.join("\n"))}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
