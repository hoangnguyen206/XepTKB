/**
 * Pure registration-to-timetable merge for M2.
 * Registration is a field-level overlay; source Sections remain immutable.
 */
import { domainIssue, type DomainIssue } from "./issues.js";
import { buildCourseCodeAliases, canonicalSectionId, normalizeCourseCode, normalizeGroup, normalizeSectionId, sectionParts } from "./normalize.js";
import { isFixedSession, type DomainCatalog, type FixedSession, type Override, type Plan, type PlanPick, type Section, type Session, type Term } from "./types.js";

export type RegistrationMatch = {
  registrationSection: Section;
  timetableSection: Section;
  sessionPairs: readonly { registration: Session; timetable: Session }[];
};

export type RegistrationMergeInput = {
  plan: Plan;
  catalog: DomainCatalog;
  registrationSections: readonly Section[];
  term: Term;
};

export type RegistrationMergeResult = {
  plan: Plan;
  sections: readonly Section[];
  overrides: readonly Override[];
  matched: readonly RegistrationMatch[];
  unmatched: readonly Section[];
  issues: readonly DomainIssue[];
};

function fieldValue(session: Session, field: Override["field"]): unknown {
  if (field === "periods") return isFixedSession(session) ? { startPeriod: session.startPeriod, endPeriod: session.endPeriod } : undefined;
  if (field === "lecturer") return session.lecturers;
  return session[field];
}

function hasField(session: Session, field: Override["field"]): boolean {
  if (field === "periods") return isFixedSession(session);
  if (field === "lecturer") return session.lecturers.length > 0;
  return Object.prototype.hasOwnProperty.call(session, field);
}

function validWeeks(value: unknown, teachingWeeks: number): value is number[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((week) => Number.isInteger(week) && week >= 1 && week <= teachingWeeks)
    && value.every((week, index) => index === 0 || week > value[index - 1]!);
}

function validOverrideValue(session: Session, field: Override["field"], value: unknown, teachingWeeks: number, maxPeriod: number): boolean {
  if (field === "periods") {
    if (!isFixedSession(session) || typeof value !== "object" || value === null) return false;
    const periods = value as { startPeriod?: unknown; endPeriod?: unknown };
    return Number.isInteger(periods.startPeriod)
      && Number.isInteger(periods.endPeriod)
      && Number(periods.startPeriod) >= 1
      && Number(periods.endPeriod) <= maxPeriod
      && Number(periods.startPeriod) <= Number(periods.endPeriod);
  }
  if (field === "day") return isFixedSession(session) && Number.isInteger(value) && Number(value) >= 2 && Number(value) <= 8;
  if (field === "weeks") return validWeeks(value, teachingWeeks);
  if (field === "lecturer") return Array.isArray(value) && value.every((lecturer) => typeof lecturer === "string");
  return value === undefined || typeof value === "string";
}

function maxPeriodFor(session: Session, catalog: DomainCatalog): number {
  const frame = catalog.timeFrames?.find((candidate) => candidate.id === session.frame);
  const periods = frame?.periods.map((period) => period.no).filter(Number.isInteger) ?? [];
  return periods.length > 0 ? Math.max(...periods) : 12;
}

function equalField(left: Session, right: Session, field: Override["field"]): boolean {
  const leftValue = fieldValue(left, field);
  const rightValue = fieldValue(right, field);
  if (Array.isArray(leftValue) || Array.isArray(rightValue) || (typeof leftValue === "object" && leftValue !== null) || (typeof rightValue === "object" && rightValue !== null)) {
    return JSON.stringify(leftValue) === JSON.stringify(rightValue);
  }
  return leftValue === rightValue;
}
function cloneSession(session: Session): Session {
  return {
    ...session,
    weeks: [...session.weeks],
    lecturers: [...session.lecturers],
    source: { ...session.source },
  };
}

