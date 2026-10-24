import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePlanCredits, createPlan, findConflicts, isFixedSession, mergeRegistration, resolvePlanPicks, validatePlan, type Course, type DomainCatalog, type Section, type Session, type Term } from "../src/index.js";

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

test("unmatched registration is preserved as warning and is not added to the final Plan", () => {
  const unknown = registrationSection(registrationSession({ id: "unknown" }));
  unknown.id = "MAT1051 1";
  unknown.courseCode = "MAT1051";
  const result = mergeRegistration({ plan: draft, catalog, registrationSections: [unknown], term });
  assert.equal(result.matched.length, 0);
  assert.equal(result.unmatched.length, 1);
  assert.ok(result.issues.some((issue) => issue.code === "REGISTRATION_OVERRIDE_UNMATCHED"));
  assert.deepEqual(result.plan.picks, []);
  assert.deepEqual(draft.picks, [{ sectionId: baseSection.id }]);
});

const otherSection: Section = { ...baseSection, id: "INT2213 2", sessions: [{ ...baseSession, id: "other", day: 5, room: "101-G2" }] };
const twoSectionCatalog: DomainCatalog = { ...catalog, sections: [baseSection, otherSection] };

test("final Plan lists the registered sections, not the draft picks", () => {
  const registered = { ...registrationSection(registrationSession({ day: 5 })), id: otherSection.id };
  const fromDraft = mergeRegistration({ plan: draft, catalog: twoSectionCatalog, registrationSections: [registered], term });
  assert.deepEqual(fromDraft.plan.picks, [{ sectionId: otherSection.id }]);
  assert.deepEqual(draft.picks, [{ sectionId: baseSection.id }]);
  const empty = createPlan({ id: "empty", term: term.id, datasetVersion: "m2", name: "Empty", planKind: "draft" }, "2026-10-20T00:00:00.000Z");
  const fromEmpty = mergeRegistration({ plan: empty, catalog: twoSectionCatalog, registrationSections: [registered], term });
  assert.deepEqual(fromEmpty.plan.picks, [{ sectionId: otherSection.id }]);
  assert.equal(fromEmpty.issues.some((issue) => issue.severity === "error"), false);
});

test("AC-05 registration time change overrides day and periods", () => {
  const moved = registrationSession({ day: 4, startPeriod: 7, endPeriod: 9 });
  const result = mergeRegistration({ plan: draft, catalog, registrationSections: [registrationSection(moved)], term });
  const session = result.sections[0]!.sessions[0]!;
  assert.ok(isFixedSession(session));
  assert.deepEqual([session.day, session.startPeriod, session.endPeriod], [4, 7, 9]);
  assert.deepEqual(result.overrides.map((override) => override.field).sort(), ["day", "periods", "room"]);
  assert.equal(session.source.sourceType, "registration");
});

test("re-import replaces the earlier registration override and user override keeps precedence", () => {
  const first = mergeRegistration({ plan: draft, catalog, registrationSections: [registrationSection(registrationSession())], term });
  const second = mergeRegistration({ plan: first.plan, catalog, registrationSections: [registrationSection(registrationSession({ room: "406-G2" }))], term });
  assert.equal(second.sections[0]!.sessions[0]!.room, "406-G2");
  assert.deepEqual(second.plan.overrides.filter((override) => override.field === "room").map((override) => override.to), ["406-G2"]);
  assert.equal(validatePlan(second.plan, catalog, term).length, 0);
  const pinned = { ...draft, overrides: [{ target: { sectionId: baseSection.id, sessionId: "base" }, field: "room" as const, to: "Lab-1", source: "user" as const }] };
  const withUser = mergeRegistration({ plan: pinned, catalog, registrationSections: [registrationSection(registrationSession())], term });
  assert.equal(withUser.sections[0]!.sessions[0]!.room, "Lab-1");
  assert.deepEqual(withUser.plan.overrides.map((override) => override.source).sort(), ["registration", "user"]);
});

test("legacy registration candidate without weekOrigin does not override timetable weeks", () => {
  const legacy = registrationSession({ weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] });
  delete legacy.weekOrigin;
  const result = mergeRegistration({ plan: draft, catalog, registrationSections: [registrationSection(legacy)], term });
  assert.deepEqual(result.sections[0]!.sessions[0]!.weeks, baseSession.weeks);
  assert.equal(result.overrides.some((override) => override.field === "weeks"), false);
});

