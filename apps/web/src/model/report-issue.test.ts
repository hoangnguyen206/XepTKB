import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createPlan, type Plan } from "@ky-nay/domain";
import type { BuildInfo } from "../app/build-info.js";
import { serveDataset, testMetadata, testTimetable, VERSION } from "../test/fixture.js";
import { buildAppCatalog } from "./catalog.js";
import { buildRegistrationPreview } from "./registration.js";
import { REPORT_FIELDS, REPORT_NOTE_MAX, buildIssueReport, clampReportNote, looksLikePersonalInfo } from "./report-issue.js";

const BUILD: BuildInfo = { version: "0.1.0", commit: "1a2b3c4", builtAt: "2026-11-10T08:30Z", channel: "production" };

/** Identity and fee values of the redacted portal sample (fixtures/redacted-registration) and of the synthetic file below. */
const PII_TOKENS = [
  "Sinh Viên Mẫu",
  "01/01/2000",
  "00000000",
  "Chương trình mẫu",
  "QH-0000-X/XX",
  "500,000",
  "1,900,000",
  "Nguyễn Văn Bí Mật",
  "19/08/2005",
  "23029876",
  "CNTT Chuẩn Quốc Tế",
  "QH-2023-I/CQ",
  "1,500,000",
  "23029876_secret_ketqua.doc",
];

function portalHtml(): string {
  return `<!DOCTYPE html><html><body>
  <table><tr><td>Họ và tên</td><td><b>Nguyễn Văn Bí Mật</b></td><td>Ngày sinh</td><td><b>19/08/2005</b></td><td>Mã sinh viên</td><td><b>23029876</b></td></tr>
  <tr><td>Chương trình đào tạo</td><td><b>CNTT Chuẩn Quốc Tế</b></td><td>Khóa</td><td><b>QH-2023-I/CQ</b></td></tr></table>
  <table>
    <tr><th>STT</th><th>Mã môn học</th><th>Môn học</th><th>Số tín chỉ</th><th>Trạng thái</th><th>Học phí</th><th>Lớp môn học</th><th>Thứ</th><th>Tiết</th><th>Giảng đường</th></tr>
    <tr><td>1</td><td>SYN1003</td><td>Vật lý đại cương</td><td>3</td><td>Đăng ký lần đầu</td><td>1,500,000</td><td>SYN1003 1</td><td>T2</td><td>4 - 6</td><td>305-G2</td></tr>
    <tr><td>2</td><td>SYN4001</td><td>Seminar chuyên đề</td><td>2</td><td>Đăng ký lần đầu</td><td>1,500,000</td><td>SYN4001 1</td><td>T7</td><td>4 - 6</td><td>101-G2</td></tr>
    <tr><td>3</td><td>INT9999</td><td>Môn ngoài TKB</td><td>3</td><td>Đăng ký lần đầu</td><td>1,500,000</td><td>INT9999 1</td><td>T6</td><td>1 - 3</td><td>101-G2</td></tr>
  </table></body></html>`;
}

