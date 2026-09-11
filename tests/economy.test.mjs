import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  STARTING_BALANCE_FEN,
  TRADE_RULES,
  applyTopup,
  cardValueFen,
  canOpenPack,
  canRemoveCards,
  canSpendFen,
  createEconomyState,
  creditFen,
  excessCopies,
  finalizeOpenedPack,
  parseCardValuesCsv,
  parseEconomyState,
  parseRarityValues,
  removeCards,
  sellCard,
  spendFen,
  storeSuccessChance,
  tradeExcess,
  yuanToFen,
} from "../app/economy.ts";

const rarityFile = JSON.parse(await readFile(new URL("../public/economy/rarity-values.json", import.meta.url), "utf8"));
const csv = await readFile(new URL("../public/economy/card-values.csv", import.meta.url), "utf8");

function rarityOfMap(map) {
  return (id) => map.get(id);
}

test("starting balance is 20 yuan in fen", () => {
  const state = createEconomyState();
  assert.equal(STARTING_BALANCE_FEN, 2000);
  assert.equal(state.balanceFen, 2000);
  assert.equal(yuanToFen(0.01), 1);
  assert.equal(yuanToFen(2.5), 250);
});

test("opening a pack spends yuan unless a matching voucher exists", () => {
  const empty = createEconomyState();
  assert.equal(canOpenPack(empty, 1), true);
  const opened = finalizeOpenedPack(empty, 1, [10, 11, 12]);
  assert.equal(opened.ok, true);
  assert.equal(opened.usedVoucher, null);
  assert.equal(opened.state.balanceFen, 1900);
  assert.equal(opened.state.cards["10"], 1);
  assert.equal(opened.state.packsOpenedSinceTopup, 1);
  assert.equal(opened.state.stats.packsOpened, 1);
  assert.equal(opened.state.stats.yuanSpentFen, 100);

  const broke = { ...createEconomyState(), balanceFen: 50 };
  assert.equal(canOpenPack(broke, 1), false);
  assert.equal(finalizeOpenedPack(broke, 1, [1]).ok, false);

  const voucher = { ...createEconomyState(), vouchers: { 1: 1, 2: 0 } };
  const redeemed = finalizeOpenedPack(voucher, 1, [7]);
  assert.equal(redeemed.ok, true);
  assert.equal(redeemed.usedVoucher, 1);
  assert.equal(redeemed.state.balanceFen, 2000);
  assert.equal(redeemed.state.vouchers[1], 0);
});

test("selling a card raises balance and lowers the count", () => {
  const owned = finalizeOpenedPack(createEconomyState(), 1, [42]).state;
  const sold = sellCard(owned, 42, 1);
  assert.equal(sold.ok, true);
  assert.equal(sold.state.cards["42"], undefined);
  assert.equal(sold.state.balanceFen, 1901);
  assert.equal(sold.state.stats.yuanEarnedFen, 1);
  assert.equal(sellCard(sold.state, 42, 1).ok, false);
});

test("50 extra R cards trade into a 1-yuan voucher", () => {
  const state = createEconomyState();
  state.cards = { "1": 51, "2": 3 };
  const rarityOf = rarityOfMap(new Map([[1, "R"], [2, "SR"]]));
  assert.equal(excessCopies(state, rarityOf, "R"), 50);
  const traded = tradeExcess(state, rarityOf, "R");
  assert.equal(traded.ok, true);
  assert.equal(traded.state.cards["1"], 1);
  assert.equal(traded.state.vouchers[1], 1);
  assert.equal(excessCopies(traded.state, rarityOf, "R"), 0);
});

test("5 extra SR cards trade into a 2-yuan voucher", () => {
  const state = createEconomyState();
  state.cards = { "8": 2, "9": 2, "10": 3, "11": 2 };
  const rarityOf = rarityOfMap(new Map([[8, "SR"], [9, "SR"], [10, "SR"], [11, "SR"]]));
  assert.equal(excessCopies(state, rarityOf, "SR"), 5);
  const traded = tradeExcess(state, rarityOf, "SR");
  assert.equal(traded.ok, true);
  assert.equal(traded.state.vouchers[2], 1);
  assert.equal(traded.state.cards["10"], 1);
  assert.equal(TRADE_RULES.SR.excess, 5);
});

