#!/usr/bin/env node
// Builds the synthetic dataset served by apps/web in dev/preview/e2e (ADR-0010 §2).
// The workbook is invented test data — course codes use the SYN prefix and every artifact is
// labelled `synthetic-fixture`. It goes through the real `uet-xlsx` adapter and the build fails
// on any parser error, so the app never receives data the parser would reject.
// Usage: node scripts/build-synthetic-dataset.mjs [outDir]   (run `npm run build` first)
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SCHEMA_VERSION } from "../packages/domain/dist/src/index.js";
import { uetXlsxAdapter } from "../packages/parser/dist/src/index.js";
import { UET_TIMEFRAME } from "../packages/parser/dist/src/uet-config.js";
// Reuses the parser test helper that writes a minimal OOXML workbook.
import { syntheticXlsx } from "../packages/parser/dist/test/synthetic-xlsx.js";

const outDir = process.argv[2] ?? "apps/web/public/data";
const HEADERS = ["Lớp", "Mã HP", "Môn", "TC", "Mã LHP", "Nhóm", "Loại buổi", "Thứ", "Ca", "Tiết", "GĐ", "GV", "Ghi chú"];
const XSS_PROBE = '<img src=x onerror="window.__kyNayXss=1">';

// [lớp khóa, mã HP, tên, TC, mã LHP, nhóm, loại, thứ, ca, tiết, phòng, GV, ghi chú]
const ROWS = [
  ["K69-A", "SYN1001", "Giải tích 1", "4", "SYN1001 1", "CL", "LT", "T2", "", "1-3", "301-G2", "Mẫu An", "Học tuần 1-15"],
  ["K69-A", "SYN1001", "Giải tích 1", "4", "SYN1001 1", "1", "TH", "T4", "", "7-9", "PM 201-G2", "Mẫu Bình", "Học từ tuần 2"],
  ["K69-A", "SYN1001", "Giải tích 1", "4", "SYN1001 1", "2", "TH", "T5", "", "7-9", "PM 202-G2", "Mẫu Bình", "Học từ tuần 2"],
  ["K69-B", "SYN1001", "Giải tích 1", "4", "SYN1001 2", "CL", "LT", "T3", "", "4-6", "105-E3", "Mẫu Chi", "Học tuần 1-15"],
  ["K69-B", "SYN1001", "Giải tích 1", "4", "SYN1001 2", "1", "TH", "T6", "", "1-3", "PM 203-G2", "Mẫu Chi", "Học từ tuần 2"],
  ["K69-A", "SYN1002", "Đại số tuyến tính", "3", "SYN1002 1", "CL", "LT", "T2", "", "4-6", "203-G2", "Mẫu Dũng", "Học tuần 1-15"],
  ["K69-B", "SYN1002", "Đại số tuyến tính", "3", "SYN1002 2", "CL", "LT", "T3", "", "4-6", "ĐHKHTN 405-T5", "Mẫu Dũng", "Học tuần 1-8"],
  ["K69-A", "SYN1003", "Vật lý đại cương", "3", "SYN1003 1", "CL", "LT", "T2", "", "1-3", "Hòa Lạc A101", "Mẫu Giang", "Học tuần 9-15"],
  ["K69-B", "SYN1003", "Vật lý đại cương", "3", "SYN1003 2", "CL", "LT", "T4", "", "1-3", "Hòa Lạc A201", "Mẫu Giang", "Học tuần 1-8"],
  ["K69-A", "SYN1004", "Xác suất thống kê", "3", "SYN1004 1", "CL", "LT", "T5", "", "4-6", "Hòa Lạc A102", "Mẫu Hà", "Học tuần 1-15"],
  ["K69-A", "SYN2001", "Lập trình nâng cao", "4", "SYN2001 1", "CL", "LT", "T3", "", "7-9", "301-G2", "Mẫu Khánh", "Học tuần 1-15"],
  ["K69-A", "SYN2001", "Lập trình nâng cao", "4", "SYN2001 1", "1", "TH", "T5", "", "10-12", "PM 305-G2", "Mẫu Khánh", "Học từ tuần 2"],
  ["K69-A", "SYN2001", "Lập trình nâng cao", "4", "SYN2001 1", "2", "TH", "T6", "", "10-12", "PM 306-G2", "Mẫu Lan", "Học từ tuần 2"],
  ["K69-A", "SYN2002", "Cấu trúc dữ liệu và giải thuật", "4", "SYN2002 1", "CL", "LT", "T4", "", "4-6", "ĐHKHTN 101-T1", "Mẫu Minh", "Học tuần 1-15"],
  ["K69-A", "SYN2003", "Kiến trúc máy tính", "3", "SYN2003 1", "CL", "LT", "T6", "", "4-6", "107-E3", "Mẫu Nam", "Học tuần 4, 7, 10, 14"],
  ["K69-A", "SYN2004", "Mạng máy tính", "3", "SYN2004 1", "CL", "LT", "T7", "", "1-3", "201-G2", "Mẫu Oanh", "Học tuần 1-15"],
  ["K69-A", "SYN2005", "Cơ sở dữ liệu", "3", "SYN2005 1", "CL", "LT", "T2", "3", "", "202-G2", "Mẫu Phúc", "Học tuần 1-15. Học tiết 10-12"],
  ["K69-A", "SYN2006", "Hệ điều hành", "3", "SYN2006 1", "CL", "LT", "T3", "Sáng", "", "204-G2", "Mẫu Quân", "Học tuần 9-15"],
  ["K69-A", "SYN3001", "Kỹ năng số", "2", "SYN3001 1", "CL", "ONL", "", "", "", "", "Mẫu Sơn", ""],
  ["K69-B", "SYN3001", "Kỹ năng số", "2", "SYN3001 2", "CL", "Online", "T6", "", "7-9", "", "Mẫu Sơn", ""],
  ["K69-A", "SYN3003", "Triết học", "3", "SYN3003 1", "CL", "LT", "T5", "", "1-3", "301-G2", "Mẫu Tâm", "Học tuần 1-15"],
  ["K69-B", "SYN3003", "Triết học", "3", "SYN3003 2", "CL", "LT", "T6", "", "7-9", "302-G2", "Mẫu Tâm", "Học tuần 1-15"],
  ["K69-A", "SYN3005", "Giáo dục thể chất", "1", "SYN3005 1", "CL", "TH", "CN", "", "1-3", "Sân tập", "Mẫu Uyên", "Học tuần 1-10"],
  ["K69-A", "SYN4001", "Seminar chuyên đề", "", "SYN4001 1", "CL", "LT", "T7", "", "4-6", "203-G2", "Mẫu Vy", "Học tuần 3-12"],
  ["K69-A", "SYN9999", "Kiểm thử hiển thị", "2", "SYN9999 1", "CL", "LT", "T7", "", "7-9", "301-G2", XSS_PROBE, "Học tuần 1-15"],
];

