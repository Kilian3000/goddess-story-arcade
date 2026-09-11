import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CARD_VALUES_HEADER,
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
const csvPath = path.join(root, "public/economy/card-values.csv");

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

const source = await readFile(databasePath, "utf8");
const database = JSON.parse(source.trim().replace(/^window\.CARD_LISTER_DB\s*=\s*/, "").replace(/;\s*$/, ""));
const rarityFile = JSON.parse(await readFile(rarityPath, "utf8"));
const rules = JSON.parse(await readFile(rulesPath, "utf8"));
const rarityYuan = rarityFile.values ?? {};
const fallbackYuan = Number(rarityFile.fallbackYuan) || 1;

const cards = [...database.cards].sort((left, right) => left.id - right.id);
const lines = [CARD_VALUES_HEADER];
const missing = new Set();
const tierCounts = emptyTierCounts();

for (const card of cards) {
  if (!(card.rarity in rarityYuan)) missing.add(card.rarity);
  const popularity = popularityTier(card, rules);
  const factor = popularityFactor(card.id, popularity, rules);
  const value = cardValueYuan(rarityYuan[card.rarity] ?? fallbackYuan, factor);
  tierCounts[popularity] += 1;
  lines.push([
    card.id,
    csvEscape(card.set_name),
    csvEscape(card.number),
    csvEscape(card.rarity),
    csvEscape(card.character),
    csvEscape(card.title),
    popularity,
    factor.toFixed(2),
    value.toFixed(2),
  ].join(","));
}

await writeFile(csvPath, `${lines.join("\n")}\n`, "utf8");

const missingTitles = missingRuleTitles(database.cards, rules);
const summary = Object.entries(tierCounts).map(([tier, count]) => `${count} ${tier}`).join(", ");
console.log(`Wrote ${cards.length} card values (${summary}).`);
if (missing.size) console.warn(`Missing rarity prices: ${[...missing].join(", ")}`);
if (missingTitles.length) console.warn(`Missing popularity titles: ${missingTitles.join(", ")}`);
