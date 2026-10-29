/** Word export as an HTML document saved with a `.doc` extension (Q-002: no DOCX generator). */
import type { TimeFrame } from "@ky-nay/domain";
import { dayLabel, formatPeriods, formatWeeks, kindLabel } from "./format.js";
import { periodTimes, type ScheduledSession } from "./schedule.js";

export type WordInput = {
  title: string;
  /** Label/value rows printed under the title (Plan, kỳ, tuần 1, dataset, nguồn…). */
  meta: readonly (readonly [label: string, value: string])[];
  sessions: readonly ScheduledSession[];
  frame: TimeFrame;
  /** Free-text notes such as total credits or conflicts. */
  notes: readonly string[];
  disclaimer: string;
};

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function cell(value: string): string {
  return `<td>${escapeHtml(value)}</td>`;
}

export function buildWordDoc(input: WordInput): string {
  const fixedRows = input.sessions.filter((session) => session.fixed).map((session) => {
    const times = session.startPeriod !== undefined && session.endPeriod !== undefined ? periodTimes(input.frame, session.startPeriod, session.endPeriod) : undefined;
    const when = session.startPeriod !== undefined && session.endPeriod !== undefined ? formatPeriods(session.startPeriod, session.endPeriod) : "";
    return `<tr>${[
      cell(session.day !== undefined ? dayLabel(session.day) : ""),
      cell(times ? `${when} (${times.start}–${times.end})` : when),
      cell(`${session.courseCode} ${session.courseName}`),
      cell(`${session.sectionId}${session.group ? ` · nhóm ${session.group}` : ""}`),
      cell(kindLabel(session.kind)),
      cell([session.room, session.campus].filter(Boolean).join(" · ")),
      cell(formatWeeks(session.weeks)),
      cell(session.lecturers.join(", ")),
    ].join("")}</tr>`;
  });
  const nonFixed = input.sessions.filter((session) => !session.fixed);
  const nonFixedList = nonFixed.length === 0 ? "" : `<h2>Không có giờ cố định (không xếp vào lưới)</h2><ul>${nonFixed
    .map((session) => `<li>${escapeHtml(`${session.courseCode} ${session.courseName} — lớp ${session.sectionId} (${kindLabel(session.kind)}), tuần ${formatWeeks(session.weeks)}`)}</li>`)
    .join("")}</ul>`;
  return [
    "<!DOCTYPE html>",
    '<html lang="vi" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(input.title)}</title>`,
    "<style>",
    "@page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 36pt; }",
    "div.Section1 { page: Section1; }",
    "body { font-family: Arial, sans-serif; font-size: 10pt; }",
    "table { border-collapse: collapse; width: 100%; }",
    "th, td { border: 1px solid #555; padding: 3pt 5pt; vertical-align: top; text-align: left; }",
    "th { background: #e8e8e8; }",
    ".meta td { border: none; padding: 1pt 6pt 1pt 0; }",
    ".disclaimer { margin-top: 12pt; font-style: italic; }",
    "</style>",
    "</head>",
    '<body><div class="Section1">',
    `<h1>${escapeHtml(input.title)}</h1>`,
    `<table class="meta">${input.meta.map(([label, value]) => `<tr><td><b>${escapeHtml(label)}</b></td><td>${escapeHtml(value)}</td></tr>`).join("")}</table>`,
    "<h2>Lịch học</h2>",
    fixedRows.length === 0
      ? "<p>Chưa có buổi học có giờ cố định.</p>"
      : `<table><thead><tr><th>Thứ</th><th>Tiết (giờ)</th><th>Môn</th><th>Lớp</th><th>Loại</th><th>Phòng</th><th>Tuần</th><th>Giảng viên</th></tr></thead><tbody>${fixedRows.join("")}</tbody></table>`,
    nonFixedList,
    input.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join(""),
    `<p class="disclaimer">${escapeHtml(input.disclaimer)}</p>`,
    "</div></body></html>",
  ].join("\n");
}
