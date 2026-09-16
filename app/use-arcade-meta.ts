"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  MAX_SHRINE,
  addYearbookPage,
  bumpGodPacks,
  bumpOshiNews,
  bumpSessionOpens,
  bumpSkillClaim,
  canDailyPack,
  canOmikuji,
  dailyRemainingMs,
  hasDetectiveGuess,
  hasSkillClaim,
  lightCandle,
  markDailyPack,
  markDetectiveGuess,
  markOmikuji,
  markSetClear,
  markSkillClaim,
  metaFromSnapshot,
  placeOnShrine,
  placeReverseBoard,
  rainFen,
  readGhostBreak,
  readMetaSnapshot,
  readSessionOpens,
  readSessionStamps,
  readStoredMeta,
  recordPulls,
  removeFromShrine,
  setNightOffer,
  setOshi,
  shouldRain,
  spendWonder,
  stampGroup,
  subscribeArcadeMeta,
  toggleChase,
  unlockAchievement,
  writeGhostBreak,
  writeStoredMeta,
  type AchievementId,
  type ArcadeMeta,
  type NightOffer,
  type PullRecord,
} from "./arcade-meta";
import { isMidnight } from "./arcade-flavor";

function mutate(fn: (meta: ArcadeMeta) => ArcadeMeta) {
  const next = fn(readStoredMeta());
  writeStoredMeta(next);
  return next;
}

export function useArcadeMeta() {
  const raw = useSyncExternalStore(subscribeArcadeMeta, readMetaSnapshot, () => "");
  const meta = metaFromSnapshot(raw);

  const commit = useCallback((next: ArcadeMeta) => {
    writeStoredMeta(next);
    return next;
  }, []);

  return {
    meta,
    chaseCardIds: meta.chaseCardIds,
    shrineCardIds: meta.shrineCardIds,
    pulls: meta.pulls,
    pityBySet: meta.pityBySet,
    achievements: meta.achievements,
    setClears: meta.setClears,
    toggleChase: (cardId: number) => mutate((current) => toggleChase(current, cardId)),
    placeOnShrine: (cardId: number) => mutate((current) => {
      const next = placeOnShrine(current, cardId);
      return next.shrineCardIds.length >= MAX_SHRINE ? unlockAchievement(next, "shrine-full") : next;
    }),
    removeFromShrine: (cardId: number) => mutate((current) => removeFromShrine(current, cardId)),
    recordPulls: (pulls: Omit<PullRecord, "id">[], pityBySet: Record<string, number>) => (
      mutate((current) => recordPulls(current, pulls, pityBySet))
    ),
    canDailyPack: (now = Date.now()) => canDailyPack(meta, now),
    dailyRemainingMs: (now = Date.now()) => dailyRemainingMs(meta, now),
    markDailyPack: (now = Date.now()) => mutate((current) => markDailyPack(current, now)),
    canOmikuji: (now = Date.now()) => canOmikuji(meta, now),
    markOmikuji: (id: string, now = Date.now()) => mutate((current) => markOmikuji(current, id, now)),
    hasSkillClaim: (gameId: string, now = Date.now()) => hasSkillClaim(meta, gameId, now),
    markSkillClaim: (gameId: string, now = Date.now()) => mutate((current) => markSkillClaim(current, gameId, now)),
    bumpSkillClaim: (gameId: string, now = Date.now()) => mutate((current) => bumpSkillClaim(current, gameId, now)),
    spendWonder: (pullId: string, now = Date.now()) => {
      const result = spendWonder(readStoredMeta(), pullId, now);
      if (result.ok) commit(result.state);
      return result;
    },
    unlockAchievement: (id: AchievementId) => mutate((current) => unlockAchievement(current, id)),
    markSetClear: (setName: string) => {
      const current = readStoredMeta();
      const result = markSetClear(current, setName);
      if (result.ok) commit(result.state);
      return result;
    },
    lightCandle: (now = Date.now()) => mutate((current) => unlockAchievement(lightCandle(current, now), "candle-lit")),
    setOshi: (character: string | null) => mutate((current) => setOshi(current, character)),
    bumpOshiNews: (character: string) => {
      const result = bumpOshiNews(readStoredMeta(), character);
      if (result.hit) commit(result.state);
      return result;
    },
    bumpGodPacks: () => mutate((current) => unlockAchievement(bumpGodPacks(current), "god-pack")),
    placeReverseBoard: (cardIds: number[], setName: string) => {
      const result = placeReverseBoard(readStoredMeta(), cardIds, setName);
      if (result.ok) commit(result.state);
      return result;
    },
    addYearbook: (character: string, firstNewId: number) => {
      const result = addYearbookPage(readStoredMeta(), character, firstNewId);
      if (result.ok) commit(unlockAchievement(result.state, "yearbook"));
      return result;
    },
    setNightOffer: (offer: NightOffer | null) => mutate((current) => setNightOffer(current, offer)),
    hasDetectiveGuess: (setName: string, boxNumber: number) => hasDetectiveGuess(meta, setName, boxNumber),
    markDetectiveGuess: (setName: string, boxNumber: number) => mutate((current) => markDetectiveGuess(current, setName, boxNumber)),
    stampGroup: (group: string) => stampGroup(group),
    sessionStamps: () => readSessionStamps(),
    ghostOn: () => readGhostBreak(),
    setGhost: (on: boolean) => writeGhostBreak(on),
    bumpSession: () => bumpSessionOpens(),
    sessionOpens: () => readSessionOpens(),
    rollRain: (opens: number, hit: boolean, now = Date.now(), random = Math.random) => (
      isMidnight(now) || shouldRain(opens, hit) ? rainFen(random) : 0
    ),
  };
}
