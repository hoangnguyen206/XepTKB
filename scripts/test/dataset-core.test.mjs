import { test } from "node:test";
import assert from "node:assert/strict";
import { datasetVersionFor, diffSections, nextStatus, parseStart } from "../lib/dataset-core.mjs";

test("dataset versions use the Vietnam date and the source hash", () => {
  // 18:30 UTC on 31/10 is already 01/11 in Hà Nội.
  assert.equal(datasetVersionFor("2026-2027-h1", "2026-10-31T18:30:00.000Z", "abcdef0123456789"), "uet-2026-2027-h1-20261101-abcdef01");
});

test("term starts must name cohorts and a real Monday", () => {
  assert.deepEqual(parseStart("K67, K68 ,K69=2026-09-07"), { cohorts: ["K67", "K68", "K69"], week1: "2026-09-07" });
  assert.throws(() => parseStart("K67=2026-09-08"), /not a Monday/);
  assert.throws(() => parseStart("K67=2026-02-30"), /not a real date/);
  assert.throws(() => parseStart("2026-09-07"), /must look like/);
});

const session = (patch) => ({ day: 2, startPeriod: 1, endPeriod: 3, kind: "LT", group: "CL", room: "101-A", weeks: [1, 2], lecturers: ["GV"], ...patch });

test("the diff compares what students see, not ids or source rows", () => {
  const previous = [
    { id: "A 1", sessions: [session({ id: "A 1:7:1-3" })] },
    { id: "B 1", sessions: [session({ id: "B 1:8:1-3" })] },
    { id: "C 1", sessions: [session({ id: "C 1:9:1-3", room: "101-A" })] },
  ];
  const next = [
    { id: "A 1", sessions: [session({ id: "A 1:70:1-3" })] },
    { id: "C 1", sessions: [session({ id: "C 1:90:1-3", room: "202-B" })] },
    { id: "D 1", sessions: [session({ id: "D 1:91:1-3", fixedTime: false, day: undefined })] },
  ];
  const diff = diffSections(previous, next);
  assert.deepEqual(diff.added, ["D 1"]);
  assert.deepEqual(diff.removed, ["B 1"]);
  assert.deepEqual(diff.changed.map((item) => item.id), ["C 1"]);
  assert.match(diff.changed[0].before[0], /101-A/);
  assert.match(diff.changed[0].after[0], /202-B/);
});

test("status transitions follow the runbook and keep two people in the loop", () => {
  assert.equal(nextStatus({ status: "candidate" }, "validate", { actor: "Reviewer", importer: "Parser" }), "validated");
  assert.throws(() => nextStatus({ status: "candidate" }, "validate", { actor: "owner", importer: "Owner" }), /another person/);
  assert.equal(nextStatus({ status: "candidate" }, "validate", { actor: "owner", importer: "Owner", singleReviewerReason: "internal beta, one maintainer" }), "validated");
  assert.throws(() => nextStatus({ status: "candidate" }, "validate", { actor: "Reviewer", importer: "Parser", newFormatImported: true }), /--accept-new-format/);
  assert.equal(
    nextStatus({ status: "candidate" }, "validate", { actor: "Reviewer", importer: "Parser", newFormatImported: true, acceptNewFormatReason: "reviewed extra info columns" }),
    "validated",
  );
  assert.throws(() => nextStatus({ status: "candidate" }, "publish", { actor: "RM" }), /only a validated/);
  assert.equal(nextStatus({ status: "validated" }, "publish", { actor: "RM" }), "published");
  assert.equal(nextStatus({ status: "published" }, "retract", { actor: "RM" }), "retracted");
  assert.throws(() => nextStatus({ status: "retracted" }, "retract", { actor: "RM" }), /already/);
  assert.throws(() => nextStatus({ status: "validated" }, "publish", {}), /actor/);
});
