import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "../lib/cli.mjs";
import {
  datasetVersionFor,
  diffSections,
  isSafeRelativePath,
  nextStatus,
  normalizeActor,
  parseStart,
  resolveSiteAllowUnpublished,
  sanitizeCliText,
  verifyBaseManifestImmutability,
} from "../lib/dataset-core.mjs";

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

test("status transitions follow the runbook and keep two people in the loop (SEC-M3-101, REV-M3-102, REV-M3-106)", () => {
  assert.equal(nextStatus({ status: "candidate" }, "validate", { actor: "Reviewer", importer: "Parser" }), "validated");
  assert.throws(() => nextStatus({ status: "candidate" }, "validate", { actor: "owner", importer: "Owner" }), /another person/);
  // SEC-M3-101(a): extra whitespace or diacritics in actor name cannot bypass two-person check.
  assert.equal(normalizeActor("Importer  A"), normalizeActor("importer a"));
  assert.throws(() => nextStatus({ status: "candidate" }, "validate", { actor: "Importer  A", importer: "Importer A" }), /another person/);
  // SEC-M3-101(b): missing importer fails closed.
  assert.throws(() => nextStatus({ status: "candidate" }, "validate", { actor: "Reviewer" }), /import audit record/);
  assert.equal(nextStatus({ status: "candidate" }, "validate", { actor: "owner", importer: "Owner", singleReviewerReason: "internal beta, one maintainer" }), "validated");
  assert.throws(() => nextStatus({ status: "candidate" }, "validate", { actor: "Reviewer", importer: "Parser", newFormatImported: true }), /--accept-new-format/);
  assert.equal(
    nextStatus({ status: "candidate" }, "validate", { actor: "Reviewer", importer: "Parser", newFormatImported: true, acceptNewFormatReason: "reviewed extra info columns" }),
    "validated",
  );
  assert.throws(() => nextStatus({ status: "candidate" }, "publish", { actor: "RM" }), /only a validated/);
  assert.equal(nextStatus({ status: "validated" }, "publish", { actor: "RM", importer: "Parser" }), "published");
  // SEC-M3-101(c): importer cannot self-publish without singleReviewerReason.
  assert.throws(() => nextStatus({ status: "validated" }, "publish", { actor: "Importer  A", importer: "Importer A" }), /another person/);
  assert.equal(nextStatus({ status: "validated" }, "publish", { actor: "Importer A", importer: "Importer A", singleReviewerReason: "single maintainer drill" }), "published");
  assert.equal(nextStatus({ status: "published" }, "retract", { actor: "RM" }), "retracted");
  assert.throws(() => nextStatus({ status: "retracted" }, "retract", { actor: "RM" }), /already/);
  // REV-M3-106: restore transitions retracted -> validated.
  assert.equal(nextStatus({ status: "retracted" }, "restore", { actor: "RM" }), "validated");
  assert.throws(() => nextStatus({ status: "published" }, "restore", { actor: "RM" }), /only a retracted/);
  assert.throws(() => nextStatus({ status: "validated" }, "publish", {}), /actor/);
});

test("CLI free-text sanitizer and relative-path validator fail closed (SEC-M3-104)", () => {
  assert.equal(sanitizeCliText("  QĐ 123/ĐHCN  ", "--document-ref"), "QĐ 123/ĐHCN");
  assert.throws(() => sanitizeCliText("d\n## Decision log\n- forged", "--document-ref"), /single line/);
  assert.throws(() => sanitizeCliText("   ", "--actor"), /not be empty/);
  assert.equal(isSafeRelativePath("schools/uet/terms/2026-2027-h1/v1/timetable.json"), true);
  assert.equal(isSafeRelativePath("../../package.json"), false);
  assert.equal(isSafeRelativePath("schools/%2e%2e/secret.json"), false);
});

test("resolveSiteAllowUnpublished fails closed across Cloudflare Pages, Workers Builds, and generic builds (SEC-M3-003)", () => {
  assert.equal(resolveSiteAllowUnpublished({}), false);
  assert.equal(resolveSiteAllowUnpublished({ NODE_ENV: "development" }), false);
  assert.equal(resolveSiteAllowUnpublished({ VITE_ALLOW_UNPUBLISHED: "true" }), true);
  assert.equal(resolveSiteAllowUnpublished({ CF_PAGES: "1", CF_PAGES_BRANCH: "main", VITE_ALLOW_UNPUBLISHED: "true", NODE_ENV: "development" }), false);
  assert.equal(resolveSiteAllowUnpublished({ CF_PAGES: "1", CF_PAGES_BRANCH: "" }), false);
  assert.equal(resolveSiteAllowUnpublished({ CF_PAGES: "1", CF_PAGES_BRANCH: "m4-preview" }), true);
  assert.equal(resolveSiteAllowUnpublished({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "main", VITE_ALLOW_UNPUBLISHED: "true" }), false);
  assert.equal(resolveSiteAllowUnpublished({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "preview-1" }), true);
  assert.equal(resolveSiteAllowUnpublished({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "release", PRODUCTION_BRANCH: "release" }), false);
});

