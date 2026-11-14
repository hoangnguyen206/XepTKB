/**
 * Lazy export builders (DESIGN-M6-001 §14), the same pattern as `components/registration-lazy.ts`: one memoized
 * import of `export/exporters.ts` (chunk `exporters-`), prefetched when the Workspace mounts so an export button never
 * starts a request — the M4 zero-request window (`e2e/m4.spec.ts`) includes ICS and Word exports.
 */
type ExportersModule = typeof import("./exporters.js");

let pending: Promise<ExportersModule> | undefined;

export function loadExporters(): Promise<ExportersModule> {
  pending ??= import("./exporters.js");
  return pending;
}

/** Forgets a failed import so the next export tries again. */
export function resetExporters(): void {
  pending = undefined;
}

/** Starts loading in the background; a failure is reported when an export is pressed. */
export function prefetchExporters(): void {
  loadExporters().catch(() => resetExporters());
}
