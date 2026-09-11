import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  compilePackRecipe,
  createCollationState,
  drawPackRarities,
} from "../app/gacha-engine.ts";
import {
  CARD_VALUES_HEADER,
  balancedCardValueYuan,
  cardValueYuan,
  emptyTierCounts,
  missingRuleTitles,
  popularityFactor,
  popularityTier,
} from "./popularity.mjs";

const root = path.resolve(import.meta.dirname, "..");
const databasePath = path.join(root, "public/card-data/db.js");
const rarityPath = path.join(root, "public/economy/rarity-values.json");
const rulesPath = path.join(root, "public/economy/popularity-rules.json");
const balancePath = path.join(root, "public/economy/price-balance.json");
const packPath = path.join(root, "public/pack-configs.json");
const csvPath = path.join(root, "public/economy/card-values.csv");

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const source = await readFile(databasePath, "utf8");
const database = JSON.parse(source.trim().replace(/^window\.CARD_LISTER_DB\s*=\s*/, "").replace(/;\s*$/, ""));
const rarityFile = JSON.parse(await readFile(rarityPath, "utf8"));
const rules = JSON.parse(await readFile(rulesPath, "utf8"));
const balance = JSON.parse(await readFile(balancePath, "utf8"));
const { packs } = JSON.parse(await readFile(packPath, "utf8"));
const rarityYuan = rarityFile.values ?? {};
const fallbackYuan = Number(rarityFile.fallbackYuan) || 1;
const minimumYuan = Number(balance.minimumCardValueYuan) || 0.01;
const boxesPerBooster = Math.max(1, Math.round(Number(balance.boxesPerBooster) || 256));

const cards = [...database.cards].sort((left, right) => left.id - right.id);
const usableCards = cards.filter((card) => !card.image_missing && card.image_path);
const missing = new Set();
const tierCounts = emptyTierCounts();
const rows = cards.map((card) => {
  if (!(card.rarity in rarityYuan)) missing.add(card.rarity);
  const popularity = popularityTier(card, rules);
  const factor = popularityFactor(card.id, popularity, rules);
  const rarityBoost = Number(balance.rarityValueBoostBySet?.[card.set_name]?.[card.rarity]) || 1;
  const rawValueYuan = cardValueYuan((rarityYuan[card.rarity] ?? fallbackYuan) * rarityBoost, factor);
  tierCounts[popularity] += 1;
  return { card, popularity, factor, rawValueYuan };
});
const rowById = new Map(rows.map((row) => [row.card.id, row]));
const packBySet = new Map(packs.map((pack) => [pack.setName, pack]));

const poolMap = new Map();
for (const card of usableCards) {
  const key = `${card.set_name}\0${card.rarity}`;
  const pool = poolMap.get(key) || [];
  pool.push(card);
  poolMap.set(key, pool);
}

const oneYuanPacks = packs.filter((pack) => pack.group === "1 юань");
function poolFor(config, rarity) {
  const pool = [...(poolMap.get(`${config.setName}\0${rarity}`) || [])];
  if (rarity === "R" && config.group === "1 юань") {
    const index = oneYuanPacks.findIndex((pack) => pack.setName === config.setName);
    const previous = index > 0 ? oneYuanPacks[index - 1] : null;
    if (previous) pool.push(...(poolMap.get(`${previous.setName}\0R`) || []));
  }
  return pool;
}

function rarityProfile(config, configIndex) {
  const random = seeded((0x6d2b79f5 ^ Math.imul(config.id + 1, 2654435761) ^ configIndex) >>> 0);
  const available = new Set(
    usableCards.filter((card) => card.set_name === config.setName).map((card) => card.rarity),
  );
  const recipe = compilePackRecipe(config, available);
  let state = createCollationState(config, recipe, 1, random);
  const counts = new Map();
  const openings = config.boostersCount * boxesPerBooster;
  for (let opening = 0; opening < openings; opening += 1) {
    const draw = drawPackRarities(config, recipe, state, random);
    state = draw.state;
    for (const rarity of draw.rarities) counts.set(rarity, (counts.get(rarity) || 0) + 1);
  }
  return {
    config,
    countsPerPack: new Map([...counts].map(([rarity, count]) => [rarity, count / openings])),
  };
}

