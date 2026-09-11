export const CRASH_HOUSE = 0.96;
export const CRASH_INSTANT_BUST = 0.01;
export const MINES_TILES = 25;
export const MINES_HOUSE = 0.96;
export const JACKPOT_RAKE = 0.96;
export const COINFLIP_WIN_CHANCE = 0.48;
export const UPGRADER_HOUSE = 0.95;
export const ROULETTE_GREEN_PAYOUT = 14;
export const ROULETTE_COLOR_PAYOUT = 2;

export const ROULETTE_ORDER = [1, 14, 2, 13, 3, 12, 4, 0, 11, 5, 10, 6, 9, 7, 8] as const;

export type RouletteColor = "green" | "red" | "black";
export type RouletteBet = RouletteColor | number;

export type RandomSource = () => number;

export function payoutFen(stakeFen: number, multiplier: number) {
  if (stakeFen <= 0 || multiplier <= 0) return 0;
  return Math.round(stakeFen * multiplier);
}

export function crashPoint(u: number) {
  if (!Number.isFinite(u) || u <= 0) return 1;
  if (u < CRASH_INSTANT_BUST) return 1;
  return Math.max(1, Math.floor((CRASH_HOUSE / u) * 100) / 100);
}

export function rollCrashPoint(random: RandomSource) {
  return crashPoint(random());
}

export function rouletteColor(pocket: number): RouletteColor {
  if (pocket === 0) return "green";
  if (pocket >= 1 && pocket <= 7) return "red";
  return "black";
}

export function rouletteMultiplier(bet: RouletteBet, pocket: number) {
  if (typeof bet === "number") return bet === pocket ? ROULETTE_GREEN_PAYOUT : 0;
  if (bet === "green") return pocket === 0 ? ROULETTE_GREEN_PAYOUT : 0;
  return rouletteColor(pocket) === bet ? ROULETTE_COLOR_PAYOUT : 0;
}

export function combinations(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  const picks = Math.min(k, n - k);
  let result = 1;
  for (let index = 1; index <= picks; index += 1) {
    result = (result * (n - picks + index)) / index;
  }
  return result;
}

export function minesMultiplier(mines: number, revealed: number, tiles = MINES_TILES) {
  if (mines < 1 || revealed < 1 || mines >= tiles || revealed > tiles - mines) return 0;
  const chance = combinations(tiles - mines, revealed) / combinations(tiles, revealed);
  if (chance <= 0) return 0;
  return Math.floor((MINES_HOUSE / chance) * 100) / 100;
}

export function placeMines(count: number, random: RandomSource, tiles = MINES_TILES) {
  const capped = Math.max(1, Math.min(tiles - 1, Math.floor(count)));
  const slots = Array.from({ length: tiles }, (_, index) => index);
  for (let index = slots.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [slots[index], slots[other]] = [slots[other], slots[index]];
  }
  return new Set(slots.slice(0, capped));
}

export function jackpotChance(stakeValue: number, potValue: number) {
  if (stakeValue <= 0 || potValue <= 0) return 0;
  return (stakeValue / potValue) * JACKPOT_RAKE;
}

export function pickWeightedIndex(weights: number[], random: RandomSource) {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) return 0;
  let ticket = random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    ticket -= Math.max(0, weights[index]);
    if (ticket <= 0) return index;
  }
  return weights.length - 1;
}

export function jackpotWeights(values: number[], playerIndex = 0) {
  return values.map((value, index) => (index === playerIndex ? value * JACKPOT_RAKE : value));
}

export const JACKPOT_TIERS = [
  { id: "street", title: "STREET CLASS", blurb: "loose change", botMinFen: 20, botMaxFen: 200, botsMin: 2, botsMax: 4 },
  { id: "club", title: "CLUB CLASS", blurb: "neon chips", botMinFen: 200, botMaxFen: 800, botsMin: 2, botsMax: 5 },
  { id: "lounge", title: "LOUNGE CLASS", blurb: "mid rollers", botMinFen: 800, botMaxFen: 2500, botsMin: 3, botsMax: 5 },
  { id: "vip", title: "VIP CLASS", blurb: "whale seats", botMinFen: 2500, botMaxFen: 8000, botsMin: 3, botsMax: 5 },
  { id: "throne", title: "THRONE CLASS", blurb: "goddess pot", botMinFen: 8000, botMaxFen: 25000, botsMin: 3, botsMax: 6 },
] as const;

