import assert from "node:assert/strict";
import test from "node:test";
import {
  HEARTLOCK_ROSTERS,
  heartlockPool,
  heartlockTierForCost,
} from "../app/heartlock-roster.ts";

const approved = Object.values(HEARTLOCK_ROSTERS).flat();
const muses = approved.map((character) => ({ character }));

test("HEARTLOCK has three unique adult challengers in every difficulty band", () => {
  for (const roster of Object.values(HEARTLOCK_ROSTERS)) assert.equal(roster.length, 3);
  assert.equal(approved.length, 12);
  assert.equal(new Set(approved).size, 12);
});

test("each cost selects only its explicit roster and Supreme shares the boss trio", () => {
  for (const cost of [1, 2, 5, 10]) {
    assert.deepEqual(
      heartlockPool(muses, cost).map((muse) => muse.character),
      HEARTLOCK_ROSTERS[heartlockTierForCost(cost)],
    );
  }
  assert.deepEqual(heartlockPool(muses, 20), heartlockPool(muses, 10));
});

test("matching metadata cannot admit an unapproved challenger or broaden a missing pool", () => {
  const outsider = { character: "Unapproved", duelTier: 1 };
  assert.deepEqual(heartlockPool([...muses, outsider], 1).map((muse) => muse.character), HEARTLOCK_ROSTERS[1]);
  assert.deepEqual(heartlockPool([{ character: "Yor Forger" }, outsider], 1), [{ character: "Yor Forger" }]);
  assert.deepEqual(heartlockPool([outsider], 1), []);
});
