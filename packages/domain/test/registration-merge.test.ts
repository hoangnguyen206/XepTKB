import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlan, isFixedSession, mergeRegistration, type Course, type DomainCatalog, type Section, type Session, type Term } from "../src/index.js";

const timetableSource = { artifactId: "m2-timetable", sourceType: "timetable" as const };
const registrationSource = { artifactId: "local-registration", sourceType: "registration" as const, sourceRow: 1 };
const term: Term = { id: "2026-h2", school: "uet", name: "HK II", teachingWeeks: 15, starts: [{ cohorts: ["K69"], week1: "2027-02-15" }], timezone: "Asia/Ho_Chi_Minh" };
const course: Course = { code: "INT2213", altCodes: ["UET.INT2213"], name: "Lập trình", normalizedName: "lap trinh", credits: 3, school: "uet" };
const baseSession: Session = { id: "base", day: 2, startPeriod: 1, endPeriod: 3, frame: "uet-default", weeks: [1, 2, 3, 4], kind: "LT", group: "CL", room: "203-G2", campus: "G2", lecturers: ["GV cũ"], source: timetableSource, confidence: "deterministic" };
const baseSection: Section = { id: "INT2213 1", courseCode: "INT2213", homeClasses: [], online: false, sessions: [baseSession], source: timetableSource, datasetVersion: "m2", warnings: [] };
const catalog: DomainCatalog = { courses: [course], sections: [baseSection], datasetVersion: "m2" };
const draft = createPlan({ id: "draft", term: term.id, datasetVersion: "m2", name: "Draft", planKind: "draft", picks: [{ sectionId: baseSection.id }] }, "2026-10-20T00:00:00.000Z");

function registrationSession(patch: Partial<Session> = {}): Session {
  return { ...baseSession, id: "registration", room: "305-G2", source: registrationSource, weekOrigin: "parser-default", ...patch } as Session;
}

function registrationSection(session: Session): Section {
  return { ...baseSection, sessions: [session], source: registrationSource, datasetVersion: "local-registration" };
}

test("registration room change is a targeted field-level override and creates final Plan", () => {
  const result = mergeRegistration({ plan: draft, catalog, registrationSections: [registrationSection(registrationSession())], term });
  assert.equal(result.plan.planKind, "final");
  assert.equal(result.plan.id, "draft:final");
  assert.equal(result.sections[0]!.sessions[0]!.room, "305-G2");
  assert.equal(result.overrides.length, 1);
  assert.equal(result.overrides[0]!.target.sessionId, "base");
  assert.equal(baseSection.sessions[0]!.room, "203-G2");
});

test("ambiguous timetable section identity fails closed", () => {
  const duplicate: Section = { ...baseSection, sessions: [{ ...baseSession, id: "duplicate" }] };
  const result = mergeRegistration({
    plan: draft,
    catalog: { ...catalog, sections: [baseSection, duplicate] },
    registrationSections: [registrationSection(registrationSession())],
    term,
  });
  assert.equal(result.matched.length, 0);
  assert.equal(result.overrides.length, 0);
  assert.equal(result.unmatched.length, 1);
  assert.ok(result.issues.some((issue) => issue.code === "REGISTRATION_OVERRIDE_AMBIGUOUS"));
});

test("invalid registration weeks are rejected instead of creating an invalid session", () => {
  const invalid = registrationSession({ weeks: [0, 2], weekOrigin: "explicit" });
  const result = mergeRegistration({ plan: draft, catalog, registrationSections: [registrationSection(invalid)], term });
  assert.ok(result.issues.some((issue) => issue.code === "INVALID_OVERRIDE_VALUE" && issue.field === "weeks"));
  assert.deepEqual(result.sections[0]!.sessions[0]!.weeks, baseSession.weeks);
  assert.equal(result.overrides.some((override) => override.field === "weeks"), false);
});

test("invalid registration periods are rejected instead of creating an invalid session", () => {
  const invalid = registrationSession({ startPeriod: 13, endPeriod: 1, weekOrigin: "explicit" });
  const result = mergeRegistration({ plan: draft, catalog, registrationSections: [registrationSection(invalid)], term });
  assert.ok(result.issues.some((issue) => issue.code === "INVALID_OVERRIDE_VALUE" && issue.field === "periods"));
  assert.ok(isFixedSession(result.sections[0]!.sessions[0]!));
  assert.equal(result.sections[0]!.sessions[0]!.startPeriod, baseSession.startPeriod);
  assert.equal(result.overrides.some((override) => override.field === "periods"), false);
});

test("unmatched registration is preserved as warning and does not add a pick", () => {
  const unknown = registrationSection(registrationSession({ id: "unknown" }));
  unknown.id = "MAT1051 1";
  unknown.courseCode = "MAT1051";
  const result = mergeRegistration({ plan: draft, catalog, registrationSections: [unknown], term });
  assert.equal(result.matched.length, 0);
  assert.equal(result.unmatched.length, 1);
  assert.ok(result.issues.some((issue) => issue.code === "REGISTRATION_OVERRIDE_UNMATCHED"));
  assert.deepEqual(result.plan.picks, draft.picks);
});


test("TH parser-default registration weeks apply ADR-0006 only during merge", () => {
  const thBase: Section = { ...baseSection, id: "MAT1051 1", courseCode: "MAT1051", sessions: [{ ...baseSession, id: "th", kind: "TH", weeks: [1, 2, 3], room: "A" }] };
  const thCourse: Course = { ...course, code: "MAT1051", altCodes: [], credits: 2 };
  const thCatalog: DomainCatalog = { courses: [thCourse], sections: [thBase], datasetVersion: "m2" };
  const thPlan = createPlan({ id: "p", term: term.id, datasetVersion: "m2", name: "P", planKind: "draft", picks: [{ sectionId: thBase.id }] }, "2026-10-20T00:00:00.000Z");
  const thRegistration: Section = { ...thBase, datasetVersion: "local-registration", source: registrationSource, sessions: [{ ...thBase.sessions[0]!, id: "reg-th", weekOrigin: "parser-default", room: "B" } as Session] };
  const result = mergeRegistration({ plan: thPlan, catalog: thCatalog, registrationSections: [thRegistration], term });
  assert.deepEqual(result.sections[0]!.sessions[0]!.weeks, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.ok(result.issues.some((issue) => issue.code === "REGISTRATION_DEFAULT_WEEKS"));
});
