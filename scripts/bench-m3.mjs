#!/usr/bin/env node
// Rough M3 NFR check (SPEC-M3-001 §7): search p95 < 100 ms and conflict p95 < 50 ms for ~1,000
// synthetic sections on the developer machine. Not a release budget (M5). Run after `npm run build`.
import { buildSearchIndex, createPlan, findConflicts, resolvePlanPicks, searchSections } from "../packages/domain/dist/src/index.js";
import { buildGridLayout, scheduledSessions } from "../packages/export/dist/src/index.js";

const source = { artifactId: "bench", sourceType: "timetable" };
const words = ["Giải tích", "Đại số", "Lập trình", "Mạng", "Hệ điều hành", "Cơ sở dữ liệu", "Vật lý", "Triết học", "Kinh tế", "Xác suất"];
const courses = [];
const sections = [];
for (let c = 0; c < 400; c += 1) {
  const code = `SYN${String(1000 + c)}`;
  courses.push({ code, altCodes: [], name: `${words[c % words.length]} ${c}`, normalizedName: "", credits: 3, school: "uet" });
  for (let s = 1; s <= 3; s += 1) {
    const day = 2 + ((c + s) % 6);
    const start = 1 + 3 * ((c + s) % 4);
    sections.push({ id: `${code} ${s}`, courseCode: code, homeClasses: [], online: false, datasetVersion: "bench", warnings: [], source, sessions: [
      { id: `${code}-${s}-lt`, day, startPeriod: start, endPeriod: start + 2, frame: "uet-default", weeks: Array.from({ length: 15 }, (_, i) => i + 1), kind: "LT", group: "CL", lecturers: [], source, confidence: "deterministic" },
      { id: `${code}-${s}-th`, day: 2 + ((day + 1) % 6), startPeriod: 7, endPeriod: 9, frame: "uet-default", weeks: Array.from({ length: 14 }, (_, i) => i + 2), kind: "TH", group: "CL", lecturers: [], source, confidence: "deterministic" },
    ] });
  }
}

function p95(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)];
}

const indexStart = performance.now();
const { index } = buildSearchIndex(courses, sections);
const indexMs = performance.now() - indexStart;
const queries = ["giai tich", "SYN1", "SYN1234", "lap trinh 12", "mang", "he dieu", "co so du lieu 3", "x", "triet hoc 99", "SYN13"];
const searchSamples = [];
for (let round = 0; round < 50; round += 1) {
  for (const query of queries) {
    const start = performance.now();
    searchSections(index, query, { limit: 400 });
    searchSamples.push(performance.now() - start);
  }
}

const catalog = { courses, sections, datasetVersion: "bench" };
const conflictSamples = [];
for (let round = 0; round < 200; round += 1) {
  const picks = Array.from({ length: 10 }, (_, i) => ({ sectionId: `SYN${1000 + ((round * 7 + i * 13) % 400)} ${1 + (i % 3)}` }));
  const plan = createPlan({ id: "p", term: "t", datasetVersion: "bench", name: "bench", planKind: "draft", picks }, "2026-10-25T00:00:00.000Z");
  const start = performance.now();
  const resolution = resolvePlanPicks(plan, catalog);
  const report = findConflicts(resolution.picks);
  buildGridLayout(scheduledSessions(resolution.picks, courses), { week: 3, maxPeriod: 12 });
  conflictSamples.push(performance.now() - start);
  if (round === 0 && report.conflicts.length === 0 && resolution.picks.length === 0) throw new Error("bench plan did not resolve");
}

const result = { sections: sections.length, indexBuildMs: +indexMs.toFixed(1), searchP95Ms: +p95(searchSamples).toFixed(2), conflictP95Ms: +p95(conflictSamples).toFixed(2) };
console.log(JSON.stringify(result));
if (result.searchP95Ms >= 100 || result.conflictP95Ms >= 50) process.exitCode = 1;
