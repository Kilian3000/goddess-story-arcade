import { shouldGodPack } from "./arcade-flavor.ts";
import type { Card } from "./card-types.ts";
import {
  applyHitSlotBonus,
  applyTenPackBonus,
  createCollationState,
  drawPackRarities,
  isCollationStateValid,
  rarityTier,
  secureRandom,
  type CollationState,
  type PackConfig,
  type PackRecipe,
  type RandomSource,
} from "./gacha-engine.ts";

export function collationKey(setName: string) {
  return `goddess-gacha-collation-${setName}-v3`;
}

export function openedKey(setName: string) {
  return `goddess-gacha-opened-${setName}-v3`;
}

export function chooseUniqueCard(pool: Card[], used: Set<number>, random: RandomSource = secureRandom) {
  const available = pool.filter((card) => !used.has(card.id));
  if (!available.length) return null;
  const card = available[Math.floor(random() * available.length)];
  used.add(card.id);
  return card;
}

export function poolForRarity(
  allCards: Card[],
  catalog: PackConfig[],
  config: PackConfig,
  rarity: string,
) {
  let pool = allCards.filter((card) => card.set_name === config.setName && card.rarity === rarity);
  if (rarity === "R" && config.group === "1 юань") {
    const oneYuan = catalog.filter((item) => item.group === "1 юань");
    const index = oneYuan.findIndex((item) => item.setName === config.setName);
    const previous = index > 0 ? oneYuan[index - 1] : null;
    if (previous) {
      pool = pool.concat(allCards.filter((card) => card.set_name === previous.setName && card.rarity === "R"));
    }
  }
  return pool;
}

export function readCollation(config: PackConfig, recipe: PackRecipe, random: RandomSource = secureRandom) {
  try {
    const raw = window.localStorage.getItem(collationKey(config.setName));
    const saved: unknown = raw ? JSON.parse(raw) : null;
    if (isCollationStateValid(saved, config, recipe)) return saved;
  } catch {
    // Invalid local state starts a fresh hidden box.
  }
  return createCollationState(config, recipe, 1, random);
}

export function writeCollation(config: PackConfig, state: CollationState) {
  window.localStorage.setItem(collationKey(config.setName), JSON.stringify(state));
}

export function readOpenedCount(setName: string) {
  try {
    return Number(window.localStorage.getItem(openedKey(setName)) || 0) || 0;
  } catch {
    return 0;
  }
}

export function writeOpenedCount(setName: string, count: number) {
  window.localStorage.setItem(openedKey(setName), String(count));
}

export type BoxMeterLane = {
  id: string;
  remaining: number;
  highRemaining: number;
};

export function boxMeter(config: PackConfig, recipe: PackRecipe, state: CollationState) {
  const remainingPacks = Math.max(0, config.boostersCount - state.packIndex);
  const lanes: BoxMeterLane[] = recipe.lanes.map((definition) => {
    const deck = state.laneDecks[definition.id] || [];
    const start = state.packIndex * definition.slotsPerPack;
    const leftover = deck.slice(start);
    return {
      id: definition.id,
      remaining: leftover.length,
      highRemaining: leftover.filter((rarity) => rarityTier(rarity) >= 3).length,
    };
  });
  return {
    boxNumber: state.boxNumber,
    packIndex: state.packIndex,
    boostersCount: config.boostersCount,
    remainingPacks,
    lanes,
    highRemaining: lanes.reduce((sum, lane) => sum + lane.highRemaining, 0),
  };
}

export type RevealMark = {
  isNew: boolean;
  copies: number;
  chase: boolean;
};

export function revealMarks(
  cards: Card[],
  before: Record<string, number>,
  chaseCardIds: readonly number[],
) {
  const seen = { ...before };
  const chase = new Set(chaseCardIds);
  return cards.map((card): RevealMark => {
    const key = String(card.id);
    const prev = seen[key] || 0;
    seen[key] = prev + 1;
    return { isNew: prev === 0, copies: prev + 1, chase: chase.has(card.id) };
  });
}