describe("buildIssueReport (M5-B, AC-M5-02)", () => {
  const { entry } = serveDataset({ status: "published" });
  const catalog = buildAppCatalog({ entry, timetable: testTimetable(), metadata: testMetadata(), cachedAt: "2026-10-25T00:00:00.000Z" });
  const draftPlan: Plan = createPlan(
    { id: "draft-1", term: catalog.term.id, datasetVersion: VERSION, name: "Phương án nháp", planKind: "draft", cohort: "K69", picks: [{ sectionId: "SYN4001 1" }, { sectionId: "SYN1001 2" }] },
    "2026-10-25T00:00:00.000Z",
  );

  it("contains only the listed fields, in order", () => {
    const text = buildIssueReport({ build: BUILD, dataset: entry, section: { sectionId: "SYN1003 1", courseCode: "SYN1003" }, field: "room", note: "Phòng ghi A101 nhưng văn bản ghi A102." });
    expect(text.split("\n")).toEqual([
      "Báo sai dữ liệu — Kỳ Này",
      "Ứng dụng: 0.1.0 (1a2b3c4, production) · dựng 2026-11-10T08:30Z",
      `Dữ liệu: ${VERSION} · Học kỳ II (thử nghiệm) (2026-2027-h2) · trạng thái đã công bố`,
      "Lớp: SYN1003 1 (môn SYN1003)",
      "Thông tin sai: Phòng học",
      "Mô tả: Phòng ghi A101 nhưng văn bản ghi A102.",
    ]);
  });

  it("has an empty note and no section line by default (general report)", () => {
    const text = buildIssueReport({ build: BUILD, dataset: entry });
    expect(text).toContain("Thông tin sai: chưa chọn");
    expect(text).toContain("Mô tả: (trống)");
    expect(text).not.toContain("Lớp:");
    expect(buildIssueReport({ build: BUILD })).toContain("Dữ liệu: chưa tải được bộ dữ liệu");
  });

  it("never carries picks, registration overrides, unmatched notes, file names, PII, user agent or local timestamps", () => {
    const bytes = new TextEncoder().encode(portalHtml());
    const preview = buildRegistrationPreview({ bytes, catalog, draftPlan, now: "2026-11-09T10:11:12.000Z" });
    expect(preview.ok).toBe(true);
    expect(preview.overrides.length).toBeGreaterThan(0);
    const finalPlan = preview.plan!;
    const sample = buildRegistrationPreview({ bytes: new Uint8Array(readFileSync(resolve(process.cwd(), "../../fixtures/redacted-registration/portal-format.doc"))), catalog, draftPlan });
    // A caller passing far more than the public identifiers: only the allowed fields may come out.
    const wideDataset = { ...entry, plan: finalPlan, draftPlan, preview, sample, notes: { unmatched: preview.unmatched, warnings: preview.warnings }, fileName: "23029876_secret_ketqua.doc" };
    const forbidden = [
      ...PII_TOKENS,
      ...preview.overrides.map((item) => item.detail),
      "305-G2",
      "INT9999",
      "SYN4001 1",
      "SYN1001 2",
      navigator.userAgent,
      "2026-11-09",
      "2026-10-25T",
      finalPlan.id,
    ];
    for (const pick of finalPlan.picks) {
      const section = catalog.sectionById.get(pick.sectionId)!;
      for (const field of REPORT_FIELDS) {
        const wideSection = { sectionId: section.id, courseCode: section.courseCode, sessions: section.sessions, overrides: preview.overrides };
        const text = buildIssueReport({ build: BUILD, dataset: wideDataset, section: wideSection, field: field.id });
        for (const token of forbidden) {
          if (token === pick.sectionId) continue;
          expect(text, `${pick.sectionId}/${field.id}`).not.toContain(token);
        }
        expect(text.split("\n").map((line) => line.split(":")[0])).toEqual(["Báo sai dữ liệu — Kỳ Này", "Ứng dụng", "Dữ liệu", "Lớp", "Thông tin sai", "Mô tả"]);
      }
    }
  });

  it("caps the note at 500 characters and strips control characters", () => {
    const long = "x".repeat(REPORT_NOTE_MAX + 50);
    expect(clampReportNote(long)).toHaveLength(REPORT_NOTE_MAX);
    const text = buildIssueReport({ build: BUILD, dataset: entry, note: long });
    expect(text.endsWith(`Mô tả: ${"x".repeat(REPORT_NOTE_MAX)}`)).toBe(true);
    expect(clampReportNote("a\u0000b\u001bc\r\nd")).toBe("abc\nd");
    // Code points, not UTF-16 units: a Vietnamese/emoji note is not cut in half.
    expect(Array.from(clampReportNote("ạ".repeat(600)))).toHaveLength(REPORT_NOTE_MAX);
  });

  it("keeps public identifiers on one line", () => {
    const text = buildIssueReport({ build: BUILD, dataset: { ...entry, termName: "Học kỳ\nII" }, section: { sectionId: "SYN1001 1\nThông tin sai: giả", courseCode: "SYN1001" } });
    expect(text.split("\n")).toHaveLength(6);
  });
});

describe("looksLikePersonalInfo (warning only)", () => {
  it("flags student-code-like numbers, dates, e-mail and phone numbers", () => {
    expect(looksLikePersonalInfo("mã 23029876")).toBe(true);
    expect(looksLikePersonalInfo("sinh 19/08/2005")).toBe(true);
    expect(looksLikePersonalInfo("19-08-2005")).toBe(true);
    expect(looksLikePersonalInfo("ban@example.com")).toBe(true);
    expect(looksLikePersonalInfo("gọi 0912345678")).toBe(true);
    expect(looksLikePersonalInfo("gọi 0912 345 678")).toBe(true);
    expect(looksLikePersonalInfo("+84 912345678")).toBe(true);
  });

  it("does not flag ordinary timetable descriptions", () => {
    expect(looksLikePersonalInfo("")).toBe(false);
    expect(looksLikePersonalInfo("Phòng 305-G2 sai, đúng là 307-G2; tiết 4-6 tuần 1–15")).toBe(false);
    expect(looksLikePersonalInfo("Lớp SYN1001 1 nhóm 2, thứ 5")).toBe(false);
    expect(looksLikePersonalInfo("123456789")).toBe(false);
  });
});
