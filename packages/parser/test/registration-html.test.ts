import { test } from "node:test";
import assert from "node:assert/strict";
import { vnuRegistrationHtmlAdapter } from "../src/vnu-registration-html-adapter.js";

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