function applyField(session: Session, field: Override["field"], value: unknown, teachingWeeks: number, maxPeriod: number): Session | undefined {
  if (!validOverrideValue(session, field, value, teachingWeeks, maxPeriod)) return undefined;
  const next = cloneSession(session) as Record<string, unknown>;
  if (field === "periods") {
    const periods = value as { startPeriod: number; endPeriod: number };
    next.startPeriod = periods.startPeriod;
    next.endPeriod = periods.endPeriod;
  } else if (field === "day") {
    next.day = value;
  } else if (field === "weeks") {
    next.weeks = [...(value as number[])];
  } else if (field === "lecturer") {
    next.lecturers = [...(value as string[])];
  } else if (field === "room" || field === "campus") {
    next[field] = value;
  }
  return next as Session;
}

function candidateSessions(registration: Session, timetable: readonly Session[]): Session[] {
  const registrationGroup = normalizeGroup(registration.group);
  // The portal export has no session-kind column (C-09), so its sessions arrive as OTHER and are matched by day/periods.
  const kindMatches = (candidate: Session) => registration.kind === "OTHER" || candidate.kind === registration.kind;
  const byKindGroup = timetable.filter((candidate) => kindMatches(candidate) && (registrationGroup === undefined || normalizeGroup(candidate.group) === registrationGroup || normalizeGroup(candidate.group) === "CL"));
  if (byKindGroup.length <= 1) return byKindGroup;
  const byDay = isFixedSession(registration) ? byKindGroup.filter((candidate) => isFixedSession(candidate) && candidate.day === registration.day) : byKindGroup;
  if (byDay.length <= 1) return byDay;
  const byPeriods = isFixedSession(registration)
    ? byDay.filter((candidate) => isFixedSession(candidate) && candidate.startPeriod === registration.startPeriod && candidate.endPeriod === registration.endPeriod)
    : byDay;
  return byPeriods;
}

function matchSessions(registration: Section, timetable: Section): { pairs: { registration: Session; timetable: Session }[]; issues: DomainIssue[] } {
  const pairs: { registration: Session; timetable: Session }[] = [];
  const issues: DomainIssue[] = [];
  const used = new Set<string>();
  for (const registrationSession of registration.sessions) {
    const candidates = candidateSessions(registrationSession, timetable.sessions).filter((candidate) => !used.has(candidate.id));
    if (candidates.length === 0) {
      issues.push(domainIssue("REGISTRATION_OVERRIDE_UNMATCHED", "warning", `registration session ${registrationSession.id} did not match timetable section ${timetable.id}`, { sectionId: timetable.id, sessionId: registrationSession.id }));
      continue;
    }
    if (candidates.length > 1) {
      issues.push(domainIssue("REGISTRATION_OVERRIDE_AMBIGUOUS", "warning", `registration session ${registrationSession.id} matched multiple timetable sessions`, { sectionId: timetable.id, sessionId: registrationSession.id }));
      continue;
    }
    const timetableSession = candidates[0]!;
    used.add(timetableSession.id);
    pairs.push({ registration: registrationSession, timetable: timetableSession });
  }
  return { pairs, issues };
}

function sectionMatchKey(section: Section, aliases: ReadonlyMap<string, string>): string {
  const parts = sectionParts(section.id);
  if (!parts) return canonicalSectionId(section.id, aliases);
  const courseCode = aliases.get(normalizeCourseCode(parts.courseCode)) ?? normalizeCourseCode(parts.courseCode);
  return `${courseCode} ${parts.suffix}`;
}

/** ADR-0009: a registration candidate without `weekOrigin` (0.1.0 shape) is treated as parser-default. */
function hasDefaultWeeks(session: Session): boolean {
  return session.weekOrigin === undefined || session.weekOrigin === "parser-default";
}

/** ADR-0006 + Q-010: the TH default applies only when the timetable weeks are a parser default too; explicit timetable weeks win. */
function registrationWeeks(session: Session, base: Session, teachingWeeks: number): { session: Session; defaulted: boolean } {
  // A portal row has no kind (OTHER); the matched timetable session tells whether it is TH.
  const kind = session.kind === "OTHER" ? base.kind : session.kind;
  if (kind !== "TH" || !hasDefaultWeeks(session) || base.weekOrigin !== "parser-default") return { session, defaulted: false };
  const next = cloneSession(session);
  next.weeks = Array.from({ length: Math.max(0, teachingWeeks - 1) }, (_, index) => index + 2);
  next.weekOrigin = "registration-default";
  return { session: next, defaulted: true };
}

