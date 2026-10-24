import { Unzip, UnzipInflate } from "fflate";
import { DOMParser } from "@xmldom/xmldom";

const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_XML_BYTES = 32 * 1024 * 1024;

type ZipEntries = Map<string, Uint8Array>;

function localName(node: any): string {
  return String(node.localName ?? node.nodeName ?? "").split(":").pop() ?? "";
}

function directChildren(node: any, name?: string): any[] {
  const children: any[] = [];
  for (let i = 0; i < (node?.childNodes?.length ?? 0); i += 1) {
    const child = node.childNodes.item(i);
    if (child && (!name || localName(child) === name)) children.push(child);
  }
  return children;
}

function descendants(node: any, name: string): any[] {
  const out: any[] = [];
  const visit = (current: any) => {
    for (const child of directChildren(current)) {
      if (localName(child) === name) out.push(child);
      visit(child);
    }
  };
  visit(node);
  return out;
}

function attr(node: any, name: string): string | undefined {
  const value = node?.getAttribute?.(name);
  return value === null || value === undefined || value === "" ? undefined : String(value);
}

function parseXml(bytes: Uint8Array, part: string): any {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/<\!DOCTYPE\b/i.test(text) || /<\!ENTITY\b/i.test(text)) {
    throw new Error(`DOCTYPE/entity declarations are not supported in ${part}`);
  }
  try {
    return new DOMParser({
      onError: (_level, message) => {
        throw new Error(`malformed XML in ${part}: ${message}`);
      },
    }).parseFromString(text, "application/xml");
  } catch (error) {
    throw new Error(`malformed XML in ${part}: ${(error as Error).message}`);
  }
}

function unzipBounded(bytes: Uint8Array): ZipEntries {
  const entries: ZipEntries = new Map();
  let total = 0;
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (file) => {
    const name = file.name.replace(/\\/g, "/");
    const wanted = name === "[Content_Types].xml"
      || name === "xl/workbook.xml"
      || name === "xl/_rels/workbook.xml.rels"
      || name === "xl/sharedStrings.xml"
      || /^xl\/worksheets\/sheet[^/]+\.xml$/i.test(name);
    if (!wanted) return;
    if (file.originalSize !== undefined && file.originalSize > MAX_ENTRY_BYTES) {
      throw new Error(`OOXML part exceeds safe size limit: ${name}`);
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      size += chunk.length;
      total += chunk.length;
      if (size > MAX_ENTRY_BYTES || total > MAX_TOTAL_XML_BYTES) {
        throw new Error("OOXML expanded content exceeds safe size limit");
      }
      chunks.push(chunk);
      if (final) {
        const result = new Uint8Array(size);
        let offset = 0;
        for (const part of chunks) {
          result.set(part, offset);
          offset += part.length;
        }
        entries.set(name, result);
      }
    };
    file.start();
  };
  unzip.push(bytes, true);
  return entries;
}

function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, index - 1);
}

function textContent(node: any): string {
  return String(node?.textContent ?? "");
}

function resolveTarget(target: string): string {
  const raw = target.replace(/^\//, "");
  return raw.startsWith("xl/") ? raw : `xl/${raw.replace(/^\.\//, "")}`;
}

function sharedStrings(entries: ZipEntries): string[] {
  const bytes = entries.get("xl/sharedStrings.xml");
  if (!bytes) return [];
  const doc = parseXml(bytes, "xl/sharedStrings.xml");
  return descendants(doc, "si").map((si) => descendants(si, "t").map(textContent).join(""));
}

function cellValue(cell: any, strings: string[]): string {
  const type = attr(cell, "t");
  if (type === "inlineStr") return descendants(cell, "t").map(textContent).join("");
  const value = directChildren(cell, "v")[0];
  const raw = value ? textContent(value) : "";
  if (type === "s") {
    const index = Number(raw);
    return Number.isInteger(index) && strings[index] !== undefined ? strings[index]! : "";
  }
  return raw;
}

function fillMergedCells(rows: string[][], mergeRefs: string[]): void {
  for (const reference of mergeRefs) {
    const [start, endValue] = reference.split(":");
    const end = endValue ?? start;
    if (!start || !end) continue;
    const startMatch = start.match(/([A-Z]+)(\d+)/i);
    const endMatch = end.match(/([A-Z]+)(\d+)/i);
    if (!startMatch || !endMatch) continue;
    const startRow = Number(startMatch[2]) - 1;
    const endRow = Number(endMatch[2]) - 1;
    const startCol = columnIndex(startMatch[1]!);
    const endCol = columnIndex(endMatch[1]!);
    const value = rows[startRow]?.[startCol] ?? "";
    if (!value) continue;
    for (let row = startRow; row <= endRow; row += 1) {
      const target = rows[row] ?? (rows[row] = []);
      for (let col = startCol; col <= endCol; col += 1) {
        if (!target[col]) target[col] = value;
      }
    }
  }
}

export type OoxmlSheet = {
  name: string;
  rows: string[][];
  rowNumbers: number[];
};

export type OoxmlWorkbook = {
  sheets: OoxmlSheet[];
};

export function readOoxmlWorkbook(bytes: Uint8Array): OoxmlWorkbook {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("input is not an OOXML ZIP workbook");
  }
  const entries = unzipBounded(bytes);
  const workbookBytes = entries.get("xl/workbook.xml");
  const relsBytes = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbookBytes || !relsBytes) throw new Error("OOXML workbook parts are missing");
  const workbook = parseXml(workbookBytes, "xl/workbook.xml");
  const rels = parseXml(relsBytes, "xl/_rels/workbook.xml.rels");
  const targets = new Map<string, string>();
  for (const relationship of descendants(rels, "Relationship")) {
    const id = attr(relationship, "Id");
    const target = attr(relationship, "Target");
    if (id && target) targets.set(id, resolveTarget(target));
  }
  const strings = sharedStrings(entries);
  const sheets: OoxmlSheet[] = [];
  for (const sheet of descendants(workbook, "sheet")) {
    const name = attr(sheet, "name") ?? `sheet-${sheets.length + 1}`;
    const relationship = attr(sheet, "r:id") ?? attr(sheet, "id");
    const target = relationship ? targets.get(relationship) : undefined;
    const sheetBytes = target ? entries.get(target) : undefined;
    if (!target || !sheetBytes) continue;
    const document = parseXml(sheetBytes, target);
    const data = descendants(document, "sheetData")[0];
    if (!data) continue;
    const rows: string[][] = [];
    const rowNumbers: number[] = [];
    let fallbackRow = 1;
    for (const row of directChildren(data, "row")) {
      const rowNumber = Number(attr(row, "r") ?? fallbackRow);
      fallbackRow = rowNumber + 1;
      const values: string[] = [];
      for (const cell of directChildren(row, "c")) {
        const ref = attr(cell, "r");
        const index = ref ? columnIndex(ref) : values.length;
        values[index] = cellValue(cell, strings);
      }
      rows[rowNumber - 1] = values;
      rowNumbers[rowNumber - 1] = rowNumber;
    }
    const merges = descendants(document, "mergeCell").map((merge) => attr(merge, "ref")).filter((ref): ref is string => Boolean(ref));
    fillMergedCells(rows, merges);
    sheets.push({ name, rows, rowNumbers });
  }
  if (sheets.length === 0) throw new Error("OOXML workbook has no readable worksheets");
  return { sheets };
}
