/**
 * Visible word count (DESIGN-M6-001 §9, AC-M6-11): walks the text nodes under `root` (default `main`), skipping
 * `.visually-hidden`, `[hidden]`, `[aria-hidden="true"]` subtrees and elements with a zero-size box. A closed `<select>`
 * shows only its selected option, so the other options are skipped. Text is split on white space and every token that
 * holds a letter or a digit counts as one word (each Vietnamese syllable is a word).
 */
import type { Page } from "@playwright/test";

export type WordCount = { count: number; words: string[] };

export async function countVisibleWords(page: Page, root = "main", exclude: readonly string[] = []): Promise<WordCount> {
  return page.evaluate(
    ({ root, exclude }) => {
      const words: string[] = [];
      const start = document.querySelector(root);
      if (!start) return { count: 0, words };
      const hidden = (element: Element): boolean => {
        if (element.matches(".visually-hidden, [hidden], [aria-hidden='true'], script, style, template")) return true;
        if (element instanceof HTMLOptionElement) return !element.selected;
        if (element.closest("option, optgroup")) return false;
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return true;
        const style = getComputedStyle(element);
        return style.display === "none" || style.visibility === "hidden";
      };
      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent ?? "";
          if (exclude.some((sentence) => text.trim() === sentence)) return;
          for (const token of text.split(/\s+/)) if (/[\p{L}\p{N}]/u.test(token)) words.push(token);
          return;
        }
        if (node instanceof Element && hidden(node)) return;
        node.childNodes.forEach(walk);
      };
      walk(start);
      return { count: words.length, words };
    },
    { root, exclude: [...exclude] },
  );
}
