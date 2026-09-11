"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  CARD_VALUES_URL,
  RARITY_VALUES_URL,
  addCardsToCollection,
  applyTopup,
  cardValueFen,
  creditFen,
  economyFromSnapshot,
  emptyPriceTable,
  finalizeOpenedPack,
  parseCardValuesCsv,
  parseRarityValues,
  readEconomySnapshot,
  removeCards,
  sellCard,
  spendFen,
  subscribeEconomy,
  tradeExcess,
  writeStoredEconomy,
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

  const sell = useCallback((cardId: number, value: number) => {
    const result = sellCard(economyFromSnapshot(readEconomySnapshot()), cardId, value);
    if (!result.ok) return false;
    writeStoredEconomy(result.state);
    return true;
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
    sell,
    trade,
    creditTopup,
    spend,
    credit,
    takeCards,
    grantCards,
  };
}
