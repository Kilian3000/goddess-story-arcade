import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compilePackRecipe, createCollationState } from "../app/gacha-engine.ts";
import {
  boxMeter,
  chooseUniqueCard,
  drawFilledPacks,
  drawThrowawayPacks,
  packHasHit,
  revealMarks,
} from "../app/pack-draw.ts";

const { packs } = JSON.parse(await readFile(new URL("../public/pack-configs.json", import.meta.url), "utf8"));

function seeded(seed = 0x51f00d) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function fakeCards(setName, rarities, start = 1) {
  return rarities.flatMap((rarity, rarityIndex) => Array.from({ length: 40 }, (_, index) => ({
    id: start + rarityIndex * 40 + index,
    number: `${rarity}-${index}`,
    rarity,
    ord: index,
    set_name: setName,
    character: `${rarity} ${index}`,
    title: setName,
    image_path: null,
  })));
}

test("chooseUniqueCard never repeats an id inside one pack", () => {
  const used = new Set();
  const pool = fakeCards("NS-03", ["R"]);
  const first = chooseUniqueCard(pool, used, seeded(1));
  const second = chooseUniqueCard(pool, used, seeded(2));
  assert.ok(first && second);
  assert.notEqual(first.id, second.id);
});

test("drawFilledPacks fills a physical pack and throwaway draws do not share state", () => {
  const config = packs.find((pack) => pack.setName === "NS-03");
  const recipe = compilePackRecipe(config, new Set(["R", "SR", "SSR"]));
  const cards = fakeCards("NS-03", ["R", "SR", "SSR"]);
  const getPool = (rarity) => cards.filter((card) => card.rarity === rarity);
  const first = drawFilledPacks({
    config,
    recipe,
    getPool,
    count: 1,
    collation: createCollationState(config, recipe, 1, seeded(9)),
    random: seeded(9),
  });
  assert.equal(first.ok, true);
  assert.equal(first.packs[0].length, config.odds.cardsPerPack);
  assert.equal(new Set(first.packs[0].map((card) => card.id)).size, first.packs[0].length);
  const ephemeral = drawThrowawayPacks({
    config,
    recipe,
    getPool,
    count: 1,
    random: () => 0,
  });
  assert.equal(ephemeral.ok, true);
  assert.equal(ephemeral.godPack, false);
  const blessed = drawFilledPacks({
    config,
    recipe,
    getPool,
    count: 1,
    collation: createCollationState(config, recipe, 1, seeded(3)),
    allowGodPack: true,
    random: () => 0,
  });
  assert.equal(blessed.ok, true);
  assert.equal(blessed.godPack, true);
  const meter = boxMeter(config, recipe, first.collation);
  assert.equal(meter.packIndex, 1);
  assert.equal(meter.remainingPacks, config.boostersCount - 1);
});

test("reveal marks flag first copies and chase hits", () => {
  const cards = fakeCards("NS-03", ["R"]).slice(0, 2);
  const marks = revealMarks(cards, { [String(cards[0].id)]: 1 }, [cards[1].id]);
  assert.equal(marks[0].isNew, false);
  assert.equal(marks[0].copies, 2);
  assert.equal(marks[1].isNew, true);
  assert.equal(marks[1].chase, true);
  assert.equal(packHasHit([{ rarity: "SSR" }]), true);
  assert.equal(packHasHit([{ rarity: "R" }]), false);
});
