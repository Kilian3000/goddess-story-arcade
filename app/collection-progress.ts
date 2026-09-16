import type { Card } from "./card-types.ts";
import { CRAFT_RULES, craftRuleForTarget } from "./economy.ts";

export type SetProgress = {
  setName: string;
  group: string;
  total: number;
  unique: number;
  minCopies: number;
  complete: boolean;
  title: "Hunting" | "Owned" | "Bound" | "Master";
};

export function ownedCount(owned: Record<string, number>, cardId: number) {
  return owned[String(cardId)] || 0;
}

export function setProgress(
  allCards: Card[],
  owned: Record<string, number>,
  setName: string,
  group = "",
): SetProgress {
  const slots = allCards.filter((card) => card.set_name === setName);
  const unique = slots.filter((card) => ownedCount(owned, card.id) > 0).length;
  const minCopies = slots.length ? Math.min(...slots.map((card) => ownedCount(owned, card.id))) : 0;
  const complete = slots.length > 0 && unique === slots.length;
  const title = minCopies >= 3 ? "Master" : minCopies >= 2 ? "Bound" : complete ? "Owned" : "Hunting";
  return { setName, group, total: slots.length, unique, minCopies, complete, title };
}

export function allSetProgress(allCards: Card[], owned: Record<string, number>, groupOf: (setName: string) => string) {
  const names = [...new Set(allCards.map((card) => card.set_name))].sort();
  return names.map((name) => setProgress(allCards, owned, name, groupOf(name)));
}

export type CharacterProgress = {
  character: string;
  total: number;
  unique: number;
  cards: Card[];
};

export function characterProgress(allCards: Card[], owned: Record<string, number>): CharacterProgress[] {
  const map = new Map<string, Card[]>();
  for (const card of allCards) {
    const name = card.character || "Unknown";
    const list = map.get(name) || [];
    list.push(card);
    map.set(name, list);
  }
  return [...map.entries()]
    .map(([character, cards]) => ({
      character,
      total: cards.length,
      unique: cards.filter((card) => ownedCount(owned, card.id) > 0).length,
      cards,
    }))
    .sort((left, right) => right.unique - left.unique || left.character.localeCompare(right.character));
}

export function newlyCompletedCharacters(
  allCards: Card[],
  owned: Record<string, number>,
  already: readonly string[],
) {
  const known = new Set(already);
  return characterProgress(allCards, owned)
    .filter((row) => row.total > 0 && row.unique === row.total && !known.has(row.character))
    .map((row) => row.character);
}

export function excessCardIds(
  owned: Record<string, number>,
  rarityOf: (id: number) => string | undefined,
  rarity: string,
  need: number,
) {
  const ids: number[] = [];
  for (const [id, count] of Object.entries(owned)) {
    if (rarityOf(Number(id)) !== rarity) continue;
    const extra = Math.max(0, count - 1);
    for (let copy = 0; copy < extra && ids.length < need; copy += 1) ids.push(Number(id));
  }
  return ids;
}

export function makeNightOffer(
  allCards: Card[],
  owned: Record<string, number>,
  now = Date.now(),
) {
  const missing = allCards.filter((card) => ownedCount(owned, card.id) === 0);
  for (const target of missing) {
    const ruleId = craftRuleForTarget(target.rarity);
    if (!ruleId) continue;
    const rule = CRAFT_RULES[ruleId];
    const payIds: number[] = [];
    const fuel = allCards
      .filter((card) => (
        card.set_name === target.set_name
        && card.rarity === rule.from
        && card.id !== target.id
        && ownedCount(owned, card.id) > 1
      ))
      .sort((left, right) => ownedCount(owned, right.id) - ownedCount(owned, left.id) || left.id - right.id);
    for (const card of fuel) {
      const extra = ownedCount(owned, card.id) - 1;
      for (let copy = 0; copy < extra && payIds.length < rule.excess; copy += 1) payIds.push(card.id);
    }
    if (payIds.length >= rule.excess) {
      return { setName: target.set_name, targetId: target.id, payIds: payIds.slice(0, rule.excess), createdAt: now };
    }
  }
  return null;
}

export function newlyCompletedSets(
  allCards: Card[],
  owned: Record<string, number>,
  already: readonly string[],
) {
  const cleared = new Set(already);
  const names = [...new Set(allCards.map((card) => card.set_name))];
  return names.filter((name) => {
    const progress = setProgress(allCards, owned, name);
    return progress.complete && !cleared.has(name);
  });
}