test("registration rows of one section are merged into a single pick", () => {
  const thSession: Session = { ...baseSession, id: "th-1", day: 6, kind: "TH", group: "1", room: "Lab-A" };
  const multi: Section = { ...baseSection, sessions: [baseSession, thSession] };
  const multiCatalog: DomainCatalog = { ...catalog, sections: [multi] };
  const ltRow = registrationSection(registrationSession());
  const thRow = registrationSection(registrationSession({ id: "registration-th", day: 6, kind: "TH", group: "1", room: "Lab-B" }));
  const result = mergeRegistration({ plan: draft, catalog: multiCatalog, registrationSections: [ltRow, thRow], term });
  assert.deepEqual(result.plan.picks, [{ sectionId: multi.id, group: "1" }]);
  assert.deepEqual(result.sections[0]!.sessions.map((session) => session.room), ["305-G2", "Lab-B"]);
  assert.equal(result.matched.length, 1);
});


test("ONL registration joins the final Plan, counts credits and never conflicts (Q-009)", () => {
  const onlineSession: Session = { id: "onl", fixedTime: false, frame: "uet-default", weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], weekOrigin: "explicit", kind: "ONL", group: "CL", lecturers: [], source: timetableSource, confidence: "deterministic" };
  const onlineSection: Section = { ...baseSection, id: "INT3999 1", courseCode: "INT3999", online: true, sessions: [onlineSession] };
  const onlineCourse: Course = { ...course, code: "INT3999", altCodes: [], name: "Trực tuyến", normalizedName: "truc tuyen", credits: 2 };
  const onlineCatalog: DomainCatalog = { courses: [course, onlineCourse], sections: [baseSection, onlineSection], datasetVersion: "m2" };
  const registered: Section = { ...onlineSection, source: registrationSource, datasetVersion: "local-registration", sessions: [{ ...onlineSession, id: "reg-onl", weekOrigin: "parser-default", room: "LMS", source: registrationSource }] };
  const result = mergeRegistration({ plan: draft, catalog: onlineCatalog, registrationSections: [registrationSection(registrationSession()), registered], term });
  assert.deepEqual(result.plan.picks.map((pick) => pick.sectionId), [baseSection.id, onlineSection.id]);
  assert.equal(result.issues.some((issue) => issue.code === "REGISTRATION_OVERRIDE_UNMATCHED"), false);
  const effective = { ...onlineCatalog, sections: result.sections };
  assert.equal(calculatePlanCredits(result.plan, effective).knownTotal, 5);
  assert.equal(findConflicts(resolvePlanPicks(result.plan, effective).picks).conflicts.length, 0);
});

function mergeTh(timetableWeeks: Partial<Session>) {
  const thBase: Section = { ...baseSection, id: "MAT1051 1", courseCode: "MAT1051", sessions: [{ ...baseSession, id: "th", kind: "TH", room: "A", ...timetableWeeks } as Session] };
  const thCourse: Course = { ...course, code: "MAT1051", altCodes: [], credits: 2 };
  const thCatalog: DomainCatalog = { courses: [thCourse], sections: [thBase], datasetVersion: "m2" };
  const thPlan = createPlan({ id: "p", term: term.id, datasetVersion: "m2", name: "P", planKind: "draft", picks: [{ sectionId: thBase.id }] }, "2026-10-20T00:00:00.000Z");
  const thRegistration: Section = { ...thBase, datasetVersion: "local-registration", source: registrationSource, sessions: [{ ...thBase.sessions[0]!, id: "reg-th", weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], weekOrigin: "parser-default", room: "B" } as Session] };
  return mergeRegistration({ plan: thPlan, catalog: thCatalog, registrationSections: [thRegistration], term });
}

test("TH registration default weeks apply ADR-0006 when the timetable weeks are a parser default", () => {
  const result = mergeTh({ weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], weekOrigin: "parser-default" });
  assert.deepEqual(result.sections[0]!.sessions[0]!.weeks, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.ok(result.issues.some((issue) => issue.code === "REGISTRATION_DEFAULT_WEEKS"));
});

test("explicit timetable weeks win over the TH registration default (Q-010)", () => {
  for (const timetableWeeks of [{ weeks: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15], weekOrigin: "explicit" as const }, { weeks: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }]) {
    const result = mergeTh(timetableWeeks);
    assert.deepEqual(result.sections[0]!.sessions[0]!.weeks, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    assert.equal(result.overrides.some((override) => override.field === "weeks"), false);
    assert.equal(result.issues.some((issue) => issue.code === "REGISTRATION_DEFAULT_WEEKS"), false);
    assert.equal(result.sections[0]!.sessions[0]!.room, "B");
  }
});