function overridesForPair(base: Session, registration: Session, sectionId: string, teachingWeeks: number, maxPeriod: number): { session: Session; overrides: Override[]; issues: DomainIssue[] } {
  const normalizedRegistration = registrationWeeks(registration, base, teachingWeeks);
  const nextRegistration = normalizedRegistration.session;
  const overrides: Override[] = [];
  const issues: DomainIssue[] = [];
  const fields: Override["field"][] = ["room", "campus", "day", "periods", "weeks", "lecturer"];
  let merged = cloneSession(base);
  for (const field of fields) {
    if (field === "weeks" && hasDefaultWeeks(nextRegistration)) continue;
    if (!hasField(nextRegistration, field) || equalField(base, nextRegistration, field)) continue;
    const value = fieldValue(nextRegistration, field);
    const applied = applyField(merged, field, value, teachingWeeks, maxPeriod);
    if (!applied) {
      issues.push(domainIssue("INVALID_OVERRIDE_VALUE", "error", `registration value for ${field} is invalid`, { sectionId, sessionId: base.id, field }));
      continue;
    }
    merged = applied;
    overrides.push({
      target: { sectionId, sessionId: base.id },
      field,
      from: fieldValue(base, field),
      to: value,
      source: "registration",
      reason: normalizedRegistration.defaulted && field === "weeks" ? "ADR-0006 TH registration default" : "registration result overrides timetable field",
    });
  }
  if (overrides.length > 0) merged.source = { ...nextRegistration.source };
  if (normalizedRegistration.defaulted) issues.push(domainIssue("REGISTRATION_DEFAULT_WEEKS", "warning", `TH session ${nextRegistration.id} defaulted to weeks 2..${teachingWeeks}`, { sectionId, sessionId: base.id }));
  return { session: merged, overrides, issues };
}

/** `overrides` must already be limited to the section identified by `sectionId`. */
function applyExistingOverrides(session: Session, sectionId: string, overrides: readonly Override[], teachingWeeks: number, maxPeriod: number): { session: Session; issues: DomainIssue[] } {
  const relevant = overrides.filter((override) => override.target.sessionId === session.id);
  const issues: DomainIssue[] = [];
  const byField = new Map<string, Override>();
  let next = cloneSession(session);
  const rank = { registration: 1, "admin-correction": 2, user: 3 } as const;
  for (const override of [...relevant].sort((a, b) => rank[a.source] - rank[b.source])) {
    const prior = byField.get(override.field);
    if (prior && rank[prior.source] === rank[override.source] && JSON.stringify(prior.to) !== JSON.stringify(override.to)) {
      issues.push(domainIssue("CONFLICTING_OVERRIDES", "error", `conflicting ${override.field} overrides for ${sectionId}/${session.id}`, { sectionId, sessionId: session.id, field: override.field }));
      continue;
    }
    byField.set(override.field, override);
    const applied = applyField(next, override.field, override.to, teachingWeeks, maxPeriod);
    if (!applied) issues.push(domainIssue("INVALID_OVERRIDE_VALUE", "error", `invalid ${override.field} override for ${sectionId}/${session.id}`, { sectionId, sessionId: session.id, field: override.field }));
    else next = applied;
  }
  return { session: next, issues };
}

function nonClassGroups(sessions: readonly Session[]): string[] {
  return [...new Set(sessions.map((session) => normalizeGroup(session.group)).filter((group): group is string => group !== undefined && group !== "CL"))];
}

function registrationPick(timetable: Section, registration: Section, pairs: readonly { timetable: Session }[]): PlanPick {
  // The group comes from the registration rows. The portal export has no group column (C-09), so its group is the one of
  // the timetable sessions it matched uniquely; a missing or multi-valued group is left for resolvePlanPicks to report.
  const fromRows = nonClassGroups(registration.sessions);
  const groups = fromRows.length > 0 ? fromRows : nonClassGroups(pairs.map((pair) => pair.timetable));
  return groups.length === 1 ? { sectionId: timetable.id, group: groups[0]! } : { sectionId: timetable.id };
}