test("store success chance gains 1% per opened pack and caps at 100%", () => {
  assert.equal(storeSuccessChance(0.95, 0), 0.95);
  assert.equal(storeSuccessChance(0.8, 10), 0.9);
  assert.equal(storeSuccessChance(0.5, 10), 0.6);
  assert.equal(storeSuccessChance(0.3, 10), 0.4);
  assert.equal(storeSuccessChance(0.1, 10), 0.2);
  assert.equal(storeSuccessChance(0.02, 10), 0.12);
  assert.equal(storeSuccessChance(0.95, 10), 1);
  assert.equal(storeSuccessChance(0.95, 20), 1);
});

test("successful top-up resets the pack bonus", () => {
  const state = { ...createEconomyState(), packsOpenedSinceTopup: 10 };
  const next = applyTopup(state, 10);
  assert.equal(next.packsOpenedSinceTopup, 0);
  assert.equal(next.balanceFen, 3000);
});

test("CSV values win over rarity defaults, with fallback for unknown rarities", () => {
  const parsed = parseRarityValues(rarityFile);
  const byId = parseCardValuesCsv("id,set_name,number,rarity,character,value_yuan\n1,NS-01,001,SSR,Test,9.99\n");
  const prices = { byId, rarityYuan: parsed.rarityYuan, fallbackYuan: parsed.fallbackYuan };
  assert.equal(cardValueFen(1, "SSR", prices), 999);
  assert.equal(cardValueFen(99, "R", prices), 1);
  assert.equal(cardValueFen(99, "ZZZ", prices), 100);
  assert.equal(parsed.rarityYuan.SCR, 1.25);
  assert.equal(parsed.rarityYuan.SSR, 2.5);
});

test("rarity table covers the bundled catalog and the CSV lists every card", async () => {
  const source = await readFile(new URL("../public/card-data/db.js", import.meta.url), "utf8");
  const database = JSON.parse(source.trim().replace(/^window\.CARD_LISTER_DB\s*=\s*/, "").replace(/;\s*$/, ""));
  const rarities = new Set(database.cards.map((card) => card.rarity));
  for (const rarity of rarities) {
    assert.ok(rarity in rarityFile.values, `missing rarity price for ${rarity}`);
  }
  const rows = csv.trim().split("\n");
  assert.equal(rows[0], "id,set_name,number,rarity,character,title,popularity,popularity_factor,raw_value_yuan,balance_factor,value_yuan");
  assert.equal(rows.length - 1, database.cards.length);
});

test("yuan house bets spend and credit without touching vouchers or pack counters", () => {
  const spent = spendFen(createEconomyState(), 250);
  assert.equal(spent.ok, true);
  assert.equal(spent.state.balanceFen, 1750);
  assert.equal(spent.state.stats.yuanSpentFen, 250);
  assert.equal(spent.state.stats.packsOpened, 0);
  assert.equal(spent.state.vouchers[1], 0);
  assert.equal(canSpendFen(spent.state, 1751), false);
  assert.equal(spendFen(spent.state, 0).ok, false);
  assert.equal(spendFen(spent.state, 2000).ok, false);

  const paid = creditFen(spent.state, 500);
  assert.equal(paid.ok, true);
  assert.equal(paid.state.balanceFen, 2250);
  assert.equal(paid.state.stats.yuanEarnedFen, 500);
  assert.equal(creditFen(spent.state, 0).ok, false);
});

test("card wagers remove exact copies and reject missing inventory", () => {
  const owned = { ...createEconomyState(), cards: { "10": 2, "11": 1 } };
  assert.equal(canRemoveCards(owned, [10, 10, 11]), true);
  const taken = removeCards(owned, [10, 10, 11]);
  assert.equal(taken.ok, true);
  assert.equal(taken.state.cards["10"], undefined);
  assert.equal(taken.state.cards["11"], undefined);
  assert.equal(canRemoveCards(owned, [10, 10, 10]), false);
  assert.equal(removeCards(owned, [99]).ok, false);
  assert.equal(removeCards(owned, []).ok, false);
});

test("invalid stored economy is rejected", () => {
  assert.equal(parseEconomyState(null), null);
  assert.equal(parseEconomyState({ version: 2, balanceFen: 20 }), null);
  assert.equal(parseEconomyState({ version: 1, balanceFen: -1, packsOpenedSinceTopup: 0 }), null);
  const valid = parseEconomyState({ version: 1, balanceFen: 150, packsOpenedSinceTopup: 3, cards: { "9": 2 } });
  assert.equal(valid?.balanceFen, 150);
  assert.equal(valid?.cards["9"], 2);
});
