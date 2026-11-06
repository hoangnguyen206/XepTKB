import { Unzip, UnzipInflate } from "fflate";
import { DOMParser } from "@xmldom/xmldom";

const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_XML_BYTES = 32 * 1024 * 1024;
const MAX_COL_INDEX = 16383; // XFD (16,384 columns in OOXML, 0-based)
const MAX_ROW_NUMBER = 100000; // Safe upper bound on row number in a timetable sheet (OOXML max is 1,048,576)
const MAX_MERGED_CELLS = 200000; // Maximum total cells expanded across mergeCell ranges per sheet

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

function isHiddenAttr(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
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

function parseColumnIndex(letters: string): number {
  if (!/^[A-Z]{1,3}$/i.test(letters)) {
    throw new Error(`OOXML cell reference has out-of-bounds column: ${letters}`);
  }
  let index = 0;
  for (const letter of letters.toUpperCase()) index = index * 26 + letter.charCodeAt(0) - 64;
  const col = index - 1;
  if (col < 0 || col > MAX_COL_INDEX) {
    throw new Error(`OOXML cell reference has out-of-bounds column: ${letters}`);
  }
  return col;
}

function parseCellRef(ref: string): { col: number; row: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) throw new Error(`malformed OOXML cell reference: ${ref}`);
  const col = parseColumnIndex(match[1]!);
  const row = Number(match[2]!);
  if (!Number.isInteger(row) || row < 1 || row > MAX_ROW_NUMBER) {
    throw new Error(`OOXML cell reference has out-of-bounds row: ${ref}`);
  }
  return { col, row };
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

function fillMergedCells(rows: string[][], mergeRefs: string[], hiddenRows: Set<number>, hiddenCols: Set<number>): void {
  let expandedCells = 0;
  for (const reference of mergeRefs) {
    const parts = reference.split(":");
    if (parts.length > 2) throw new Error(`malformed OOXML mergeCell reference: ${reference}`);
    const startRef = parts[0];
    const endRef = parts[1] ?? startRef;
    if (!startRef || !endRef) throw new Error(`malformed OOXML mergeCell reference: ${reference}`);
    const start = parseCellRef(startRef);
    const end = parseCellRef(endRef);
    const startRow = start.row - 1;
    const endRow = end.row - 1;
    const startCol = start.col;
    const endCol = end.col;
    if (endRow < startRow || endCol < startCol) {
      throw new Error(`OOXML mergeCell range is inverted: ${reference}`);
    }
    const spanCells = (endRow - startRow + 1) * (endCol - startCol + 1);
    expandedCells += spanCells;
    if (expandedCells > MAX_MERGED_CELLS) {
      throw new Error(`OOXML mergeCell expansion exceeds safe limit (${MAX_MERGED_CELLS} cells): ${reference}`);
    }
    if (hiddenRows.has(startRow) || hiddenCols.has(startCol)) continue;
    const value = rows[startRow]?.[startCol] ?? "";
    if (!value) continue;
    for (let row = startRow; row <= endRow; row += 1) {
      if (hiddenRows.has(row)) continue;
      const target = rows[row] ?? (rows[row] = []);
      for (let col = startCol; col <= endCol; col += 1) {
        if (hiddenCols.has(col)) continue;
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
    // SEC-M3-102: never read hidden or veryHidden worksheets into a public timetable artifact.
    const state = attr(sheet, "state")?.toLowerCase();
    if (state === "hidden" || state === "veryhidden") continue;
    const name = attr(sheet, "name") ?? `sheet-${sheets.length + 1}`;
    const relationship = attr(sheet, "r:id") ?? attr(sheet, "id");
    const target = relationship ? targets.get(relationship) : undefined;
    const sheetBytes = target ? entries.get(target) : undefined;
    if (!target || !sheetBytes) continue;
    const document = parseXml(sheetBytes, target);
    const data = descendants(document, "sheetData")[0];
    if (!data) continue;
    const hiddenCols = new Set<number>();
    for (const col of descendants(document, "col")) {
      if (!isHiddenAttr(attr(col, "hidden"))) continue;
      const minRaw = Number(attr(col, "min"));
      const maxRaw = Number(attr(col, "max") ?? attr(col, "min"));
      if (!Number.isInteger(minRaw) || minRaw < 1 || !Number.isInteger(maxRaw) || maxRaw < minRaw) continue;
      const minCol = Math.min(MAX_COL_INDEX, minRaw - 1);
      const maxCol = Math.min(MAX_COL_INDEX, maxRaw - 1);
      for (let c = minCol; c <= maxCol; c += 1) hiddenCols.add(c);
    }
    const hiddenRows = new Set<number>();
    const rows: string[][] = [];
    const rowNumbers: number[] = [];
    let fallbackRow = 1;
    for (const row of directChildren(data, "row")) {
      const rawRow = attr(row, "r");
      const rowNumber = rawRow !== undefined ? Number(rawRow) : fallbackRow;
      if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > MAX_ROW_NUMBER) {
        throw new Error(`OOXML row number exceeds safe limit: ${rawRow ?? rowNumber}`);
      }
      fallbackRow = rowNumber + 1;
      if (isHiddenAttr(attr(row, "hidden"))) {
        hiddenRows.add(rowNumber - 1);
        continue;
      }
      const values: string[] = [];
      for (const cell of directChildren(row, "c")) {
        const ref = attr(cell, "r");
        const index = ref ? parseCellRef(ref).col : values.length;
        if (index > MAX_COL_INDEX) {
          throw new Error(`OOXML column index exceeds safe limit: ${index}`);
        }
        if (hiddenCols.has(index)) {
          values[index] = "";
          continue;
        }
        values[index] = cellValue(cell, strings);
      }
      rows[rowNumber - 1] = values;
      rowNumbers[rowNumber - 1] = rowNumber;
    }
    const merges = descendants(document, "mergeCell").map((merge) => attr(merge, "ref")).filter((ref): ref is string => Boolean(ref));
    fillMergedCells(rows, merges, hiddenRows, hiddenCols);
    sheets.push({ name, rows, rowNumbers });
  }
  if (sheets.length === 0) throw new Error("OOXML workbook has no readable worksheets");
  return { sheets };
}
