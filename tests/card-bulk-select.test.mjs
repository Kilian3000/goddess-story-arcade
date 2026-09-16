import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BULK_QUERY,
  applyBulkSelection,
  collectAllExceptHighest,
  collectAllIds,
  collectBulkIds,
  copiesForRow,
  dropHighestValue,
  matchingValuePreset,
  matchesBulkQuery,
  mergeSelections,
  parseYuanInput,
  pickSingleId,
  pruneSelection,
  removeAllOfId,
  selectionTouchesLastCopy,
  toggleRowSelection,
  withRarity,
  withValuePreset,
  yuanBoundsToFen,
} from "../app/card-bulk-select.ts";

function row(partial) {
  return {
    id: 1,
    rarity: "R",
    setName: "NS-03",
    character: "Mai",
    count: 3,
    valueFen: 8,
    ...partial,
  };
}

const binder = [
  row({ id: 1, rarity: "R", setName: "NS-03", character: "Mai", count: 4, valueFen: 5 }),
  row({ id: 2, rarity: "R", setName: "NS-04", character: "2B", count: 2, valueFen: 40 }),
  row({ id: 3, rarity: "SR", setName: "NS-03", character: "Mai", count: 3, valueFen: 180 }),
  row({ id: 4, rarity: "SSR", setName: "NS-03", character: "Yelan", count: 1, valueFen: 1200 }),
  row({ id: 5, rarity: "R", setName: "NS-03", character: "Tifa", count: 5, valueFen: 55 }),
];

test("parseYuanInput accepts comma and dot", () => {
  assert.equal(parseYuanInput("0,5"), 0.5);
  assert.equal(parseYuanInput("0.01"), 0.01);
  assert.equal(parseYuanInput("10"), 10);
  assert.equal(parseYuanInput(""), null);
  assert.equal(parseYuanInput("x"), null);
});

test("yuan bounds swap when min is larger than max", () => {
  assert.deepEqual(yuanBoundsToFen(10, 5), { minFen: 500, maxFen: 1000 });
  assert.deepEqual(yuanBoundsToFen(0.01, 0.5), { minFen: 1, maxFen: 50 });
});

test("excess keeps one copy, all takes every copy", () => {
  assert.equal(copiesForRow(row({ count: 4 }), "excess"), 3);
  assert.equal(copiesForRow(row({ count: 1 }), "excess"), 0);
  assert.equal(copiesForRow(row({ count: 4 }), "all"), 4);
  assert.equal(copiesForRow(row({ count: 1, excessEligible: true }), "excess"), 1);
  assert.equal(copiesForRow(row({ count: 1, excessEligible: false }), "excess"), 0);
});

test("collects all doubles, or only a rarity / set / value band", () => {
  assert.deepEqual(collectBulkIds(binder, DEFAULT_BULK_QUERY), [1, 1, 1, 2, 5, 5, 5, 5, 3, 3]);
  assert.deepEqual(
    collectBulkIds(binder, { ...DEFAULT_BULK_QUERY, rarities: ["R"] }),
    [1, 1, 1, 2, 5, 5, 5, 5],
  );
  assert.deepEqual(
    collectBulkIds(binder, { ...DEFAULT_BULK_QUERY, setName: "NS-03", rarities: ["R"] }),
    [1, 1, 1, 5, 5, 5, 5],
  );
  assert.deepEqual(
    collectBulkIds(binder, { ...DEFAULT_BULK_QUERY, minValueFen: 1, maxValueFen: 50 }),
    [1, 1, 1, 2],
  );
  assert.deepEqual(
    collectBulkIds(binder, { ...DEFAULT_BULK_QUERY, scope: "all", rarities: ["SSR"] }),
    [4],
  );
});

test("same query can take doubles or every copy", () => {
  const query = { ...DEFAULT_BULK_QUERY, setName: "NS-03", rarities: ["R"], minCopies: 2 };
  assert.deepEqual(collectBulkIds(binder, query), [1, 1, 1, 5, 5, 5, 5]);
  assert.deepEqual(collectBulkIds(binder, { ...query, scope: "all" }), [1, 1, 1, 1, 5, 5, 5, 5, 5]);
});