test("verifyBaseManifestImmutability enforces append-only manifest and immutable artifact hashes across commits (SEC-M3-101e)", () => {
  const baseEntry = {
    datasetVersion: "uet-2026-2027-h1-20261101-abcdef01",
    status: "published",
    source: { importHash: "sha256:abcdef01" },
    artifacts: [
      { kind: "timetable", url: "schools/uet/terms/2026-2027-h1/v1/timetable.json", sha256: "1111", bytes: 100 },
      { kind: "metadata", url: "schools/uet/terms/2026-2027-h1/v1/metadata.json", sha256: "2222", bytes: 50 },
    ],
  };
  const baseManifest = { schemaVersion: "1.0", datasets: [baseEntry] };

  // Legitimate status change (`published` -> `retracted`) and appending a new version passes.
  assert.deepEqual(
    verifyBaseManifestImmutability(baseManifest, {
      schemaVersion: "1.0",
      datasets: [
        { ...baseEntry, status: "retracted" },
        { ...baseEntry, datasetVersion: "uet-2026-2027-h1-20261102-99999999", status: "candidate" },
      ],
    }),
    [],
  );

  // Deleting an existing entry fails.
  assert.match(verifyBaseManifestImmutability(baseManifest, { schemaVersion: "1.0", datasets: [] })[0], /must not be deleted/);

  // Rewriting an artifact hash in the manifest fails.
  const tamperedHash = {
    schemaVersion: "1.0",
    datasets: [
      {
        ...baseEntry,
        artifacts: [
          { ...baseEntry.artifacts[0], sha256: "forged9999", bytes: 102 },
          baseEntry.artifacts[1],
        ],
      },
    ],
  };
  assert.match(verifyBaseManifestImmutability(baseManifest, tamperedHash)[0], /immutable artifact "timetable"/);
});

