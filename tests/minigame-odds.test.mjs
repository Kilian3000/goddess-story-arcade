import assert from "node:assert/strict";
import test from "node:test";
import {
  COINFLIP_WIN_CHANCE,
  CRASH_HOUSE,
  JACKPOT_RAKE,
  JACKPOT_TIERS,
  ROULETTE_COLOR_PAYOUT,
  ROULETTE_GREEN_PAYOUT,
  ROULETTE_ORDER,
  UPGRADER_HOUSE,
  coinflipChance,
  combinations,
  crashPoint,
  dealClassStake,
  jackpotBotCount,
  jackpotBotTargetFen,
  jackpotChance,
  jackpotTierById,
  jackpotWeights,
  minesMultiplier,
  payoutFen,
  pickCardsForValue,
  pickWeightedIndex,
  placeMines,
  rankUpgradeTargets,
  rouletteColor,
  rouletteMultiplier,
  upgraderChance,
  upgraderTargetFen,
} from "../app/minigames/odds.ts";
import { normalizeMinigameId } from "../app/economy.ts";

test("legacy prize locks map onto hub minigame ids", () => {
  assert.equal(normalizeMinigameId("shrine"), "waifu21");
  assert.equal(normalizeMinigameId("duel"), "heartlock");
  assert.equal(normalizeMinigameId("crash"), "crash");
  assert.equal(normalizeMinigameId("nope"), null);
});

test("crash points follow 0.96 / u with a rare instant bust", () => {
  assert.equal(crashPoint(0.005), 1);
  assert.equal(crashPoint(CRASH_HOUSE), 1);
  assert.equal(crashPoint(0.48), 2);
  assert.equal(crashPoint(0.096), 10);
  assert.equal(crashPoint(0), 1);
});

test("CSGO roulette pockets pay green 14x and colors 2x", () => {
  assert.equal(ROULETTE_ORDER.length, 15);
  assert.equal(rouletteColor(0), "green");
  assert.equal(rouletteColor(3), "red");
  assert.equal(rouletteColor(11), "black");
  assert.equal(rouletteMultiplier("green", 0), ROULETTE_GREEN_PAYOUT);
  assert.equal(rouletteMultiplier("red", 4), ROULETTE_COLOR_PAYOUT);
  assert.equal(rouletteMultiplier("black", 4), 0);
  assert.equal(rouletteMultiplier(12, 12), ROULETTE_GREEN_PAYOUT);
  assert.equal(rouletteMultiplier(12, 0), 0);
  assert.equal(payoutFen(200, 2), 400);
});

test("mines multipliers apply a 4% house edge to fair odds", () => {
  assert.equal(combinations(25, 2), 300);
  const oneSafe = minesMultiplier(3, 1);
  const fair = 25 / 22;
  assert.equal(oneSafe, Math.floor((0.96 * fair) * 100) / 100);
  assert.ok(minesMultiplier(3, 2) > oneSafe);
  assert.equal(minesMultiplier(3, 0), 0);
  assert.equal(placeMines(3, () => 0).size, 3);
});

test("card tables keep a rake under even value", () => {
  assert.equal(jackpotChance(100, 400), 0.24);
  assert.deepEqual(jackpotWeights([100, 100], 0), [100 * JACKPOT_RAKE, 100]);
  assert.equal(pickWeightedIndex([0, 10], () => 0.1), 1);
  assert.equal(upgraderChance(100, 200), 0.475);
  assert.equal(upgraderChance(1000, 100), UPGRADER_HOUSE);
  assert.equal(COINFLIP_WIN_CHANCE, 0.48);
  assert.deepEqual(pickCardsForValue([{ id: 7, valueFen: 80 }], 100, () => 0), [7]);
});

test("jackpot tables are five named classes with rising bot caps", () => {
  assert.equal(JACKPOT_TIERS.length, 5);
  assert.deepEqual(JACKPOT_TIERS.map((tier) => tier.id), ["street", "club", "lounge", "vip", "throne"]);
  for (let index = 1; index < JACKPOT_TIERS.length; index += 1) {
    assert.ok(JACKPOT_TIERS[index].botMaxFen > JACKPOT_TIERS[index - 1].botMaxFen);
  }
  const lounge = jackpotTierById("lounge");
  assert.equal(lounge.title, "LOUNGE CLASS");
  assert.equal(jackpotBotCount(lounge, () => 0), lounge.botsMin);
  assert.equal(jackpotBotCount(lounge, () => 0.999), lounge.botsMax);
  const target = jackpotBotTargetFen(lounge, () => 0.5);
  assert.ok(target >= lounge.botMinFen && target <= lounge.botMaxFen);
  assert.equal(jackpotTierById("missing").id, "street");
});

test("coinflip chance follows pot share with the same rake", () => {
  assert.equal(coinflipChance(100, 100), 0.48);
  assert.equal(coinflipChance(1000, 2000), (1000 / 3000) * JACKPOT_RAKE);
  assert.equal(coinflipChance(0, 100), 0);
  const lounge = jackpotTierById("lounge");
  const dealt = dealClassStake([
    { id: 1, valueFen: 900 },
    { id: 2, valueFen: 1100 },
    { id: 3, valueFen: 2000 },
    { id: 4, valueFen: 50000 },
  ], lounge, () => 0.5);
  assert.ok(dealt.targetFen >= lounge.botMinFen && dealt.targetFen <= lounge.botMaxFen);
  assert.ok(dealt.ids.length >= 1);
  assert.ok(!dealt.ids.includes(4));
});

test("upgrade row ranks the closest chance first", () => {
  const ranked = rankUpgradeTargets([
    { id: 1, valueFen: 200 },
    { id: 2, valueFen: 400 },
    { id: 3, valueFen: 1000 },
  ], 100, 0.4);
  assert.equal(ranked[0].id, 1);
  assert.equal(upgraderTargetFen(100, 0.475), 200);
  assert.equal(ranked.length, 3);
});
