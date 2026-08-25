import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  compilePackRecipe,
  createCollationState,
  drawPackRarities,
  isCollationStateValid,
} from "../app/gacha-engine.ts";

const { packs } = JSON.parse(await readFile(new URL("../public/pack-configs.json", import.meta.url), "utf8"));

function seeded(seed = 0xdecafbad) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function availableFor(config) {
  return new Set([
    "R", "CR", "SR", "SCR", "SSR", "MR",
    ...config.odds.perPack.map((row) => row.rarity),
    ...config.odds.perBox.map((row) => row.rarity === "[object Object]" ? "MR" : row.rarity),
  ]);
}

function openBox(setName, seed = 1234) {
  const config = packs.find((pack) => pack.setName === setName);
  assert.ok(config, `missing config for ${setName}`);
  const random = seeded(seed);
  const recipe = compilePackRecipe(config, availableFor(config));
  let state = createCollationState(config, recipe, 1, random);
  const box = [];
  for (let index = 0; index < config.boostersCount; index += 1) {
    const draw = drawPackRarities(config, recipe, state, random);
    box.push(draw.rarities);
    state = draw.state;
  }
  return { box, config, recipe, state };
}

test("NS-02-M16 preserves its four-base, two-shiny physical pull order", () => {
  const { box } = openBox("NS-02-M16", 0x16);
  const base = box.flatMap((pack) => pack.slice(0, 4));
  const ordinary = box.flatMap((pack) => pack.slice(4)).filter((rarity) => rarity === "SR" || rarity === "SCR");
  const high = box.map((pack) => pack[5]).filter((rarity) => rarity !== "SR" && rarity !== "SCR");

  assert.ok(box.every((pack) => pack.length === 6));
  assert.ok(box.every((pack) => pack.slice(0, 4).every((rarity) => rarity === "R" || rarity === "CR")));
  assert.ok(box.every((pack) => pack[4] === "SR" || pack[4] === "SCR"));
  assert.equal(base.filter((rarity) => rarity === "R").length, 100);
  assert.equal(base.filter((rarity) => rarity === "CR").length, 20);
  assert.equal(ordinary.length, 52);
  assert.equal(high.length, 8);
});

test("NS-05-M08 uses independent 48 SR / 12 SCR middle slots and one final hit", () => {
  const { box } = openBox("NS-05-M08", 0x508);
  const middle = box.flatMap((pack) => pack.slice(4, 7));
  const hits = box.map((pack) => pack[7]);

  assert.ok(box.every((pack) => pack.length === 8));
  assert.ok(box.every((pack) => pack.slice(0, 4).every((rarity) => rarity === "R" || rarity === "CR")));
  assert.ok(box.every((pack) => pack.slice(4, 7).every((rarity) => rarity === "SR" || rarity === "SCR")));
  assert.ok(box.every((pack) => pack[7] !== "R" && pack[7] !== "CR" && pack[7] !== "SR" && pack[7] !== "SCR"));
  assert.equal(middle.filter((rarity) => rarity === "SR").length, 48);
  assert.equal(middle.filter((rarity) => rarity === "SCR").length, 12);
  assert.equal(hits.filter((rarity) => rarity === "SSR").length, 18);
  assert.equal(hits.filter((rarity) => rarity === "INS").length, 1);
  assert.equal(hits.length, 20);
});

test("classic one-yuan packs cannot become all-R packs", () => {
  const { box } = openBox("NS-03", 3);
  assert.ok(box.every((pack) => pack.slice(0, 4).every((rarity) => rarity === "R")));
  assert.ok(box.every((pack) => pack[4] === "SR" || pack[4] === "SSR"));
  assert.equal(box.filter((pack) => pack[4] === "SSR").length, 6);
});

test("all 47 configurations compile to complete ordered boosters", () => {
  for (const [index, config] of packs.entries()) {
    const random = seeded(1000 + index);
    const recipe = compilePackRecipe(config, availableFor(config));
    let state = createCollationState(config, recipe, 1, random);
    assert.ok(isCollationStateValid(state, config, recipe), config.setName);
    for (let packIndex = 0; packIndex < config.boostersCount; packIndex += 1) {
      const draw = drawPackRarities(config, recipe, state, random);
      assert.equal(draw.rarities.length, config.odds.cardsPerPack, config.setName);
      assert.ok(draw.rarities.every((rarity) => rarity !== "[object Object]"), config.setName);
      state = draw.state;
    }
  }
});