test("triples and max cap take cheapest first", () => {
  const triples = collectBulkIds(binder, { ...DEFAULT_BULK_QUERY, minCopies: 3 });
  assert.deepEqual(triples, [1, 1, 1, 5, 5, 5, 5, 3, 3]);
  assert.deepEqual(collectBulkIds(binder, DEFAULT_BULK_QUERY, { max: 3 }), [1, 1, 1]);
  assert.deepEqual(
    collectBulkIds(binder, DEFAULT_BULK_QUERY, { max: 2, sort: "value-desc" }),
    [3, 3],
  );
});

test("value presets toggle and match 0,01–0,50 / 5–10", () => {
  const cheap = withValuePreset(DEFAULT_BULK_QUERY, "001-050");
  assert.equal(matchingValuePreset(cheap), "001-050");
  assert.deepEqual(collectBulkIds(binder, cheap), [1, 1, 1, 2]);
  const mid = withValuePreset(DEFAULT_BULK_QUERY, "5-10");
  assert.ok(!binder.some((item) => matchesBulkQuery(item, mid)));
  const cleared = withValuePreset(cheap, "001-050");
  assert.equal(cleared.minValueFen, null);
  assert.equal(cleared.maxValueFen, null);
});

test("rarity chips toggle and merge respects owned caps", () => {
  const withR = withRarity(DEFAULT_BULK_QUERY, "R");
  assert.deepEqual(withR.rarities, ["R"]);
  assert.deepEqual(withRarity(withR, "R").rarities, []);
  const added = applyBulkSelection([1], binder, { ...DEFAULT_BULK_QUERY, rarities: ["SR"] }, { add: true, sort: "value-asc" });
  assert.deepEqual(added, [1, 3, 3]);
  assert.deepEqual(mergeSelections([1, 1, 1, 1], [1, 1], binder), [1, 1, 1, 1]);
});

test("toggle, prune and last-copy detection", () => {
  assert.deepEqual(toggleRowSelection([], binder[3], "excess"), []);
  assert.deepEqual(toggleRowSelection([], binder[3], "all"), [4]);
  assert.deepEqual(toggleRowSelection([1, 1, 1], binder[0], "excess"), []);
  assert.deepEqual(pruneSelection([1, 1, 1, 1, 1, 4], [binder[0], { ...binder[3], count: 0 }]), [1, 1, 1, 1]);
  assert.equal(selectionTouchesLastCopy(binder, [1, 1, 1]), false);
  assert.equal(selectionTouchesLastCopy(binder, [1, 1, 1, 1]), true);
  assert.equal(selectionTouchesLastCopy(binder, [4]), true);
});

test("one-click all, drop a card, and drop the most expensive", () => {
  assert.deepEqual(collectAllIds(binder, "excess"), [1, 1, 1, 2, 5, 5, 5, 5, 3, 3]);
  assert.deepEqual(collectAllIds(binder, "all"), [1, 1, 1, 1, 2, 2, 5, 5, 5, 5, 5, 3, 3, 3, 4]);
  const allDoubles = collectAllIds(binder, "excess");
  assert.deepEqual(dropHighestValue(binder, allDoubles), [1, 1, 1, 2, 5, 5, 5, 5]);
  assert.deepEqual(collectAllExceptHighest(binder, "excess"), [1, 1, 1, 2, 5, 5, 5, 5]);
  assert.deepEqual(removeAllOfId(allDoubles, 5), [1, 1, 1, 2, 3, 3]);
  assert.deepEqual(dropHighestValue(binder, [4], 1), []);
});

test("single picks and pack-slot excess flags", () => {
  assert.equal(pickSingleId(binder, "cheap"), 1);
  assert.equal(pickSingleId(binder, "expensive"), 4);
  assert.equal(pickSingleId(binder, "cheap-excess"), 1);
  assert.equal(pickSingleId([binder[3]], "cheap-excess"), null);
  const slots = [
    row({ id: 0, rarity: "R", count: 1, valueFen: 6, excessEligible: true }),
    row({ id: 1, rarity: "SR", count: 1, valueFen: 200, excessEligible: false }),
    row({ id: 2, rarity: "R", count: 1, valueFen: 7, excessEligible: true }),
  ];
  assert.deepEqual(collectBulkIds(slots, DEFAULT_BULK_QUERY), [0, 2]);
  assert.deepEqual(collectBulkIds(slots, { ...DEFAULT_BULK_QUERY, scope: "all" }), [0, 2, 1]);
});
