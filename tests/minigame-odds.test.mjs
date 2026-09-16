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
  coinflipIsEven,
  matchCoinflipStake,
  assignJackpotColors,
  combinations,
  crashPoint,
  dealClassStake,
  JACKPOT_PLAYER_COLOR,
  JACKPOT_SEAT_COLORS,
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
  closestValueCard,
  duelAtk,
  hiloCall,
  hiloPayout,
  packBattleRanks,
  caboScore,
  koiYaku,
  loveMustCountess,
  patiencePair,
  scopaCaptures,
  speedPayout,
  upgraderChance,
  upgraderTargetFen,
} from "../app/minigames/odds.ts";
import { ufoPush } from "../app/arcade-flavor.ts";
import { normalizeMinigameId } from "../app/economy.ts";

test("legacy prize locks map onto hub minigame ids", () => {
  assert.equal(normalizeMinigameId("shrine"), "waifu21");
  assert.equal(normalizeMinigameId("duel"), "duel");
  assert.equal(normalizeMinigameId("heartlock"), "heartlock");
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
  assert.equal(COINFLIP_WIN_CHANCE, 0.5);
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

test("jackpot seats never reuse a color", () => {
  const colors = assignJackpotColors(6, [JACKPOT_PLAYER_COLOR], () => 0.4);
  assert.equal(colors.length, 6);
  assert.equal(new Set(colors).size, 6);
  assert.ok(!colors.includes(JACKPOT_PLAYER_COLOR));
  assert.equal(new Set(JACKPOT_SEAT_COLORS).size, JACKPOT_SEAT_COLORS.length);
  assert.ok(!JACKPOT_SEAT_COLORS.includes(JACKPOT_PLAYER_COLOR));
});

test("coinflip chance is even when the bot matches, otherwise pot share", () => {
  assert.equal(coinflipChance(100, 100), COINFLIP_WIN_CHANCE);
  assert.equal(coinflipChance(100, 112), COINFLIP_WIN_CHANCE);
  assert.equal(coinflipChance(1000, 2000), (1000 / 3000) * JACKPOT_RAKE);
  assert.equal(coinflipChance(0, 100), 0);
  assert.equal(coinflipIsEven(100, 115), true);
  assert.equal(coinflipIsEven(100, 140), false);
});

test("coinflip bot answers with 1–2 cards near the player stake", () => {
  const one = matchCoinflipStake([
    { id: 1, valueFen: 40 },
    { id: 2, valueFen: 98 },
    { id: 3, valueFen: 400 },
  ], 100);
  assert.deepEqual(one.ids, [2]);
  assert.equal(one.cards, 1);
  assert.equal(one.even, true);

  const richerSingle = matchCoinflipStake([
    { id: 1, valueFen: 50 },
    { id: 2, valueFen: 50 },
    { id: 3, valueFen: 110 },
  ], 100);
  assert.deepEqual(richerSingle.ids, [3]);
  assert.equal(richerSingle.cards, 1);

  const pair = matchCoinflipStake([
    { id: 1, valueFen: 40 },
    { id: 2, valueFen: 60 },
    { id: 3, valueFen: 400 },
  ], 100);
  assert.equal(pair.cards, 2);
  assert.deepEqual([...pair.ids].sort((left, right) => left - right), [1, 2]);
  assert.equal(pair.even, true);

  const pile = matchCoinflipStake([
    { id: 1, valueFen: 12 },
    { id: 2, valueFen: 15 },
    { id: 3, valueFen: 18 },
    { id: 4, valueFen: 95 },
  ], 100);
  assert.deepEqual(pile.ids, [4]);
  assert.equal(pile.cards, 1);

  assert.deepEqual(matchCoinflipStake([], 100).ids, []);
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

test("hi-lo, duel and pack battle helpers stay deterministic", () => {
  assert.equal(hiloCall(10, 12), "higher");
  assert.equal(hiloCall(12, 10), "lower");
  assert.equal(hiloCall(10, 10), "push");
  assert.equal(hiloPayout(100, 1), 192);
  assert.equal(duelAtk(3, 250), 60 + 25);
  assert.equal(closestValueCard([{ id: 1, valueFen: 40 }, { id: 2, valueFen: 90 }], 100)?.id, 2);
  const battle = packBattleRanks([
    { id: "you", values: [80, 10] },
    { id: "bot", values: [50, 40] },
  ]);
  assert.equal(battle.winnerId, "you");
  assert.equal(packBattleRanks([
    { id: "a", values: [50, 20] },
    { id: "b", values: [50, 20] },
  ]).tied, true);
});

test("new table helpers stay deterministic", () => {
  assert.equal(speedPayout(100, 2), 192);
  assert.equal(caboScore([10, 20, 5]), 35);
  assert.deepEqual(scopaCaptures(7, [3, 4, 9]), [3, 4]);
  assert.deepEqual(scopaCaptures(9, [9, 2]), [9]);
  assert.equal(loveMustCountess([7, 5]), true);
  assert.equal(loveMustCountess([7, 1]), false);
  assert.equal(koiYaku([{ character: "A" }, { character: "A" }, { character: "A" }]), 3);
  assert.equal(patiencePair({ character: "A", rarity: "R" }, { character: "A", rarity: "SR" }), true);
  assert.equal(ufoPush("center", () => 0), 12);
  assert.equal(ufoPush("left", () => 0), 8);
});
