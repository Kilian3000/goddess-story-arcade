import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CARD_VALUES_HEADER,
  cardValueYuan,
  listedRuleTitles,
  missingRuleTitles,
  parseCsvRows,
  popularityFactor,
  popularityTier,
} from "../scripts/popularity.mjs";

const rules = JSON.parse(await readFile(new URL("../public/economy/popularity-rules.json", import.meta.url), "utf8"));
const rarityFile = JSON.parse(await readFile(new URL("../public/economy/rarity-values.json", import.meta.url), "utf8"));
const csv = await readFile(new URL("../public/economy/card-values.csv", import.meta.url), "utf8");
const source = await readFile(new URL("../public/card-data/db.js", import.meta.url), "utf8");
const database = JSON.parse(source.trim().replace(/^window\.CARD_LISTER_DB\s*=\s*/, "").replace(/;\s*$/, ""));

function card(title, character, extras = {}) {
  return { id: 1, title, character, ...extras };
}

function firstCard(title, character) {
  const match = database.cards.find((entry) => entry.title === title && String(entry.character || "").trim() === character);
  assert.ok(match, `missing catalog card ${title} / ${character}`);
  return match;
}

test("catalog characters land in the planned popularity tiers", () => {
  assert.equal(popularityTier(firstCard("Sousou no Frieren", "Frieren"), rules), "mythic");
  assert.equal(popularityTier(firstCard("JoJo's Bizarre Adventure", "Jolyne Kujo"), rules), "mythic");
  assert.equal(popularityTier(firstCard("One Piece", "Nami"), rules), "mythic");
  assert.equal(popularityTier(firstCard("Sousou no Frieren", "Fern"), rules), "legendary");
  assert.equal(popularityTier(firstCard("Sword Art Online", "Asuna Yuuki"), rules), "legendary");
  assert.equal(popularityTier(firstCard("One Piece", "Nico Robin"), rules), "legendary");
  assert.equal(popularityTier(firstCard("Akame Ga Kill!", "Esdeath"), rules), "epic");
  assert.equal(popularityTier(firstCard("Sousou no Frieren", "Ubel"), rules), "rare");
  assert.equal(popularityTier(firstCard("The Rising of the Shield Hero", "Filo"), rules), "rare");
  assert.equal(popularityTier(firstCard("NieR: Automata", "A2"), rules), "rare");
  assert.equal(popularityTier(firstCard("My Dress-Up Darling", "Sajuna Inui"), rules), "rare");
  assert.equal(popularityTier(firstCard("My Dress-Up Darling", "Marin Kitagawa"), rules), "epic");
  assert.equal(popularityTier(card("Guilty Crown", "Inori Yuzuriha"), rules), "common");
});

test("popularity factors stay stable and stay inside the two-decimal range", () => {
  const common = popularityFactor(42, "common", rules);
  assert.equal(popularityFactor(42, "common", rules), common);
  assert.equal(Number(common.toFixed(2)), common);
  assert.ok(common >= 1 && common <= 1.05);
  assert.ok(
    Array.from({ length: 32 }, (_, index) => popularityFactor(index + 1, "common", rules)).some((factor) => factor !== common),
    "common factors should vary across card ids",
  );

  const epic = popularityFactor(9789, "epic", rules);
  assert.ok(epic >= 3 && epic <= 5);
  assert.equal(epic, Number(epic.toFixed(2)));

  const mythic = popularityFactor(9789, "mythic", rules);
  assert.ok(mythic >= 50 && mythic <= 100);
});

test("card value is the rarity base times the rounded popularity factor", () => {
  assert.equal(cardValueYuan(2.5, 3.81), 9.53);
  assert.equal(cardValueYuan(0.01, 1.03), 0.01);
  assert.equal(cardValueYuan(0.01, 1.5), 0.02);
});

test("every popularity rule title exists in the catalog", () => {
  assert.deepEqual(missingRuleTitles(database.cards, rules), []);
  assert.ok(listedRuleTitles(rules).has("Spy X Family"));
  assert.ok(listedRuleTitles(rules).has("Steins; Gate"));
});

test("generated CSV stores a stable popularity price for every card", () => {
  const rows = parseCsvRows(csv);
  assert.equal(rows[0].join(","), CARD_VALUES_HEADER);
  assert.equal(rows.length - 1, database.cards.length);

  const header = rows[0];
  const idIndex = header.indexOf("id");
  const rarityIndex = header.indexOf("rarity");
  const popularityIndex = header.indexOf("popularity");
  const factorIndex = header.indexOf("popularity_factor");
  const valueIndex = header.indexOf("value_yuan");

  for (const cols of rows.slice(1)) {
    const id = Number(cols[idIndex]);
    const rarity = cols[rarityIndex];
    const popularity = cols[popularityIndex];
    const factor = Number(cols[factorIndex]);
    const value = Number(cols[valueIndex]);
    const expectedFactor = popularityFactor(id, popularity, rules);
    const expectedValue = cardValueYuan(rarityFile.values[rarity] ?? rarityFile.fallbackYuan, expectedFactor);
    const [min, max] = rules.ranges[popularity];

    assert.equal(factor, expectedFactor);
    assert.equal(cols[factorIndex], expectedFactor.toFixed(2));
    assert.equal(value, expectedValue);
    assert.ok(factor >= min && factor <= max, `${id} ${popularity} ${factor}`);
  }
});