const TERMS = [
  {
    id: "2026-2027-h2",
    name: "Học kỳ II 2026–2027 (dữ liệu mẫu)",
    datasetVersion: "synthetic-uet-2026-2027-h2.1",
    starts: [{ cohorts: ["K67", "K68", "K69", "K70", "K71"], week1: "2027-02-15" }],
  },
  {
    id: "2026-2027-h1",
    name: "Học kỳ I 2026–2027 (dữ liệu mẫu)",
    datasetVersion: "synthetic-uet-2026-2027-h1.1",
    starts: [{ cohorts: ["K67", "K68", "K69", "K70"], week1: "2026-09-07" }, { cohorts: ["K71"], week1: "2026-10-12" }],
  },
];
const TEACHING_WEEKS = 15;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function writeJson(relativePath, value) {
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  const target = join(outDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return { url: relativePath.replace(/\\/g, "/"), sha256: sha256(bytes), bytes: bytes.length };
}

rmSync(outDir, { recursive: true, force: true });
const workbook = syntheticXlsx([{ name: "TKB mẫu", rows: [HEADERS, ...ROWS] }]);
const datasets = [];
for (const term of TERMS) {
  const result = uetXlsxAdapter.parse({ bytes: workbook, context: { term: term.id, teachingWeeks: TEACHING_WEEKS, datasetVersion: term.datasetVersion } });
  const errors = result.issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    console.error(`build-synthetic-dataset: parser errors for ${term.id}:`);
    for (const issue of errors) console.error(`  ${issue.code} row ${issue.sourceRow ?? "-"} ${issue.message}`);
    process.exit(1);
  }
  const base = `schools/uet/terms/${term.id}/${term.datasetVersion}`;
  const timetable = writeJson(`${base}/timetable.json`, { schemaVersion: SCHEMA_VERSION, datasetVersion: term.datasetVersion, school: "uet", term: term.id, courses: result.courses, sections: result.sections });
  const metadata = writeJson(`${base}/metadata.json`, {
    schemaVersion: "1.0",
    datasetVersion: term.datasetVersion,
    school: "uet",
    term: { id: term.id, school: "uet", name: term.name, teachingWeeks: TEACHING_WEEKS, starts: term.starts, timezone: "Asia/Ho_Chi_Minh" },
    timeFrame: UET_TIMEFRAME,
  });
  datasets.push({
    datasetVersion: term.datasetVersion,
    school: "uet",
    term: term.id,
    termName: term.name,
    status: "candidate",
    source: { type: "synthetic-fixture", documentRef: "SYNTHETIC-M3-WORKBOOK", publishedBy: "data-steward (synthetic build)", importHash: `sha256:${sha256(workbook)}` },
    parserVersion: result.artifact.parserVersion,
    domainSchemaVersion: SCHEMA_VERSION,
    importedAt: new Date().toISOString(),
    artifacts: [{ kind: "timetable", ...timetable }, { kind: "metadata", ...metadata }],
  });
  const warnings = [...new Set(result.issues.map((issue) => issue.code))].join(", ");
  console.log(`build-synthetic-dataset: ${term.id} — ${result.sections.length} sections, ${result.courses.length} courses (warnings: ${warnings || "none"})`);
}
writeJson("manifest.json", { schemaVersion: "1.0", generatedAt: new Date().toISOString(), datasets });
console.log(`build-synthetic-dataset: wrote ${outDir}/manifest.json`);
