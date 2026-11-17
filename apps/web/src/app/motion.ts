/**
 * Motion (DESIGN-M6-001 §11, AC-M6-16): the View Transitions API when the browser has it and the user has not asked
 * for reduced motion; otherwise the update runs directly. The direction of a week change is written to
 * `<html data-nav-dir>` so the CSS slides the grid the right way. No request, no inline style: CSP is unaffected.
 */
import { flushSync } from "react-dom";

export type NavDirection = "prev" | "next";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type TransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

export function withViewTransition(update: () => void, direction?: NavDirection): void {
  const doc = typeof document === "undefined" ? undefined : (document as TransitionDocument);
  if (!doc || typeof doc.startViewTransition !== "function" || prefersReducedMotion()) {
    update();
    return;
  }
  const root = doc.documentElement;
  if (direction) root.dataset.navDir = direction;
  else delete root.dataset.navDir;
  doc.startViewTransition(() => flushSync(update));
}
