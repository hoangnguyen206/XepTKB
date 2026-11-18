/**
 * Ctrl/⌘ K (DESIGN-M6-001 §8, AC-M6-10): the only document-level keydown listener. Runs with Ctrl or Meta, without
 * Alt/Shift, on "k", never while an IME (Telex) is composing, when the event was already handled, or while a dialog
 * is open. The caller decides what "go to search" means (desktop: focus the left column; else: open Thêm lớp).
 */
import { useEffect, useRef } from "react";

export function isSearchShortcut(event: KeyboardEvent, doc: Document = document): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
  if (event.isComposing || event.keyCode === 229 || event.defaultPrevented) return false;
  if (event.key.toLowerCase() !== "k") return false;
  return doc.querySelector("dialog[open]") === null;
}

export function useSearchShortcut(onTrigger: () => void): void {
  const handler = useRef(onTrigger);
  handler.current = onTrigger;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event)) return;
      event.preventDefault();
      handler.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
