/** DESIGN-M6-001 §11, AC-M6-16: view transitions only when available and motion is not reduced. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion, withViewTransition } from "./motion.js";

// The DOM lib types startViewTransition as required; the tests add and remove it.
const doc = document as unknown as { startViewTransition?: (update: () => void) => unknown };

function mockReducedMotion(reduce: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({ matches: reduce && query.includes("reduce"), media: query } as MediaQueryList));
}

afterEach(() => {
  vi.restoreAllMocks();
  delete doc.startViewTransition;
  delete document.documentElement.dataset.navDir;
});

describe("withViewTransition", () => {
  it("runs the update directly without the API", () => {
    window.matchMedia ??= (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    mockReducedMotion(false);
    const update = vi.fn();
    withViewTransition(update, "next");
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.navDir).toBeUndefined();
  });

  it("uses the API and records the direction", () => {
    window.matchMedia ??= (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    mockReducedMotion(false);
    const start = vi.fn((callback: () => void) => callback());
    doc.startViewTransition = start;
    const update = vi.fn();
    withViewTransition(update, "prev");
    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.navDir).toBe("prev");
  });

  it("skips the API under prefers-reduced-motion", () => {
    window.matchMedia ??= (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    mockReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    const start = vi.fn();
    doc.startViewTransition = start;
    const update = vi.fn();
    withViewTransition(update, "next");
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });
});
