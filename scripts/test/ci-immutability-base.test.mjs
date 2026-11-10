import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseImmutabilityBase, commitExists } from "../ci-immutability-base.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const always = () => true;
const never = () => false;

test("pull_request compares against origin/<base_ref> (AC-M5-13)", () => {
  assert.deepEqual(chooseImmutabilityBase({ eventName: "pull_request", baseRef: "main", before: SHA }, always), { ref: "origin/main" });
  assert.deepEqual(chooseImmutabilityBase({ eventName: "pull_request", baseRef: "release/m5" }, always), { ref: "origin/release/m5" });
  for (const unsafe of [undefined, "", "-x", "a b", "main;rm -rf /", "a..b", "$(id)"]) {
    assert.throws(() => chooseImmutabilityBase({ eventName: "pull_request", baseRef: unsafe }, always), /missing or unsafe/, String(unsafe));
  }
});

test("push uses github.event.before when it is a known 40-hex SHA", () => {
  assert.deepEqual(chooseImmutabilityBase({ eventName: "push", before: SHA }, always), { ref: SHA });
  assert.deepEqual(chooseImmutabilityBase({ eventName: "push", before: SHA.toUpperCase() }, always), { ref: SHA });
  let asked;
  chooseImmutabilityBase({ eventName: "push", before: SHA }, (sha) => {
    asked = sha;
    return true;
  });
  assert.equal(asked, SHA);
});

test("push falls back to HEAD~1 with a warning for empty, all-zero, malformed or unknown SHAs", () => {
  const cases = [
    [{ eventName: "push", before: "" }, always, /no 'before' SHA/],
    [{ eventName: "push" }, always, /no 'before' SHA/],
    [{ eventName: "push", before: "0".repeat(40) }, always, /new branch/],
    [{ eventName: "push", before: "abc123" }, always, /not a 40-hex SHA/],
    [{ eventName: "push", before: `${SHA};id` }, always, /not a 40-hex SHA/],
    [{ eventName: "push", before: SHA }, never, /not in the local history/],
  ];
  for (const [input, exists, warning] of cases) {
    const result = chooseImmutabilityBase(input, exists);
    assert.equal(result.ref, "HEAD~1", JSON.stringify(input));
    assert.match(result.warning, warning);
  }
});

test("commitExists checks the local object database", () => {
  assert.equal(commitExists("f".repeat(40)), false);
});
