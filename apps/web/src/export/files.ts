/**
 * Download helper and the credits line shared by the screen, print and exports. The file builders (ICS, Word, PNG)
 * live in `export/exporters.ts`, a lazy chunk (DESIGN-M6-001 §14, `exporters-`).
 */
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
