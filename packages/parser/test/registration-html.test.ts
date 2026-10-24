import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { vnuRegistrationHtmlAdapter } from "../src/vnu-registration-html-adapter.js";

// Tests run from dist/test; the module graph is checked on the TypeScript sources.
const parserSrc = new URL("../../src/", import.meta.url);
const domainSrc = new URL("../../../domain/src/", import.meta.url);

function importsOf(file: URL): string[] {
  return [...readFileSync(file, "utf8").matchAll(/^(?:import|export)\s(?!type\b)[^;]*?from\s+"([^"]+)"/gm)].map((match) => match[1]!);
}

test("browser entry @ky-nay/parser/registration has no Node built-in imports", () => {
  const builtins = new Set(builtinModules);
  const pending: URL[] = [new URL("vnu-registration-html-adapter.ts", parserSrc)];
  const seen = new Set<string>();
  const offenders: string[] = [];
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (seen.has(file.href)) continue;
    seen.add(file.href);
    for (const specifier of importsOf(file)) {
      if (specifier.startsWith("node:") || builtins.has(specifier)) offenders.push(`${file.pathname} -> ${specifier}`);
      else if (specifier.startsWith(".")) pending.push(new URL(specifier.replace(/\.js$/, ".ts"), file));
      else if (specifier === "@ky-nay/domain") {
        for (const name of readdirSync(domainSrc)) if (name.endsWith(".ts")) pending.push(new URL(name, domainSrc));
      }
    }
  }
  assert.deepEqual(offenders, []);
  assert.ok(seen.size > 3);
});

const html = `<!doctype html><html><body><div>Họ tên: Synthetic Student</div><div>Ngày sinh: 01/01/2000</div><div>Mã sinh viên: SYNTH-001</div><table><tr><th>Mã HP</th><th>Tên học phần</th><th>Mã LHP</th><th>Nhóm</th><th>Loại buổi</th><th>Thứ</th><th>Tiết học</th><th>Phòng</th><th>Giảng viên</th></tr><tr><td>INT2213</td><td>&lt;script&gt;not-code&lt;/script&gt;</td><td>INT2213 1</td><td>CL</td><td>LT</td><td>T2,T6</td><td>4 - 6, 1 - 3</td><td>203-G2</td><td>GV A</td></tr><tr><td>MAT1051</td><td>Toán</td><td>MAT1051 2</td><td>1</td><td>TH</td><td>T7</td><td>9-12</td><td>Hòa Lạc A</td><td>GV B</td></tr></table></body></html>`;

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

test("registration HTML is parsed locally with multi-day and multi-period rows", () => {
  const result = vnuRegistrationHtmlAdapter.parse({ bytes: bytes(html), fileName: "result.doc" });
  assert.equal(result.artifact.localOnly, true);
  assert.equal(result.artifact.sha256, undefined);
  assert.equal(result.artifact.fileName, undefined);
  assert.equal(result.sections.length, 2);
  assert.equal(result.sections[0]!.sessions.length, 4);
  assert.equal(result.sections[1]!.sessions[0]!.day, 7);
  assert.equal(result.sections[1]!.sessions[0]!.campus, "Hòa Lạc");
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("Synthetic Student"), false);
  assert.equal(serialized.includes("01/01/2000"), false);
  assert.equal(serialized.includes("SYNTH-001"), false);
  assert.equal(serialized.includes("<script>"), false);
});

test("registration adapter keeps ONL rows as one non-fixed session (Q-009)", () => {
  const withOnline = html.replace("</table>", "<tr><td>INT3999</td><td>Trực tuyến</td><td>INT3999 1</td><td>CL</td><td>ONL</td><td></td><td></td><td>LMS</td><td>GV C</td></tr></table>");
  const result = vnuRegistrationHtmlAdapter.parse({ bytes: bytes(withOnline) });
  const online = result.sections.find((section) => section.id === "INT3999 1")!;
  assert.equal(online.online, true);
  assert.equal(online.sessions.length, 1);
  assert.equal(online.sessions[0]!.fixedTime, false);
  assert.equal(result.issues.some((item) => item.severity === "error"), false);
});

test("registration adapter detects content rather than extension and rejects non-HTML", () => {
  assert.equal(vnuRegistrationHtmlAdapter.canParse({ bytes: bytes(html), fileName: "anything.bin" }), true);
  const result = vnuRegistrationHtmlAdapter.parse({ bytes: bytes("PK\\x03\\x04"), fileName: "result.doc" });
  assert.equal(result.sections.length, 0);
  assert.ok(result.issues.some((item) => item.code === "UNSUPPORTED_INPUT"));
});

test("registration adapter enforces local size and invalid UTF-8 limits", () => {
  const oversized = vnuRegistrationHtmlAdapter.parse({ bytes: new Uint8Array(10), maxBytes: 5 });
  assert.ok(oversized.issues.some((item) => item.code === "INPUT_TOO_LARGE"));
  const invalid = vnuRegistrationHtmlAdapter.parse({ bytes: new Uint8Array([0xff]), fileName: "result.doc" });
  assert.ok(invalid.issues.some((item) => item.code === "MALFORMED_INPUT"));
});