export function mergeRegistration(input: RegistrationMergeInput): RegistrationMergeResult {
  const aliases = buildCourseCodeAliases(input.catalog.courses).aliases;
  const sectionsByKey = new Map<string, Section[]>();
  for (const section of input.catalog.sections) {
    const key = sectionMatchKey(section, aliases);
    const candidates = sectionsByKey.get(key) ?? [];
    candidates.push(section);
    sectionsByKey.set(key, candidates);
  }
  const effective = new Map(input.catalog.sections.map((section) => [section.id, section] as const));
  const overrides: Override[] = [];
  const matched: RegistrationMatch[] = [];
  const unmatched: Section[] = [];
  const issues: DomainIssue[] = [];
  // One registered section may span several rows (e.g. LT and TH); group them so each timetable section is merged once.
  const registered = new Map<string, { timetable: Section; rows: Section[] }>();
  for (const originalRegistration of input.registrationSections) {
    const key = sectionMatchKey(originalRegistration, aliases);
    const candidates = sectionsByKey.get(key) ?? [];
    if (candidates.length === 0) {
      unmatched.push(originalRegistration);
      issues.push(domainIssue("REGISTRATION_OVERRIDE_UNMATCHED", "warning", `registration section ${originalRegistration.id} did not match a timetable section`, { sectionId: originalRegistration.id }));
      continue;
    }
    if (candidates.length > 1) {
      unmatched.push(originalRegistration);
      issues.push(domainIssue("REGISTRATION_OVERRIDE_AMBIGUOUS", "warning", `registration section ${originalRegistration.id} matched multiple timetable sections`, { sectionId: originalRegistration.id }));
      continue;
    }
    const timetable = candidates[0]!;
    const entry = registered.get(timetable.id) ?? { timetable, rows: [] };
    entry.rows.push(originalRegistration);
    registered.set(timetable.id, entry);
  }
  // The final Plan lists exactly the registered sections. Earlier registration overrides are replaced by this import;
  // user/admin overrides on registered sections are kept because they outrank registration.
  const registeredIds = new Set([...registered.keys()].map((id) => canonicalSectionId(id, aliases)));
  const carried = input.plan.overrides.filter((override) => override.source !== "registration" && registeredIds.has(canonicalSectionId(override.target.sectionId, aliases)));
  const picks: PlanPick[] = [];
  for (const { timetable, rows } of registered.values()) {
    const registration: Section = rows.length === 1 ? rows[0]! : { ...rows[0]!, sessions: rows.flatMap((row) => row.sessions) };
    const matchedSessions = matchSessions(registration, timetable);
    picks.push(registrationPick(timetable, registration, matchedSessions.pairs));
    issues.push(...matchedSessions.issues);
    const nextSessions: Session[] = [];
    for (const baseSession of timetable.sessions) {
      const pair = matchedSessions.pairs.find((candidate) => candidate.timetable.id === baseSession.id);
      if (!pair) {
        nextSessions.push(cloneSession(baseSession));
        continue;
      }
      const merged = overridesForPair(baseSession, pair.registration, timetable.id, input.term.teachingWeeks, maxPeriodFor(baseSession, input.catalog));
      nextSessions.push(merged.session);
      overrides.push(...merged.overrides);
      issues.push(...merged.issues);
    }
    const timetableId = canonicalSectionId(timetable.id, aliases);
    const existing = carried.filter((override) => canonicalSectionId(override.target.sectionId, aliases) === timetableId);
    for (let index = 0; index < nextSessions.length; index += 1) {
      const applied = applyExistingOverrides(nextSessions[index]!, timetable.id, existing, input.term.teachingWeeks, maxPeriodFor(nextSessions[index]!, input.catalog));
      nextSessions[index] = applied.session;
      issues.push(...applied.issues);
    }
    effective.set(timetable.id, { ...timetable, sessions: nextSessions });
    matched.push({ registrationSection: registration, timetableSection: timetable, sessionPairs: matchedSessions.pairs });
  }
  const finalPlan: Plan = input.plan.planKind === "final"
    ? { ...input.plan, picks, overrides: [...carried, ...overrides] }
    : { ...input.plan, id: `${input.plan.id}:final`, planKind: "final", final: true, picks, overrides: [...carried, ...overrides] };
  return { plan: finalPlan, sections: [...effective.values()], overrides, matched, unmatched, issues };
}
