// Pure rules of the dataset pipeline (ADR-0012): versions, term starts, diffs and status transitions.
// The CLI in scripts/dataset.mjs does the file work; everything here is deterministic and unit-tested.

export const SOURCE_TYPES = ["official-timetable", "planned-timetable"];

/** `uet-<term>-<YYYYMMDD in Asia/Ho_Chi_Minh>-<first 8 hex of the source hash>`: unique, sortable, readable. */
export function datasetVersionFor(term, importedAt, importHash) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(importedAt)).replace(/-/g, "");
  return `uet-${term}-${day}-${importHash.slice(0, 8)}`;
}

/** `--start "K67,K68=2026-09-07"`: the cohorts whose week 1 begins on that Monday. */
export function parseStart(spec) {
  const match = /^([^=]+)=(\d{4}-\d{2}-\d{2})$/.exec(spec.trim());
  if (!match) throw new Error(`--start "${spec}" must look like "K67,K68=2026-09-07"`);
  const cohorts = match[1].split(",").map((cohort) => cohort.trim()).filter(Boolean);
  const week1 = match[2];
  const date = new Date(`${week1}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== week1) throw new Error(`--start date ${week1} is not a real date`);
  if (date.getUTCDay() !== 1) throw new Error(`--start date ${week1} is not a Monday; week 1 starts on a Monday`);
  if (cohorts.length === 0) throw new Error(`--start "${spec}" names no cohort`);
  return { cohorts, week1 };
}

/** What a student sees of a session; ids and source rows change between versions and are left out. */
function sessionSignature(session) {
  const time = session.fixedTime === false ? "untimed" : `T${session.day} ${session.startPeriod}-${session.endPeriod}`;
  return [time, session.kind, session.group ?? "", session.room ?? "", `w${session.weeks.join(",")}`, session.lecturers.join("+")].join(" | ");
}

/** Sections added, removed and changed (by their sessions) between two timetables. */
export function diffSections(previous, next) {
  const before = new Map(previous.map((section) => [section.id, section.sessions.map(sessionSignature).sort()]));
  const after = new Map(next.map((section) => [section.id, section.sessions.map(sessionSignature).sort()]));
  const added = [...after.keys()].filter((id) => !before.has(id)).sort();
  const removed = [...before.keys()].filter((id) => !after.has(id)).sort();
  const changed = [];
  for (const [id, sessions] of after) {
    const old = before.get(id);
    if (old && old.join("\n") !== sessions.join("\n")) changed.push({ id, before: old.filter((item) => !sessions.includes(item)), after: sessions.filter((item) => !old.includes(item)) });
  }
  changed.sort((a, b) => a.id.localeCompare(b.id));
  return { added, removed, changed };
}

/**
 * Runbook §7 lifecycle: candidate → validated → published, and any of them → retracted. Validation needs a
 * reviewer other than the importer; a single-person review is allowed only with a recorded reason.
 */
export function nextStatus(entry, action, { actor, importer, singleReviewerReason } = {}) {
  if (!actor) throw new Error(`${action} needs an actor name`);
  if (action === "validate") {
    if (entry.status !== "candidate") throw new Error(`only a candidate can be validated (status: ${entry.status})`);
    if (importer && actor.trim().toLowerCase() === importer.trim().toLowerCase() && !singleReviewerReason) {
      throw new Error("the reviewer imported this dataset; another person must review it, or record --accept-single-reviewer \"<reason>\"");
    }
    return "validated";
  }
  if (action === "publish") {
    if (entry.status !== "validated") throw new Error(`only a validated dataset can be published (status: ${entry.status})`);
    return "published";
  }
  if (action === "retract") {
    if (entry.status === "retracted") throw new Error("already retracted");
    return "retracted";
  }
  throw new Error(`unknown action ${action}`);
}