test("CLI round-trip: import -> validate -> publish -> retract -> restore -> publish -> check & site-data (REV-M3-105, REV-M3-106, SEC-M3-101, SEC-M3-104)", async () => {
  const { syntheticXlsx } = await import(pathToFileURL(join(repoRoot, "packages/parser/dist/test/synthetic-xlsx.js")).href);
  const { validateCourse, validateSection } = await import(pathToFileURL(join(repoRoot, "packages/domain/dist/src/index.js")).href);
  const tmp = mkdtempSync(join(tmpdir(), "ky-nay-cli-test-"));
  try {
    const xlsxPath = join(tmp, "synthetic-source.xlsx");
    const hk1Headers = ["STT", "Mã học phần", "Học phần", "Số TC", "Mã LHP", "Giảng viên", "Thứ", "Ca", "Giảng đường", "Nhóm"];
    writeFileSync(
      xlsxPath,
      syntheticXlsx([{
        name: "TKB",
        rows: [
          hk1Headers,
          ["1", "SYN3071E", "Môn mẫu", "3", "SYN3071E 1", "TS.Mẫu", "3", "1", "203-G2", "CL"],
        ],
      }]),
    );
    const dataRoot = join(tmp, "data");
    const runCli = (args) =>
      spawnSync(process.execPath, [join(repoRoot, "scripts", "dataset.mjs"), ...args], {
        env: { ...process.env, DATASET_ROOT_DIR: dataRoot },
        encoding: "utf8",
      });

    // SEC-M3-104(a): newline injection in --document-ref is rejected.
    const badRef = runCli(["import", xlsxPath, "--term", "2026-2027-h1", "--term-name", "HK I", "--source-type", "official-timetable", "--document-ref", "d\nforged", "--published-by", "UET", "--actor", "Importer A"]);
    assert.notEqual(badRef.status, 0);

    // 1. Valid import.
    const imp = runCli(["import", xlsxPath, "--term", "2026-2027-h1", "--term-name", "Học kỳ I", "--source-type", "official-timetable", "--document-ref", "SYN-DOC-1", "--published-by", "UET", "--actor", "Importer A", "--start", "K69=2026-09-07"]);
    assert.equal(imp.status, 0, imp.stderr);
    const manifestPath = join(dataRoot, "published", "manifest.json");
    const manifest1 = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest1.datasets.length, 1);
    const version = manifest1.datasets[0].datasetVersion;
    assert.equal(manifest1.datasets[0].status, "candidate");

    // SEC-M3-101(a): same actor with extra spaces is blocked.
    const selfVal = runCli(["validate", version, "--reviewer", "Importer  A"]);
    assert.notEqual(selfVal.status, 0);

    // 2. Second person validates.
    const val = runCli(["validate", version, "--reviewer", "Reviewer B", "--note", "checked preview"]);
    assert.equal(val.status, 0, val.stderr);

    // SEC-M3-101(c): importer cannot self-publish without exception.
    const selfPub = runCli(["publish", version, "--by", "Importer  A"]);
    assert.notEqual(selfPub.status, 0);

    // 3. Release Manager publishes.
    const pub = runCli(["publish", version, "--by", "Release Manager"]);
    assert.equal(pub.status, 0, pub.stderr);

    // Snapshot base manifest right after publication (simulating the base git commit).
    const baseManifestSnapshot = join(tmp, "base-manifest.json");
    copyFileSync(manifestPath, baseManifestSnapshot);

    // 4. Retract -> Restore -> Publish (REV-M3-106 drill).
    const ret = runCli(["retract", version, "--by", "Release Manager", "--reason", "drill retract"]);
    assert.equal(ret.status, 0, ret.stderr);
    const res = runCli(["restore", version, "--by", "Release Manager", "--reason", "drill restore"]);
    assert.equal(res.status, 0, res.stderr);
    const pub2 = runCli(["publish", version, "--by", "Release Manager", "--note", "re-published after restore"]);
    assert.equal(pub2.status, 0, pub2.stderr);

    // 5. `dataset check` (with `--base-manifest`) passes and timetable payload satisfies domain invariants.
    const chk = runCli(["check", "--base-manifest", baseManifestSnapshot]);
    assert.equal(chk.status, 0, chk.stderr);
    const finalManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const ttUrl = finalManifest.datasets[0].artifacts.find((a) => a.kind === "timetable").url;
    const ttFile = join(dataRoot, "published", ttUrl);
    const ttPayload = JSON.parse(readFileSync(ttFile, "utf8"));
    for (const c of ttPayload.courses) assert.deepEqual(validateCourse(c).filter((i) => i.severity === "error"), []);
    for (const s of ttPayload.sections) assert.deepEqual(validateSection(s).filter((i) => i.severity === "error"), []);

    // 6. `site-data.mjs` copies verified artifacts in production mode.
    const siteOut = join(tmp, "public-data");
    const siteRes = spawnSync(process.execPath, [join(repoRoot, "scripts", "site-data.mjs"), siteOut], {
      env: { ...process.env, DATASET_PUBLISHED_DIR: join(dataRoot, "published"), VITE_ALLOW_UNPUBLISHED: "false" },
      encoding: "utf8",
    });
    assert.equal(siteRes.status, 0, siteRes.stderr);

    // 7. SEC-M3-101(e): rewriting `timetable.json` on disk AND updating its sha256/bytes in `manifest.json`
    // is caught by `dataset check --base-manifest`!
    const mutatedBytes = Buffer.from(readFileSync(ttFile, "utf8").replace("203-G2", "999-G2"), "utf8");
    writeFileSync(ttFile, mutatedBytes);
    const mutatedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const ttArt = mutatedManifest.datasets[0].artifacts.find((a) => a.kind === "timetable");
    ttArt.sha256 = createHash("sha256").update(mutatedBytes).digest("hex");
    ttArt.bytes = mutatedBytes.length;
    writeFileSync(manifestPath, `${JSON.stringify(mutatedManifest, null, 2)}\n`);
    const chkTampered = runCli(["check", "--base-manifest", baseManifestSnapshot]);
    assert.notEqual(chkTampered.status, 0);
    assert.match(chkTampered.stderr, /immutable artifact "timetable"/);

    // 8. SEC-M3-101(d): deleting audit.jsonl causes `dataset check` to fail closed.
    unlinkSync(join(dataRoot, "audit.jsonl"));
    const chkNoAudit = runCli(["check"]);
    assert.notEqual(chkNoAudit.status, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
