/** Builds export files from the Plan view and hands them to the browser as downloads. */
import type { Plan } from "@ky-nay/domain";
import { allOccurrences, buildIcs, buildWordDoc, describeConflict, formatDate } from "@ky-nay/export";
import type { AppCatalog } from "../model/catalog.js";
import { exportDisclaimer, fileStem, formatInstant, provenanceLine } from "../model/labels.js";
import type { PlanView } from "../model/plan-view.js";

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function creditsLine(view: PlanView): string {
  const unknown = view.credits.unknownCourseCodes.length;
  return `Tổng tín chỉ đã biết: ${view.credits.knownTotal}${unknown > 0 ? ` (${unknown} môn chưa rõ số tín chỉ)` : ""}`;
}

export function icsFile(plan: Plan, view: PlanView, catalog: AppCatalog, now: Date = new Date()): { blob: Blob; fileName: string; events: number } {
  if (!view.week1) throw new Error("week1 is not resolved");
  const occurrences = allOccurrences(view.sessions, view.week1.date, catalog.frame, catalog.term.teachingWeeks);
  const text = buildIcs({
    calendarName: `${plan.name} – ${catalog.term.name}`,
    datasetVersion: catalog.entry.datasetVersion,
    sourceLine: provenanceLine(catalog.entry),
    disclaimer: exportDisclaimer(catalog.entry),
    generatedAt: now.toISOString(),
    occurrences,
  });
  return { blob: new Blob([text], { type: "text/calendar;charset=utf-8" }), fileName: `${fileStem(catalog.term.id)}.ics`, events: occurrences.length };
}

export function wordFile(plan: Plan, view: PlanView, catalog: AppCatalog, now: Date = new Date()): { blob: Blob; fileName: string } {
  const html = buildWordDoc({
    title: `${plan.name} — ${catalog.term.name}`,
    meta: [
      ["Phương án", plan.name],
      ["Học kỳ", catalog.term.name],
      ["Tuần 1 bắt đầu", view.week1 ? formatDate(view.week1.date) : "chưa xác định"],
      ["Dữ liệu", provenanceLine(catalog.entry)],
      ["Xuất lúc", formatInstant(now.toISOString())],
    ],
    sessions: view.sessions,
    frame: catalog.frame,
    notes: [
      creditsLine(view),
      ...(view.unresolved.length > 0 ? [`Thiếu buổi học của ${view.unresolved.length} lớp chưa xác định nhóm hoặc không còn trong dữ liệu: ${view.unresolved.map((entry) => entry.sectionId).join(", ")}`] : []),
      ...view.conflicts.map((conflict) => describeConflict(conflict)),
    ],
    disclaimer: exportDisclaimer(catalog.entry),
  });
  // Byte-order mark helps Word detect UTF-8 when opening the HTML-based .doc file.
  return { blob: new Blob(["﻿", html], { type: "application/msword" }), fileName: `${fileStem(catalog.term.id)}.doc` };
}
