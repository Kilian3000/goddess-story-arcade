"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  CARD_VALUES_URL,
  RARITY_VALUES_URL,
  addCardsToCollection,
  applyTopup,
  cardValueFen,
  craftCard,
  creditFen,
  economyFromSnapshot,
  emptyPriceTable,
  finalizeFreePack,
  finalizeOpenedPack,
  finalizeOpenedPacks,
  grantVoucher,
  parseCardValuesCsv,
  parseRarityValues,
  readEconomySnapshot,
  removeCards,
  sellCard,
  sellCards,
  spendFen,
  subscribeEconomy,
  tradeExcess,
  writeStoredEconomy,
  type CraftLookup,
  type PriceTable,
  type RarityLookup,
} from "./economy";

export function useEconomy() {
  const raw = useSyncExternalStore(subscribeEconomy, readEconomySnapshot, () => "");
  const state = economyFromSnapshot(raw);
  const [prices, setPrices] = useState<PriceTable>(emptyPriceTable);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(RARITY_VALUES_URL).then((response) => {
        if (!response.ok) throw new Error("rarity-values");
        return response.json();
      }).catch(() => ({})),
      fetch(CARD_VALUES_URL).then((response) => {
        if (!response.ok) throw new Error("card-values");
        return response.text();
      }).catch(() => ""),
    ]).then(([rarityRaw, csv]) => {
      if (cancelled) return;
      const rarity = parseRarityValues(rarityRaw);
      setPrices({
        byId: csv ? parseCardValuesCsv(csv) : new Map(),
        rarityYuan: rarity.rarityYuan,
        fallbackYuan: rarity.fallbackYuan,
      });
    });
    return () => { cancelled = true; };
  }, []);

  const valueFen = useCallback((cardId: number, rarity: string) => (
    cardValueFen(cardId, rarity, prices)
  ), [prices]);

  const openPack = useCallback((costYuan: number, cardIds: number[]) => {
    const result = finalizeOpenedPack(economyFromSnapshot(readEconomySnapshot()), costYuan, cardIds);
    if (result.ok) writeStoredEconomy(result.state);
    return result;
  }, []);

  const openPacks = useCallback((costYuan: number, packs: number[][]) => {
    const result = finalizeOpenedPacks(economyFromSnapshot(readEconomySnapshot()), costYuan, packs);
    if (result.ok) writeStoredEconomy(result.state);
    return result;
  }, []);

  const sell = useCallback((cardId: number, value: number) => {
    const result = sellCard(economyFromSnapshot(readEconomySnapshot()), cardId, value);
    if (!result.ok) return false;
    writeStoredEconomy(result.state);
    return true;
  }, []);

  const sellMany = useCallback((items: { cardId: number; valueFen: number }[]) => {
    const result = sellCards(economyFromSnapshot(readEconomySnapshot()), items);
    if (!result.ok) return 0;
    writeStoredEconomy(result.state);
    return result.sold;
  }, []);

  const openFreePack = useCallback((cardIds: number[]) => {
    const result = finalizeFreePack(economyFromSnapshot(readEconomySnapshot()), cardIds);
    if (result.ok) writeStoredEconomy(result.state);
    return result;
  }, []);

  const craft = useCallback((target: { id: number; rarity: string; set_name: string }, lookup: CraftLookup) => {
    const result = craftCard(economyFromSnapshot(readEconomySnapshot()), target, lookup);
    if (!result.ok) return result;
    writeStoredEconomy(result.state);
    return result;
  }, []);

  const trade = useCallback((rarity: "R" | "SR", rarityOf: RarityLookup) => {
    const result = tradeExcess(economyFromSnapshot(readEconomySnapshot()), rarityOf, rarity);
    if (!result.ok) return false;
    writeStoredEconomy(result.state);
    return true;
  }, []);

  const creditTopup = useCallback((yuan: number) => {
    writeStoredEconomy(applyTopup(economyFromSnapshot(readEconomySnapshot()), yuan));
  }, []);

  const addVoucher = useCallback((cost: 1 | 2) => {
    writeStoredEconomy(grantVoucher(economyFromSnapshot(readEconomySnapshot()), cost));
  }, []);

  const spend = useCallback((fen: number) => {
    const result = spendFen(economyFromSnapshot(readEconomySnapshot()), fen);
    if (!result.ok) return false;
    writeStoredEconomy(result.state);
    return true;
  }, []);

  const credit = useCallback((fen: number) => {
    const result = creditFen(economyFromSnapshot(readEconomySnapshot()), fen);
    if (!result.ok) return false;
    writeStoredEconomy(result.state);
    return true;
  }, []);

  const takeCards = useCallback((cardIds: number[]) => {
    const result = removeCards(economyFromSnapshot(readEconomySnapshot()), cardIds);
    if (!result.ok) return false;
    writeStoredEconomy(result.state);
    return true;
  }, []);

  const grantCards = useCallback((cardIds: number[]) => {
    if (!cardIds.length) return;
    writeStoredEconomy(addCardsToCollection(economyFromSnapshot(readEconomySnapshot()), cardIds));
  }, []);

  return {
    state,
    prices,
    valueFen,
    openPack,
    openPacks,
    sell,
    sellMany,
    openFreePack,
    craft,
    trade,
    creditTopup,
    addVoucher,
    spend,
    credit,
    takeCards,
    grantCards,
  };
}
