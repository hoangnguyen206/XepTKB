/** In-memory synthetic dataset + fetch stub for unit/component tests (no real school data). */
import { createHash } from "node:crypto";
import type { Course, Section, Session } from "@ky-nay/domain";
import type { DatasetEntry, DatasetManifest, MetadataArtifact, TimetableArtifact } from "../data/contract.js";

export const VERSION = "test-uet-h2.1";
export const TERM = "2026-2027-h2";

const source = { artifactId: "uet-xlsx:test", sourceType: "timetable" as const };

function fixed(id: string, day: number, start: number, end: number, weeks: number[], patch: Partial<Session> = {}): Session {
  return { id, day, startPeriod: start, endPeriod: end, frame: "uet-default", weeks, weekOrigin: "explicit", kind: "LT", group: "CL", lecturers: ["Mẫu An"], source, confidence: "deterministic", ...patch } as Session;
}

const all = Array.from({ length: 15 }, (_, index) => index + 1);

export function testTimetable(version = VERSION): TimetableArtifact {
  const section = (id: string, courseCode: string, sessions: Session[], patch: Partial<Section> = {}): Section => ({ id, courseCode, homeClasses: ["K69-A"], online: false, sessions, source, datasetVersion: version, warnings: [], ...patch });
  const courses: Course[] = [
    { code: "SYN1001", altCodes: ["UET.SYN1001"], name: "Giải tích 1", normalizedName: "giai tich 1", credits: 4, school: "uet" },
    { code: "SYN1003", altCodes: [], name: "Vật lý đại cương", normalizedName: "vat ly dai cuong", credits: 3, school: "uet" },
    { code: "SYN3001", altCodes: [], name: "Kỹ năng số", normalizedName: "ky nang so", credits: 2, school: "uet" },
    { code: "SYN4001", altCodes: [], name: "Seminar chuyên đề", normalizedName: "seminar chuyen de", school: "uet" },
    { code: "SYN9999", altCodes: [], name: "Kiểm thử hiển thị", normalizedName: "kiem thu hien thi", credits: 2, school: "uet" },
  ];
  const sections: Section[] = [
    section("SYN1001 1", "SYN1001", [fixed("s1", 2, 1, 3, all), fixed("g1", 4, 7, 9, all.slice(1), { kind: "TH", group: "1" }), fixed("g2", 5, 7, 9, all.slice(1), { kind: "TH", group: "2" })]),
    section("SYN1001 2", "SYN1001", [fixed("s2", 3, 4, 6, all)]),
    section("SYN1003 1", "SYN1003", [fixed("s3", 2, 1, 3, [9, 10, 11, 12, 13, 14, 15], { room: "Hòa Lạc A101", campus: "Hòa Lạc" })]),
    section("SYN1003 2", "SYN1003", [fixed("s4", 2, 4, 6, [1, 2, 3], { room: "Hòa Lạc A201", campus: "Hòa Lạc" })]),
    section("SYN3001 1", "SYN3001", [{ id: "o1", fixedTime: false, frame: "uet-default", weeks: all, weekOrigin: "parser-default", kind: "ONL", group: "CL", lecturers: [], source, confidence: "deterministic" }], { online: true }),
    section("SYN4001 1", "SYN4001", [fixed("s5", 7, 4, 6, [3, 4, 5])]),
    section("SYN9999 1", "SYN9999", [fixed("s6", 7, 7, 9, all, { lecturers: ['<img src=x onerror="window.__kyNayXss=1">'] })]),
  ];
  return { schemaVersion: "0.2.0", datasetVersion: version, school: "uet", term: TERM, courses, sections };
}

export function testMetadata(version = VERSION): MetadataArtifact {
  const times = [["07:00", "07:50"], ["07:55", "08:45"], ["08:50", "09:40"], ["09:50", "10:40"], ["10:45", "11:35"], ["11:40", "12:30"], ["13:30", "14:20"], ["14:25", "15:15"], ["15:20", "16:10"], ["16:20", "17:10"], ["17:15", "18:05"], ["18:10", "19:00"]];
  return {
    schemaVersion: "1.0",
    datasetVersion: version,
    school: "uet",
    term: { id: TERM, school: "uet", name: "Học kỳ II (thử nghiệm)", teachingWeeks: 15, starts: [{ cohorts: ["K67", "K68", "K69"], week1: "2027-02-15" }, { cohorts: ["K71"], week1: "2027-02-22" }], timezone: "Asia/Ho_Chi_Minh" },
    timeFrame: { id: "uet-default", school: "uet", periods: times.map(([start, end], index) => ({ no: index + 1, start: start!, end: end! })), shifts: [], timezone: "Asia/Ho_Chi_Minh" },
  };
}

export type ServedFiles = Map<string, string>;

function sha(text: string): string {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

/** Serves a manifest + artifacts. `mutate` can corrupt files after hashing to test integrity checks. */
export function serveDataset(options: { version?: string; status?: DatasetEntry["status"]; timetable?: TimetableArtifact; metadata?: MetadataArtifact; extraEntries?: DatasetEntry[] } = {}): { files: ServedFiles; manifest: DatasetManifest; entry: DatasetEntry } {
  const version = options.version ?? VERSION;
  const timetable = JSON.stringify(options.timetable ?? testTimetable(version));
  const metadata = JSON.stringify(options.metadata ?? testMetadata(version));
  const base = `schools/uet/terms/${TERM}/${version}`;
  const entry: DatasetEntry = {
    datasetVersion: version,
    school: "uet",
    term: TERM,
    termName: "Học kỳ II (thử nghiệm)",
    status: options.status ?? "candidate",
    source: { type: "synthetic-fixture", documentRef: "TEST", publishedBy: "test", importHash: "sha256:test" },
    parserVersion: "uet-xlsx@0.1.0",
    domainSchemaVersion: "0.2.0",
    importedAt: "2026-10-25T00:00:00.000Z",
    artifacts: [
      { kind: "timetable", url: `${base}/timetable.json`, sha256: sha(timetable), bytes: Buffer.byteLength(timetable) },
      { kind: "metadata", url: `${base}/metadata.json`, sha256: sha(metadata), bytes: Buffer.byteLength(metadata) },
    ],
  };
  const manifest: DatasetManifest = { schemaVersion: "1.0", generatedAt: "2026-10-25T00:00:00.000Z", datasets: [...(options.extraEntries ?? []), entry] };
  const files: ServedFiles = new Map([
    ["data/manifest.json", JSON.stringify(manifest)],
    [`data/${base}/timetable.json`, timetable],
    [`data/${base}/metadata.json`, metadata],
  ]);
  return { files, manifest, entry };
}

/** fetch stub over `files`; `offline` simulates a network failure. Records requested URLs. */
export function stubFetch(files: ServedFiles, state: { offline?: boolean; requests?: string[] } = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    state.requests?.push(url);
    if (state.offline) throw new TypeError("Failed to fetch");
    const body = files.get(url);
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}