const profiles = packs.map(rarityProfile);
const scales = new Map(packs.map((pack) => [pack.setName, 1]));

function valueForRow(row, scaleMap) {
  const config = packBySet.get(row.card.set_name);
  const scale = scaleMap.get(row.card.set_name) ?? 1;
  const cap = Number(balance.jackpotCapYuanByCost?.[String(config?.cost)])
    || Number(balance.defaultJackpotCapYuan)
    || Number.POSITIVE_INFINITY;
  return balancedCardValueYuan(row.rawValueYuan, scale, minimumYuan, cap);
}

function expectedPackValue(profile, scaleMap) {
  let total = 0;
  for (const [rarity, count] of profile.countsPerPack) {
    const pool = poolFor(profile.config, rarity);
    if (!pool.length) continue;
    const average = pool.reduce((sum, card) => {
      const row = rowById.get(card.id);
      return sum + (row ? valueForRow(row, scaleMap) : 0);
    }, 0) / pool.length;
    total += count * average;
  }
  return total;
}

let iterations = 0;
for (; iterations < 200; iterations += 1) {
  let largestRelativeError = 0;
  const updates = [];
  for (const profile of profiles) {
    const targetRatio = Number(balance.targetReturnByCost?.[String(profile.config.cost)]) || 1;
    const target = profile.config.cost * targetRatio;
    const current = expectedPackValue(profile, scales);
    if (!(current > 0)) continue;
    largestRelativeError = Math.max(largestRelativeError, Math.abs(current - target) / target);
    const oldScale = scales.get(profile.config.setName) || 1;
    const correction = Math.max(0.2, Math.min(5, target / current));
    updates.push([profile.config.setName, Math.max(0.0001, Math.min(1000, oldScale * correction ** 0.7))]);
  }
  for (const [setName, scale] of updates) scales.set(setName, scale);
  if (largestRelativeError < 0.001) break;
}

const finalLines = [CARD_VALUES_HEADER];
for (const row of rows) {
  const balanceFactor = scales.get(row.card.set_name) ?? 1;
  const value = valueForRow(row, scales);
  finalLines.push([
    row.card.id,
    csvEscape(row.card.set_name),
    csvEscape(row.card.number),
    csvEscape(row.card.rarity),
    csvEscape(row.card.character),
    csvEscape(row.card.title),
    row.popularity,
    row.factor.toFixed(2),
    row.rawValueYuan.toFixed(2),
    balanceFactor.toFixed(12),
    value.toFixed(2),
  ].join(","));
}

await writeFile(csvPath, `${finalLines.join("\n")}\n`, "utf8");

const outcomes = profiles.map((profile) => {
  const targetRatio = Number(balance.targetReturnByCost?.[String(profile.config.cost)]) || 1;
  const expected = expectedPackValue(profile, scales);
  return {
    setName: profile.config.setName,
    cost: profile.config.cost,
    expected,
    returnRatio: expected / profile.config.cost,
    targetRatio,
  };
});
const worstError = Math.max(...outcomes.map((row) => Math.abs(row.returnRatio - row.targetRatio)));
const missingTitles = missingRuleTitles(database.cards, rules);
const summary = Object.entries(tierCounts).map(([tier, count]) => `${count} ${tier}`).join(", ");
console.log(`Wrote ${cards.length} balanced card values (${summary}).`);
console.log(`Balanced ${packs.length} boosters in ${Math.min(iterations + 1, 200)} passes; worst return-ratio error ${worstError.toFixed(4)}.`);
if (missing.size) console.warn(`Missing rarity prices: ${[...missing].join(", ")}`);
if (missingTitles.length) console.warn(`Missing popularity titles: ${missingTitles.join(", ")}`);