export type DrawFilledPacksInput = {
  config: PackConfig;
  recipe: PackRecipe;
  getPool: (rarity: string) => Card[];
  count: number;
  collation: CollationState;
  tenPackBonus?: boolean;
  pityCount?: number;
  pityArm?: number;
  allowGodPack?: boolean;
  random?: RandomSource;
};

export type DrawFilledPacksOk = {
  ok: true;
  packs: Card[][];
  collation: CollationState;
  pityCount: number;
  godPack: boolean;
};

export type DrawFilledPacksErr = {
  ok: false;
  error: string;
};

export function packHasHit(cards: Card[]) {
  return cards.some((card) => rarityTier(card.rarity) >= 3);
}

export function drawFilledPacks(input: DrawFilledPacksInput): DrawFilledPacksOk | DrawFilledPacksErr {
  const random = input.random ?? secureRandom;
  let nextCollation = input.collation;
  let pityCount = input.pityCount ?? 0;
  const batches: Card[][] = [];
  const pityArm = input.pityArm ?? 28;

  for (let packNumber = 0; packNumber < input.count; packNumber += 1) {
    const draw = drawPackRarities(input.config, input.recipe, nextCollation, random);
    const used = new Set<number>();
    const cards: Card[] = [];
    for (const rarity of draw.rarities) {
      const card = chooseUniqueCard(input.getPool(rarity), used, random);
      if (!card) {
        return { ok: false, error: `Für ${rarity} fehlen eindeutige Kartenbilder in ${input.config.setName}.` };
      }
      cards.push(card);
    }
    if (cards.length !== input.config.odds.cardsPerPack) {
      return { ok: false, error: "Die Pack-Kollation konnte nicht vollständig aufgebaut werden." };
    }

    const bonus = input.tenPackBonus && input.count === 10
      ? applyTenPackBonus(draw.rarities, input.recipe, input.count, random)
      : pityCount >= pityArm
        ? applyHitSlotBonus(draw.rarities, input.recipe, random)
        : { rarities: draw.rarities, boostedIndex: null as number | null };

    if (bonus.boostedIndex !== null) {
      const slot = bonus.boostedIndex;
      const others = new Set(cards.filter((_, index) => index !== slot).map((card) => card.id));
      const upgraded = chooseUniqueCard(input.getPool(bonus.rarities[slot]), others, random);
      if (upgraded) cards[slot] = upgraded;
    }

    let god = false;
    if (shouldGodPack(Boolean(input.allowGodPack), input.count, random)) {
      const shine = cards.map((card, index) => {
        if (rarityTier(card.rarity) >= 1) return card;
        const others = new Set(cards.filter((_, slot) => slot !== index).map((item) => item.id));
        const upgraded = chooseUniqueCard(input.getPool("SR").concat(input.getPool("SSR"), input.getPool("SCR")), others, random);
        return upgraded ?? card;
      });
      if (shine.some((card) => rarityTier(card.rarity) >= 1)) {
        cards.splice(0, cards.length, ...shine);
        god = true;
      }
    }

    batches.push(cards);
    nextCollation = draw.state;
    pityCount = packHasHit(cards) ? 0 : pityCount + 1;
    if (god) {
      return { ok: true, packs: batches, collation: nextCollation, pityCount, godPack: true };
    }
  }

  return { ok: true, packs: batches, collation: nextCollation, pityCount, godPack: false };
}

export function drawThrowawayPacks(
  input: Omit<DrawFilledPacksInput, "collation" | "tenPackBonus" | "pityCount" | "pityArm"> & {
    random?: RandomSource;
  },
) {
  const random = input.random ?? secureRandom;
  return drawFilledPacks({
    ...input,
    collation: createCollationState(input.config, input.recipe, 1, random),
    tenPackBonus: false,
    pityCount: 0,
    random,
  });
}
