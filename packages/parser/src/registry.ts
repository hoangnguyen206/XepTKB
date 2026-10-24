/**
 * Adapter registry — adapters register here; the fixture runner and future
 * admin CLI resolve adapters by manifest `adapter` field.
 */
import type { ParserAdapter } from "./adapter.js";
import { canonicalJsonlAdapter } from "./jsonl-adapter.js";
import { uetXlsxAdapter } from "./uet-xlsx-adapter.js";
import { vnuRegistrationHtmlAdapter } from "./vnu-registration-html-adapter.js";

const registry = new Map<string, ParserAdapter>();

export function registerAdapter(adapter: ParserAdapter): void {
  registry.set(adapter.id, adapter);
}

export function getAdapter(id: string): ParserAdapter | undefined {
  return registry.get(id);
}

export function listAdapters(): string[] {
  return [...registry.keys()];
}

registerAdapter(canonicalJsonlAdapter);
registerAdapter(uetXlsxAdapter);
registerAdapter(vnuRegistrationHtmlAdapter);
