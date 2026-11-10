/**
 * Lazy registration import (M5-F, DESIGN-M5-001 §5). The boundary is the component module, because it pulls in
 * `@ky-nay/parser/registration` (and `@xmldom/xmldom`) through `model/registration.ts`. The chunk is prefetched when
 * the Workspace mounts, so opening "Nhập kết quả ĐKMH" makes no request (AC-M4-02 / AC-04 evidence unchanged); the
 * service worker precaches it, so it also opens offline.
 */
import { lazy, type ComponentProps, type ComponentType } from "react";
import type { RegistrationImportPanel } from "./RegistrationImport.js";

type RegistrationModule = typeof import("./RegistrationImport.js");
export type RegistrationImportPanelProps = ComponentProps<typeof RegistrationImportPanel>;

let pending: Promise<RegistrationModule> | undefined;

/** One shared (memoized) import of the registration chunk. */
export function loadRegistrationImport(): Promise<RegistrationModule> {
  pending ??= import("./RegistrationImport.js");
  return pending;
}

/** Forgets a failed import so "Thử lại" requests the chunk again. */
export function resetRegistrationImport(): void {
  pending = undefined;
}

/** Starts loading the chunk in the background; a failure is reported later, when the panel is opened. */
export function prefetchRegistrationImport(): void {
  loadRegistrationImport().catch(() => resetRegistrationImport());
}

/** A fresh lazy component; React.lazy caches a rejection, so a retry needs a new one. */
export function createLazyRegistrationPanel(): ComponentType<RegistrationImportPanelProps> {
  return lazy(() => loadRegistrationImport().then((module) => ({ default: module.RegistrationImportPanel })));
}
