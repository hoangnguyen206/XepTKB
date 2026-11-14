/**
 * Horizontal swipe to change week (DESIGN-M6-001 §7, AC-M6-06). Pointer events from touch or pen only (mouse drags
 * select text as usual); the element keeps `touch-action: pan-y`, so vertical scrolling is untouched.
 * A swipe counts when |dx| ≥ max(48 px, 15 % of the element width), |dx| ≥ 1.5·|dy| and it lasts ≤ 600 ms.
 * Swiping left (finger moves left) goes to the next week: `onSwipe(+1)`; right: `onSwipe(-1)`.
 */
import { useRef, type PointerEvent } from "react";

export const SWIPE_MIN_PX = 48;
export const SWIPE_MIN_RATIO = 0.15;
export const SWIPE_MAX_MS = 600;

export function swipeDirection(dx: number, dy: number, ms: number, width: number): -1 | 1 | 0 {
  if (ms > SWIPE_MAX_MS) return 0;
  if (Math.abs(dx) < Math.max(SWIPE_MIN_PX, SWIPE_MIN_RATIO * width)) return 0;
  if (Math.abs(dx) < 1.5 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

export function useSwipe(onSwipe: (direction: -1 | 1) => void) {
  const start = useRef<{ id: number; x: number; y: number; t: number } | undefined>(undefined);
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp };
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const from = start.current;
      start.current = undefined;
      if (!from || from.id !== event.pointerId) return;
      const direction = swipeDirection(event.clientX - from.x, event.clientY - from.y, event.timeStamp - from.t, event.currentTarget.clientWidth);
      if (direction !== 0) onSwipe(direction);
    },
    onPointerCancel: () => {
      start.current = undefined;
    },
  };
}
