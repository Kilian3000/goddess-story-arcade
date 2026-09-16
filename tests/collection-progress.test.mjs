import assert from "node:assert/strict";
import test from "node:test";
import { makeNightOffer, newlyCompletedCharacters, newlyCompletedSets, setProgress } from "../app/collection-progress.ts";

const cards = [
  { id: 1, set_name: "NS-03", character: "Mai", number: "001", rarity: "R", title: "", image_path: "", ord: 1 },
  { id: 2, set_name: "NS-03", character: "Mai", number: "002", rarity: "SR", title: "", image_path: "", ord: 2 },
  { id: 3, set_name: "NS-04", character: "2B", number: "001", rarity: "R", title: "", image_path: "", ord: 1 },
];

test("set titles climb Owned → Bound → Master", () => {
  assert.equal(setProgress(cards, {}, "NS-03").title, "Hunting");
  assert.equal(setProgress(cards, { "1": 1 }, "NS-03").title, "Hunting");
  assert.equal(setProgress(cards, { "1": 1, "2": 1 }, "NS-03").title, "Owned");
  assert.equal(setProgress(cards, { "1": 2, "2": 2 }, "NS-03").title, "Bound");
  assert.equal(setProgress(cards, { "1": 3, "2": 3 }, "NS-03").title, "Master");
});

test("first set-clear is unique per set", () => {
  const owned = { "1": 1, "2": 1 };
  assert.deepEqual(newlyCompletedSets(cards, owned, []), ["NS-03"]);
  assert.deepEqual(newlyCompletedSets(cards, owned, ["NS-03"]), []);
});

test("character yearbook and night market only spend excess copies", () => {
  const catalog = [
    ...cards,
    { id: 4, set_name: "NS-03", character: "Mai", number: "003", rarity: "SSR", title: "", image_path: "", ord: 3 },
    { id: 5, set_name: "NS-03", character: "Mai", number: "004", rarity: "R", title: "", image_path: "", ord: 4 },
    { id: 6, set_name: "NS-03", character: "Mai", number: "005", rarity: "R", title: "", image_path: "", ord: 5 },
    { id: 7, set_name: "NS-03", character: "Mai", number: "006", rarity: "R", title: "", image_path: "", ord: 6 },
  ];
  const owned = { "1": 13, "5": 2, "6": 2, "7": 2 };
  assert.deepEqual(newlyCompletedCharacters(catalog, { "1": 1, "2": 1, "4": 1, "5": 1, "6": 1, "7": 1 }, []), ["Mai"]);
  const offer = makeNightOffer(catalog, owned);
  assert.ok(offer);
  assert.equal(offer.targetId, 2);
  assert.equal(offer.payIds.length, 12);
  assert.ok(offer.payIds.every((id) => owned[String(id)] > 1));
  assert.equal(makeNightOffer(catalog, { "1": 1 }), null);
});