export type JackpotTier = (typeof JACKPOT_TIERS)[number];
export type JackpotTierId = JackpotTier["id"];

export function jackpotTierById(id: string | null | undefined) {
  return JACKPOT_TIERS.find((tier) => tier.id === id) ?? JACKPOT_TIERS[0];
}

export function jackpotBotCount(tier: JackpotTier, random: RandomSource) {
  return tier.botsMin + Math.floor(random() * (tier.botsMax - tier.botsMin + 1));
}

export function jackpotBotTargetFen(tier: JackpotTier, random: RandomSource) {
  return Math.round(tier.botMinFen + random() * (tier.botMaxFen - tier.botMinFen));
}

export type ValueCard = { id: number; valueFen: number };

export function coinflipChance(playerFen: number, botFen: number) {
  const pot = playerFen + botFen;
  if (playerFen <= 0 || botFen <= 0) return 0;
  return (playerFen / pot) * JACKPOT_RAKE;
}

export function dealClassStake(
  candidates: readonly ValueCard[],
  tier: JackpotTier,
  random: RandomSource,
) {
  const targetFen = jackpotBotTargetFen(tier, random);
  const pool = candidates.filter((card) => card.valueFen > 0 && card.valueFen <= tier.botMaxFen * 1.15);
  const ids = pickCardsForValue(
    pool.length ? pool : candidates,
    targetFen,
    random,
    tier.id === "street" || tier.id === "club" ? 3 : 5,
  );
  return { ids, targetFen };
}

export function upgraderChance(stakeFen: number, targetFen: number) {
  if (stakeFen <= 0 || targetFen <= 0) return 0;
  return Math.min(UPGRADER_HOUSE, (stakeFen / targetFen) * UPGRADER_HOUSE);
}

export function upgraderTargetFen(stakeFen: number, desiredChance: number) {
  const chance = Math.max(0.01, Math.min(UPGRADER_HOUSE, desiredChance));
  if (stakeFen <= 0) return 0;
  return Math.round((stakeFen * UPGRADER_HOUSE) / chance);
}

export function rankUpgradeTargets(
  candidates: readonly ValueCard[],
  stakeFen: number,
  desiredChance: number,
  limit = 8,
) {
  return candidates
    .map((card) => {
      const chance = upgraderChance(stakeFen, card.valueFen);
      return { ...card, chance, delta: Math.abs(chance - desiredChance) };
    })
    .filter((row) => row.valueFen > stakeFen && row.chance > 0)
    .sort((left, right) => left.delta - right.delta || left.valueFen - right.valueFen || left.id - right.id)
    .slice(0, Math.max(1, limit));
}

export function rollChance(chance: number, random: RandomSource) {
  return random() < Math.max(0, Math.min(1, chance));
}

export function pickCardsForValue(
  candidates: readonly ValueCard[],
  targetFen: number,
  random: RandomSource,
  maxCards = 4,
) {
  if (!candidates.length || targetFen <= 0) return [] as number[];
  const pool = [...candidates];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [pool[index], pool[other]] = [pool[other], pool[index]];
  }
  const picked: number[] = [];
  let sum = 0;
  for (const card of pool) {
    if (picked.length >= maxCards) break;
    if (sum >= targetFen * 0.85 && picked.length >= 1) break;
    if (sum + card.valueFen > targetFen * 2.2 && picked.length >= 1) continue;
    picked.push(card.id);
    sum += card.valueFen;
  }
  if (picked.length) return picked;
  const closest = candidates.reduce((best, card) => (
    Math.abs(card.valueFen - targetFen) < Math.abs(best.valueFen - targetFen) ? card : best
  ));
  return [closest.id];
}
