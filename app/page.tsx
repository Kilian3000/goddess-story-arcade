"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  compilePackRecipe,
  rarityTier,
  recipeRarityTargets,
  type CollationState,
  type PackConfig,
} from "./gacha-engine";
import {
  boxMeter,
  drawFilledPacks,
  poolForRarity,
  readCollation,
  readOpenedCount,
  revealMarks,
  writeCollation,
  writeOpenedCount,
  type RevealMark,
} from "./pack-draw";
import {
  DETECTIVE_PAY_FEN,
  detectiveBucket,
  ghostLine,
  isMidnight,
  omikujiById,
  oshiLetter,
  rollOmikuji,
  weighPack,
} from "./arcade-flavor";
import { newlyCompletedCharacters, newlyCompletedSets } from "./collection-progress";
import { PITY_ARM, pityState, rainFen, skillConsolationFen } from "./arcade-meta";
import { arcadeConfig, cardAsset } from "./arcade-config";
import { groupClass, groupLabels, rarityColor } from "./arcade-ui";
import type { Card } from "./card-types";
import {
  canOpenPacks,
  clearPendingTopup,
  formatYuan,
  readPendingSnapshot,
  readPendingTopup,
  readPrizeLock,
  readPrizeSnapshot,
  subscribePendingTopup,
  subscribePrizeLock,
  voucherForCost,
  writePrizeLock,
  yuanToFen,
} from "./economy";
import { packHaptic } from "./pack-gestures";
import { PackStack } from "./pack-stack";
import { boosterShine } from "./pack-presentation";
import { SellButton } from "./sell-button";
import { PackOpening } from "./pack-opening";
import { PackCarousel } from "./pack-carousel";
import { PackSummaryBulk } from "./pack-summary-bulk";
import { type WaifuMuse } from "./lucky-shrine";
import { MinigameHub } from "./minigames/minigame-hub";
import {
  DEFAULT_MINIGAME,
  minigameById,
  playSnapshot,
  subscribePlayParam,
  writePlayParam,
  type MinigameId,
} from "./minigames/registry";
import { useCardCatalog } from "./use-card-catalog";
import { useArcadeMeta } from "./use-arcade-meta";
import { useEconomy } from "./use-economy";
import { useGachaAudio } from "./use-gacha-audio";
import { AppIcon } from "./ui-icons";
import { WalletChip } from "./wallet-chip";

type Phase = "sealed" | "opening" | "revealing" | "summary";
type ExperienceMode = "altar" | "games";
const shrineDealerCards: WaifuMuse[] = [
  { character: "Jolyne Kujo", rarity: "ZR", setName: "NS-05-M06", attitude: "confident", duelTier: 5, image: cardAsset("images/cards/NS-05-M06/ZR-008.webp") },
  { character: "Makima", rarity: "MR", setName: "NS-10-M03", attitude: "dominant", duelTier: 10, image: cardAsset("images/cards/NS-10-M03/MR-027.webp") },
  { character: "Boa Hancock", rarity: "SSR", setName: "NS-05-M01", attitude: "dominant", duelTier: 10, image: cardAsset("images/cards/NS-05-M01/SSR-060.webp") },
  { character: "Kafka", rarity: "XR", setName: "NS-05-M09", attitude: "dominant", duelTier: 10, image: cardAsset("images/cards/NS-05-M09/XR-005.webp") },
  { character: "Yae Miko", rarity: "XR", setName: "NS-05-M05", attitude: "confident", duelTier: 5, image: cardAsset("images/cards/NS-05-M05/XR-114.webp") },
  { character: "Ningguang", rarity: "XR", setName: "NS-05-M07", attitude: "confident", duelTier: 2, image: cardAsset("images/cards/NS-05-M07/XR-001.webp") },
  { character: "New Jersey", rarity: "XR", setName: "NS-05-M06", attitude: "confident", duelTier: 5, image: cardAsset("images/cards/NS-05-M06/XR-117.webp") },
  { character: "Yelan", rarity: "SZR", setName: "NS-05-M08", attitude: "confident", duelTier: 2, image: cardAsset("images/cards/NS-05-M08/SZR-002.webp") },
  { character: "Nami", rarity: "SSR", setName: "NS-07", attitude: "confident", duelTier: 2, image: cardAsset("images/cards/NS-07/SSR-017.webp") },
  { character: "Ada Wong", rarity: "SSR", setName: "NS-02-M02", attitude: "confident", duelTier: 5, image: cardAsset("images/cards/NS-02-M02/SSR-028.webp") },
  { character: "Nico Robin", rarity: "SSR", setName: "NNS-01", attitude: "timid", duelTier: 1, image: cardAsset("images/cards/NNS-01/SSR-010.webp") },
  { character: "Tsunade", rarity: "PTR", setName: "NS-05-M03", attitude: "dominant", duelTier: 10, image: cardAsset("images/cards/NS-05-M03/PTR-042.webp") },
  { character: "Bayonetta", rarity: "SSR", setName: "NS-02-M02", attitude: "confident", duelTier: 5, image: cardAsset("images/cards/NS-02-M02/SSR-029.webp") },
  { character: "Chun-Li", rarity: "LR", setName: "SYJH-2M01", attitude: "confident", duelTier: 2, image: cardAsset("images/cards/SYJH-2M01/LR-03.webp") },
  { character: "Esdeath", rarity: "SSR", setName: "NS-02-M08", attitude: "dominant", duelTier: 10, image: cardAsset("images/cards/NS-02-M08/SSR-004.webp") },
  { character: "Yor Forger", rarity: "SCR", setName: "NS-11", attitude: "timid", duelTier: 1, image: cardAsset("images/cards/NS-11/SCR-003.webp") },
  { character: "Raiden Shogun", rarity: "GP", setName: "NNS-02", attitude: "dominant", duelTier: 10, image: cardAsset("images/cards/NNS-02/GP-006.webp") },
  { character: "Shenhe", rarity: "SZR", setName: "NS-05-M08", attitude: "timid", duelTier: 1, image: cardAsset("images/cards/NS-05-M08/SZR-005.webp") },
  { character: "Mai Shiranui", rarity: "PTR", setName: "NS-02-M02", attitude: "confident", duelTier: 2, image: cardAsset("images/cards/NS-02-M02/PTR-002.webp") },
  { character: "Himeko", rarity: "PTR", setName: "NS-02-M10", attitude: "timid", duelTier: 1, image: cardAsset("images/cards/NS-02-M10/PTR-009.webp") },
  { character: "Tifa Lockhart", rarity: "LR", setName: "SYJH-2M01", attitude: "timid", duelTier: 1, image: cardAsset("images/cards/SYJH-2M01/LR-09.webp") },
  { character: "2B", rarity: "LR", setName: "SYJH-2M01", attitude: "timid", duelTier: 1, image: cardAsset("images/cards/SYJH-2M01/LR-04.webp") },
  { character: "Black Swan", rarity: "XR", setName: "NS-05-M09", attitude: "confident", duelTier: 5, image: cardAsset("images/cards/NS-05-M09/XR-002.webp") },
  { character: "Lisa", rarity: "SSR", setName: "NS-09", attitude: "confident", duelTier: 2, image: cardAsset("images/cards/NS-09/SSR-009.webp") },
];

function cardImage(card: Card) { return cardAsset(card.image_path); }

async function preloadCards(cards: Card[]) {
  await Promise.allSettled(cards.map((card) => new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    image.onload = finish;
    image.onerror = finish;
    image.src = cardImage(card);
    if (image.complete) finish();
    window.setTimeout(finish, 2200);
  })));
}

export default function Home() {
  const { allCards, sets, catalog, dbStatus, catalogStatus, catalogReady } = useCardCatalog();
  const { state: economy, valueFen, openPacks: chargeOpenedPacks, openFreePack, sell, sellMany, credit, creditTopup, addVoucher } = useEconomy();
  const arcade = useArcadeMeta();
  const pendingRaw = useSyncExternalStore(subscribePendingTopup, readPendingSnapshot, () => "");
  const prizeRaw = useSyncExternalStore(subscribePrizeLock, readPrizeSnapshot, () => "");
  const pendingTopup = pendingRaw ? readPendingTopup() : null;
  const prizeRecord = prizeRaw ? readPrizeLock() : null;
  const [pickedPack, setPickedPack] = useState<PackConfig | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [collation, setCollation] = useState<CollationState | null>(null);
  const [opened, setOpened] = useState(0);
  const [pack, setPack] = useState<Card[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealedThrough, setRevealedThrough] = useState(-1);
  const [phase, setPhase] = useState<Phase>("sealed");
  const [packChosen, setPackChosen] = useState(false);
  const [packCount, setPackCount] = useState<1 | 10>(1);
  const playFromUrl = useSyncExternalStore(subscribePlayParam, playSnapshot, () => "");
  const activeGame = minigameById(playFromUrl)?.id ?? DEFAULT_MINIGAME;
  const mode: ExperienceMode = prizeRecord ? "altar" : playFromUrl ? "games" : "altar";
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("goddess-music-mode", { detail: isMidnight() ? "midnight" : mode }));
  }, [mode]);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorFromSummary, setInspectorFromSummary] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [transitioning, setTransitioning] = useState(false);
  const [freshIndex, setFreshIndex] = useState(-1);
  const [hitNonce, setHitNonce] = useState(0);
  const soldGuard = useRef<{ pack: Card[]; indexes: Set<number> }>({ pack: [], indexes: new Set() });
  const [soldIndexes, setSoldIndexes] = useState<Set<number>>(() => new Set());
  const [summaryPicked, setSummaryPicked] = useState<number[]>([]);
  const [pullMarks, setPullMarks] = useState<RevealMark[]>([]);
  const [rainBurst, setRainBurst] = useState(0);
  const [metaToast, setMetaToast] = useState("");
  const [weigh, setWeigh] = useState(() => weighPack());
  const [ghostText, setGhostText] = useState("");
  const [godPackHit, setGodPackHit] = useState(false);
  const [walletAnimating, setWalletAnimating] = useState(false);
  const [walletFromFen, setWalletFromFen] = useState(0);
  const sequence = useRef(0);
  const inputLock = useRef(false);
  const revealedRef = useRef(-1);
  const navigationTimer = useRef<number | null>(null);
  const experienceRef = useRef<HTMLDivElement | null>(null);
  const {
    muted,
    musicEnabled,
    toggleMuted,
    toggleMusic,
    startMusic,
    playFoil,
    playTear,
    playCardTravel,
    playPeek,
    playReveal,
    playShrineDrop,
    playShrineBounce,
    playShrineWin,
    playDuelLock,
    playUiTap,
    playDuelStart,
    playDuelLoss,
    playSummary,
  } = useGachaAudio();

  const fallbackPack = useMemo(
    () => catalog.find((item) => item.setName === "NS-02-M16") || catalog[0] || null,
    [catalog],
  );
  const prizeLock = prizeRecord ? catalog.find((item) => item.id === prizeRecord.packId) || null : null;
  const isDailyLock = prizeRecord?.kind === "daily";
  const prizeReturnMode = prizeRecord?.returnMode ?? DEFAULT_MINIGAME;
  const prizeReturnTitle = isDailyLock ? "DAILY" : minigameById(prizeReturnMode)?.title ?? "MINIGAMES";
  const setParam = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("popstate", onChange);
      return () => window.removeEventListener("popstate", onChange);
    },
    () => new URLSearchParams(window.location.search).get("set") || "",
    () => "",
  );
  const urlPack = catalog.find((pack) => pack.setName === setParam) || null;
  const selectedPack = prizeLock ?? pickedPack ?? urlPack ?? fallbackPack;
  const activeGroup = groupFilter ?? selectedPack?.group ?? "2 юаня";

  useEffect(() => () => {
    if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current);
  }, []);

  const availableRarities = useMemo(() => new Set(
    allCards.filter((card) => card.set_name === selectedPack?.setName).map((card) => card.rarity),
  ), [allCards, selectedPack]);

  const recipe = useMemo(() => (
    selectedPack && availableRarities.size ? compilePackRecipe(selectedPack, availableRarities) : null
  ), [availableRarities, selectedPack]);

  useEffect(() => {
    if (!selectedPack || !recipe) return;
    sequence.current += 1;
    const sync = window.setTimeout(() => {
      setCollation(readCollation(selectedPack, recipe));
      setOpened(readOpenedCount(selectedPack.setName));
      setPack([]);
      setActiveIndex(0);
      setRevealedThrough(-1);
      setFreshIndex(-1);
      revealedRef.current = -1;
      setDirection(1);
      setTransitioning(false);
      inputLock.current = false;
      setPhase("sealed");
      setPackChosen(false);
      setInspectorOpen(false);
      setGenerationError("");
      setSoldIndexes(new Set());
      setSummaryPicked([]);
      setPullMarks([]);
      setWeigh(weighPack());
      setGhostText("");
      setGodPackHit(false);
    }, 0);
    return () => window.clearTimeout(sync);
  }, [recipe, selectedPack]);

  useEffect(() => {
    if (!metaToast) return;
    const timer = window.setTimeout(() => setMetaToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [metaToast]);

  const active = pack[activeIndex];
  const dataReady = catalogReady && Boolean(selectedPack && recipe && collation);
  const canAfford = selectedPack
    ? isDailyLock || canOpenPacks(economy, selectedPack.cost, packCount)
    : false;
  const usingVoucher = selectedPack ? Boolean(voucherForCost(selectedPack.cost) && economy.vouchers[voucherForCost(selectedPack.cost)!] > 0) : false;
  const packValueFen = pack.reduce((sum, card) => sum + valueFen(card.id, card.rarity), 0);
  const packCostFen = (selectedPack?.cost ?? 0) * 100 * packCount;
  const packNetFen = packValueFen - packCostFen;
  const bestPull = pack.length
    ? pack.reduce((best, card) => rarityTier(card.rarity) > rarityTier(best.rarity) ? card : best)
    : null;
  const canChangeSet = mode === "altar" && (phase === "sealed" || phase === "summary") && (!prizeLock || isDailyLock);
  const palette = groupClass(selectedPack?.group);
  const groupOptions = [...new Set(catalog.map((item) => item.group))];
  const shrineMuse = shrineDealerCards[0];
  const packMuse = shrineDealerCards[(selectedPack?.id || 0) % shrineDealerCards.length] || shrineMuse;

  const getPool = useCallback((rarity: string) => {
    if (!selectedPack) return [];
    return poolForRarity(allCards, catalog, selectedPack, rarity);
  }, [allCards, catalog, selectedPack]);

  const navigateCard = useCallback((index: number) => {
    if (!pack[index] || inputLock.current || index === activeIndex) return;
    const nextDirection: 1 | -1 = index > activeIndex ? 1 : -1;
    const fresh = index > revealedRef.current;
    const tier = rarityTier(pack[index].rarity);
    inputLock.current = true;

    if (fresh) {
      revealedRef.current = index;
    }
    if (fresh) {
      void playReveal(pack[index].rarity);
      if (pullMarks[index]?.chase) void playShrineWin(selectedPack?.cost || 1);
    } else void playCardTravel();
    packHaptic(fresh ? tier : 0);
    flushSync(() => {
      setDirection(nextDirection);
      setTransitioning(true);
      setInspectorOpen(false);
      setActiveIndex(index);
      if (fresh) {
        setRevealedThrough(index);
        setFreshIndex(index);
        setHitNonce((value) => value + 1);
      } else {
        setFreshIndex(-1);
      }
    });
    // Animation must not discard the next touch while it finishes.
    inputLock.current = false;
    if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current);
    navigationTimer.current = window.setTimeout(() => {
      setTransitioning(false);
      navigationTimer.current = null;
    }, 230);
  }, [activeIndex, pack, playCardTravel, playReveal, playShrineWin, pullMarks, selectedPack]);

  const nextCard = useCallback(() => {
    if (inputLock.current) return;
    if (activeIndex >= pack.length - 1) {
      const highest = pack.reduce((value, card) => Math.max(value, rarityTier(card.rarity)), 0);
      void playSummary(highest);
      setInspectorOpen(false);
      setPhase("summary");
      return;
    }
    navigateCard(activeIndex + 1);
  }, [activeIndex, navigateCard, pack, playSummary]);

  useEffect(() => {
    if (phase !== "summary") return;
    const frame = window.requestAnimationFrame(() => experienceRef.current?.scrollTo({ top: 0, left: 0 }));
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  const previousCard = useCallback(() => {
    if (activeIndex > 0) navigateCard(activeIndex - 1);
  }, [activeIndex, navigateCard]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (inspectorOpen) { setInspectorOpen(false); if (inspectorFromSummary) setPhase("summary"); }
        else if (showInfo) setShowInfo(false);
        else if (showMenu) setShowMenu(false);
        return;
      }
      if (phase !== "revealing" || inspectorOpen) return;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") nextCard();
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") previousCard();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectorOpen, inspectorFromSummary, nextCard, phase, previousCard, showInfo, showMenu]);

  const openPack = useCallback(async () => {
    if (!selectedPack || !recipe || !collation || !dataReady || !packChosen || phase !== "sealed" || mode !== "altar" || inputLock.current) return;
    const openingCount = isDailyLock ? 1 : packCount;
    if (!isDailyLock && !canOpenPacks(economy, selectedPack.cost, openingCount)) {
      setGenerationError("Nicht genug Yuan für diesen Booster.");
      return;
    }
    void startMusic();
    setGenerationError("");
    const token = ++sequence.current;
    const drawn = drawFilledPacks({
      config: selectedPack,
      recipe,
      getPool,
      count: openingCount,
      collation,
      tenPackBonus: !isDailyLock,
      pityCount: arcade.pityBySet[selectedPack.setName] || 0,
      pityArm: PITY_ARM,
      allowGodPack: !isDailyLock && !prizeLock && openingCount === 1,
    });
    if (!drawn.ok) {
      setGenerationError(drawn.error);
      return;
    }
    const batches = drawn.packs;
    const result = batches.flat();
    const before = { ...economy.cards };
    const charged = isDailyLock
      ? openFreePack(result.map((card) => card.id))
      : chargeOpenedPacks(selectedPack.cost, batches.map((cards) => cards.map((card) => card.id)));
    if (!charged.ok) {
      setGenerationError("Nicht genug Yuan für diesen Booster.");
      return;
    }

    const nextOpened = opened + openingCount;
    const marks = revealMarks(result, before, arcade.chaseCardIds);
    const source = drawn.godPack ? "godpack" as const : isDailyLock ? "daily" as const : prizeLock ? "prize" as const : "altar" as const;
    arcade.recordPulls(batches.map((cards) => ({
      setName: selectedPack.setName,
      costYuan: isDailyLock ? 0 : selectedPack.cost,
      cardIds: cards.map((card) => card.id),
      openedAt: Date.now(),
      bestFen: cards.reduce((best, card) => Math.max(best, valueFen(card.id, card.rarity)), 0),
      source,
    })), { [selectedPack.setName]: drawn.pityCount });
    if (drawn.godPack) arcade.bumpGodPacks();
    setGodPackHit(drawn.godPack);
    setGhostText(arcade.ghostOn() ? ghostLine(marks, drawn.godPack) : "");
    result.forEach((card, index) => {
      if (!marks[index]?.isNew) return;
      const news = arcade.bumpOshiNews(card.character);
      if (!news.milestone) return;
      const tip = rainFen();
      if (credit(tip)) {
        setRainBurst((value) => value + 1);
        setWalletFromFen(economy.balanceFen);
        setWalletAnimating(true);
        window.setTimeout(() => setWalletAnimating(false), 1000);
      }
      setMetaToast(oshiLetter(card.character, news.milestone));
    });
    arcade.unlockAchievement("first-rip");
    if (marks.some((mark) => mark.isNew)) arcade.unlockAchievement("first-new");
    if (marks.some((mark) => mark.chase)) arcade.unlockAchievement("chase-hit");
    if ((charged.ok && (economy.stats.packsOpened + openingCount) >= 100)) arcade.unlockAchievement("packs-100");
    const nextOwned = { ...before };
    for (const card of result) nextOwned[String(card.id)] = (nextOwned[String(card.id)] || 0) + 1;
    for (const setName of newlyCompletedSets(allCards, nextOwned, arcade.setClears)) {
      const awarded = arcade.markSetClear(setName);
      if (awarded.ok) {
        addVoucher(1);
        arcade.unlockAchievement("first-clear");
        setMetaToast(`${setName} komplett · 1¥ Voucher`);
      }
    }
    const knownYearbook = arcade.meta.yearbook.map((page) => page.character);
    for (const name of newlyCompletedCharacters(allCards, nextOwned, knownYearbook)) {
      const first = result.find((card) => card.character === name);
      arcade.addYearbook(name, first?.id || 0);
    }
    const opens = arcade.bumpSession();
    const hit = result.some((card) => rarityTier(card.rarity) >= 3);
    const rain = arcade.rollRain(opens, hit);
    if (rain > 0 && credit(rain)) {
      setRainBurst((value) => value + 1);
      setWalletFromFen(economy.balanceFen);
      setWalletAnimating(true);
      window.setTimeout(() => setWalletAnimating(false), 1000);
    }
    if (isDailyLock) arcade.markDailyPack();

    inputLock.current = true;
    void playTear();
    packHaptic(3);
    setPack(result);
    setPullMarks(marks);
    setActiveIndex(0);
    setRevealedThrough(-1);
    setFreshIndex(-1);
    revealedRef.current = -1;
    setDirection(1);
    setTransitioning(false);
    setInspectorOpen(false);
    setCollation(drawn.collation);
    setOpened(nextOpened);
    setPhase("opening");
    setSoldIndexes(new Set());
    setSummaryPicked([]);
    writeCollation(selectedPack, drawn.collation);
    writeOpenedCount(selectedPack.setName, nextOpened);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    await Promise.all([
      preloadCards(result),
      new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 30 : (openingCount === 10 ? 3190 : 1850))),
    ]);
    if (sequence.current !== token) return;
    inputLock.current = false;
    revealedRef.current = 0;
    void playReveal(result[0].rarity);
    if (marks[0]?.chase) void playShrineWin(selectedPack.cost);
    packHaptic(rarityTier(result[0].rarity));
    flushSync(() => {
      setPhase("revealing");
      setRevealedThrough(0);
      setFreshIndex(0);
      setHitNonce((value) => value + 1);
    });
  }, [addVoucher, allCards, arcade, chargeOpenedPacks, collation, credit, dataReady, economy, getPool, isDailyLock, mode, openFreePack, opened, packChosen, packCount, phase, playReveal, playShrineWin, playTear, prizeLock, recipe, selectedPack, startMusic, valueFen]);

  const resetForAnother = () => {
    inputLock.current = false;
    sequence.current += 1;
    if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current);
    setPack([]);
    setActiveIndex(0);
    setRevealedThrough(-1);
    setFreshIndex(-1);
    revealedRef.current = -1;
    setDirection(1);
    setTransitioning(false);
    setInspectorOpen(false);
    setPhase("sealed");
    setPackChosen(false);
    setSoldIndexes(new Set());
    setSummaryPicked([]);
    setPullMarks([]);
    setGhostText("");
    setGodPackHit(false);
    setWeigh(weighPack());
  };
  const claimOmikuji = () => {
    if (!arcade.canOmikuji()) return;
    const slip = rollOmikuji();
    arcade.markOmikuji(slip.id);
    setMetaToast(`${slip.title} · ${slip.line}`);
  };
  const selectPack = (item: PackConfig) => {
    if (!canChangeSet) return;
    if (isDailyLock && item.cost !== 1) return;
    setPackCount(1);
    setPickedPack(item);
    setPackChosen(false);
    setGroupFilter(item.group);
    setShowMenu(false);
    if (isDailyLock) writePrizeLock({ packId: item.id, returnMode: null, kind: "daily" });
  };
  const claimDailyPack = () => {
    if (!arcade.canDailyPack()) return;
    const daily = (selectedPack?.cost === 1 ? selectedPack : null)
      || catalog.find((item) => item.cost === 1)
      || null;
    if (!daily) return;
    sequence.current += 1;
    setPackCount(1);
    setPickedPack(daily);
    setGroupFilter(daily.group);
    setPack([]);
    setActiveIndex(0);
    setRevealedThrough(-1);
    setFreshIndex(-1);
    revealedRef.current = -1;
    setInspectorOpen(false);
    setPhase("sealed");
    setPackChosen(false);
    writePlayParam(null);
    writePrizeLock({ packId: daily.id, returnMode: null, kind: "daily" });
  };
  const claimGamePrize = (item: PackConfig, source: MinigameId) => {
    if (arcade.hasSkillClaim(source)) {
      const consolation = skillConsolationFen(item.cost);
      if (credit(consolation)) {
        setWalletFromFen(economy.balanceFen);
        setWalletAnimating(true);
        window.setTimeout(() => setWalletAnimating(false), 1000);
        setMetaToast(`Heute schon geclaimed · +${formatYuan(consolation)} ¥`);
      }
      return;
    }
    arcade.markSkillClaim(source);
    sequence.current += 1;
    setPackCount(1);
    setPickedPack(item);
    setGroupFilter(item.group);
    setPack([]);
    setActiveIndex(0);
    setRevealedThrough(-1);
    setFreshIndex(-1);
    revealedRef.current = -1;
    setInspectorOpen(false);
    setPhase("sealed");
    setPackChosen(false);
    writePlayParam(null);
    writePrizeLock({ packId: item.id, returnMode: source, kind: "prize" });
  };
  const returnToGame = () => {
    resetForAnother();
    writePrizeLock(null);
    if (isDailyLock) return;
    writePlayParam(prizeReturnMode);
  };
  const pulseWallet = () => {
    setWalletFromFen(economy.balanceFen);
    setWalletAnimating(true);
    window.setTimeout(() => setWalletAnimating(false), 1000);
  };
  const markSoldIndexes = (indexes: number[]) => {
    if (!indexes.length) return;
    setSoldIndexes((current) => {
      const next = new Set(current);
      for (const index of indexes) next.add(index);
      return next;
    });
    setSummaryPicked((current) => current.filter((index) => !indexes.includes(index)));
    setWalletFromFen(economy.balanceFen);
    setWalletAnimating(true);
    window.setTimeout(() => setWalletAnimating(false), 1000);
  };
  const sellFromPackMany = (indexes: number[]) => {
    const junk = indexes.flatMap((index) => {
      const card = pack[index];
      if (!card || soldIndexes.has(index)) return [];
      return [{ index, cardId: card.id, valueFen: valueFen(card.id, card.rarity) }];
    });
    if (!junk.length) return;
    const sold = sellMany(junk.map(({ cardId, valueFen: value }) => ({ cardId, valueFen: value })));
    if (!sold) return;
    markSoldIndexes(junk.map((row) => row.index));
  };
  const toggleSummaryPick = (index: number) => {
    if (soldIndexes.has(index)) return;
    setSummaryPicked((current) => (
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index]
    ));
  };
  const sellFromPack = (index: number): boolean => {
    const card = pack[index];
    if (soldGuard.current.pack !== pack) soldGuard.current = { pack, indexes: new Set() };
    const guard = soldGuard.current.indexes;
    if (!card || soldIndexes.has(index) || guard.has(index)) return false;
    guard.add(index);
    try {
      if (sell(card.id, valueFen(card.id, card.rarity))) {
        markSoldIndexes([index]);
        return true;
      }
      guard.delete(index);
      return false;
    } catch (error) { guard.delete(index); throw error; }
  };
  const acceptTopup = () => {
    if (!pendingTopup) return;
    setWalletFromFen(economy.balanceFen);
    creditTopup(pendingTopup.yuan);
    clearPendingTopup();
    setWalletAnimating(true);
    window.setTimeout(() => setWalletAnimating(false), 1000);
  };
  const switchMode = (next: ExperienceMode) => {
    if (phase === "opening" || phase === "revealing" || prizeLock) return;
    void playUiTap();
    void startMusic();
    if (phase === "summary") resetForAnother();
    setShowMenu(false);
    setShowInfo(false);
    writePlayParam(next === "games" ? activeGame : null);
  };
  const selectGame = (id: MinigameId) => {
    writePlayParam(id);
  };

  useEffect(() => {
    if (!showMenu) return;
    const previous = document.activeElement as HTMLElement | null;
    const sheet = document.querySelector<HTMLElement>(".pack-picker-sheet");
    sheet?.querySelector<HTMLButtonElement>("button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !sheet) return;
      const controls = Array.from(sheet.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href]'));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); };
  }, [showMenu]);

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalog.filter((item) => query ? item.setName.toLowerCase().includes(query) : item.group === activeGroup);
  }, [activeGroup, catalog, search]);
  const targetRows = useMemo(() => (
    recipe && selectedPack
      ? recipeRarityTargets(recipe, selectedPack).sort((left, right) => rarityTier(left.rarity) - rarityTier(right.rarity))
      : []
  ), [recipe, selectedPack]);
  const sceneStyle = active && phase === "revealing"
    ? { "--rarity-color": rarityColor(active.rarity) } as CSSProperties
    : undefined;
  const fortune = omikujiById(arcade.meta.omikujiId);
  const midnight = isMidnight();
  const foilMul = fortune?.foil ?? 1;

  return (
    <main className={`gacha-stage ${palette} phase-${phase} mode-${mode}${mode === "games" ? ` game-${activeGame}${activeGame === "waifu21" ? " mode-shrine" : ""}${activeGame === "heartlock" ? " mode-duel" : ""}` : ""}${showMenu ? " menu-open" : ""}${packChosen ? " pack-is-chosen" : ""}${fortune ? ` omikuji-${fortune.id}` : ""}${midnight ? " is-midnight" : ""}${godPackHit ? " is-god-pack" : ""}`} style={sceneStyle}>
      <div className="scene-vignette" /><div className="constellation constellation-a" /><div className="constellation constellation-b" />
      <div className="orbit orbit-one" /><div className="orbit orbit-two" />
      <div className="dust" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      <div className="set-watermark" aria-hidden="true">{selectedPack?.setName || "NS"}</div>

      <section className="gacha-shell" aria-label={arcadeConfig.brandLabel}>
        <header className="gacha-header">
          <div className="header-left">
            {mode === "altar" && phase === "sealed" && packChosen && !prizeLock
              ? <button className="edge-control vault-trigger back-trigger" aria-label="Zurück zum Booster-Karussell" onClick={() => { setPackChosen(false); }}><span className="edge-icon"><AppIcon name="back" /></span><b>BACK</b></button>
              : <button className="edge-control vault-trigger" aria-label="Booster-Auswahl öffnen" aria-expanded={showMenu} onClick={() => setShowMenu(true)} disabled={mode !== "altar" || Boolean(prizeLock)}><span className="edge-icon"><AppIcon name="menu" /></span><b>BOOSTERS</b></button>}
          </div>
          <div className="wordmark" aria-label={arcadeConfig.brandLabel}>{arcadeConfig.brandLead}<span>{arcadeConfig.brandAccent}</span><small>{fortune?.line || arcadeConfig.brandTagline}</small></div>
          <div className="header-actions">
            <button className="edge-control music-control" aria-label={musicEnabled ? "Musik ausschalten" : "Musik einschalten"} aria-pressed={musicEnabled} onClick={() => void toggleMusic()}><span className="edge-icon"><AppIcon name="music" /></span><b>{musicEnabled ? "MUSIC ON" : "MUSIC OFF"}</b></button>
            <button className="edge-control sound-control" aria-label={muted ? "Sound einschalten" : "Sound ausschalten"} aria-pressed={!muted} onClick={() => void toggleMuted()}><span className="edge-icon"><AppIcon name="sound" /></span><b>{muted ? "SOUND OFF" : "SOUND ON"}</b></button>
            <button className="edge-control" onClick={() => setShowInfo(true)} disabled={!selectedPack}><span className="edge-icon"><AppIcon name="odds" /></span><b>ODDS</b></button>
            <WalletChip balanceFen={economy.balanceFen} fromFen={walletFromFen} vouchers={economy.vouchers} animating={walletAnimating} />
          </div>
        </header>

        <nav className="experience-switch" aria-label="Spielmodus">
          <button className={mode === "altar" ? "is-active" : ""} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); switchMode("altar"); } }} onClick={(event) => { if (event.detail === 0) switchMode("altar"); }} disabled={phase === "opening" || phase === "revealing" || Boolean(prizeLock)}><span><AppIcon name="pack" /></span><b>PACKS</b><small>open</small></button>
          <button className={mode === "games" ? "is-active" : ""} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); switchMode("games"); } }} onClick={(event) => { if (event.detail === 0) switchMode("games"); }} disabled={phase === "opening" || phase === "revealing" || Boolean(prizeLock)}><span><AppIcon name="games" /></span><b>GAMES</b><small>play</small></button>
          <button className="collection-nav" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); if (phase !== "opening" && phase !== "revealing") window.location.assign("/collection"); } }} onClick={(event) => { if (event.detail === 0 && phase !== "opening" && phase !== "revealing") window.location.assign("/collection"); }} disabled={phase === "opening" || phase === "revealing"}><span><AppIcon name="collection" /></span><b>CARDS</b><small>collect</small></button>
          <Link className="store-nav" href="/store"><span><AppIcon name="store" /></span><b>STORE</b><small>yuan</small></Link>
        </nav>

        <div ref={experienceRef} className="experience" aria-live="polite">
          {!dataReady && dbStatus !== "error" && catalogStatus !== "error" && <div className="loading-state"><span className="loader-sigil" />Goddess-Story-Archiv wird geladen…</div>}
          {(dbStatus === "error" || catalogStatus === "error") && <div className="error-card"><b>Archiv nicht erreichbar</b><span>Pack- oder Kartendaten konnten nicht geladen werden.</span></div>}
          {generationError && <div className="generation-error">{generationError}</div>}

          {mode === "games" && dataReady && (
            <MinigameHub
              catalog={catalog}
              ready={dataReady}
              muses={shrineDealerCards}
              allCards={allCards}
              activeGame={activeGame}
              onSelectGame={selectGame}
              onClaim={claimGamePrize}
              onPulse={pulseWallet}
              startMusic={startMusic}
              playDrop={playShrineDrop}
              playBounce={playShrineBounce}
              playWin={playShrineWin}
              playLock={playDuelLock}
              playUiTap={playUiTap}
              playStart={playDuelStart}
              playLoss={playDuelLoss}
            />
          )}

          {mode === "altar" && selectedPack && dataReady && phase === "sealed" && !packChosen && (
            <>
              {arcade.canDailyPack() && !prizeLock && (
                <button type="button" className="daily-pack-banner" onClick={claimDailyPack}>
                  <small>DAILY ALTAR</small>
                  <b>Gratis 1¥-Pack bereit</b>
                  <span>12 Stunden · Rip-Zeremonie bleibt</span>
                </button>
              )}
              {arcade.canOmikuji() && !prizeLock && (
                <button type="button" className="daily-pack-banner omikuji-banner" onClick={claimOmikuji}>
                  <small>OMIKUJI</small>
                  <b>Los ziehen</b>
                  <span>Nur Stimmung · Pity und Collation bleiben</span>
                </button>
              )}
              {midnight && (
                <p className="daily-pack-banner midnight-banner" role="status">
                  <small>MITTERNACHT</small>
                  <b>Der Altar ist dichter</b>
                  <span>Odds unverändert · Rain fällt öfter</span>
                </p>
              )}
              <p className={`pack-weigh is-${weigh.feel}`}>{weigh.line}</p>
              <PackCarousel key={selectedPack.setName} art={packMuse.image} setName={selectedPack.setName} cost={selectedPack.cost} cards={selectedPack.odds.cardsPerPack} onTick={() => { void playUiTap(); packHaptic(); }} locked={Boolean(prizeLock)} onSelectSet={() => setShowMenu(true)} onChoose={(count) => { setPackCount(count); setPackChosen(true); setWeigh(weighPack()); void startMusic(); }} />
            </>
          )}

          {mode === "altar" && selectedPack && packChosen && (phase === "sealed" || phase === "opening") && (
            <>
              {phase === "sealed" && <p className={`pack-weigh is-${weigh.feel}`}>{weigh.line}</p>}
              <PackOpening key={`${selectedPack.setName}-${packCount}`} art={packMuse.image} setName={selectedPack.setName} cost={selectedPack.cost} cards={selectedPack.odds.cardsPerPack} count={packCount} opening={phase === "opening"} affordable={canAfford} glows={recipe ? Array.from({ length: packCount }, (_, i) => { const shine = boosterShine(pack.slice(i * selectedPack.odds.cardsPerPack, (i + 1) * selectedPack.odds.cardsPerPack).map(card => card.rarity), recipe); return { level: shine.level, color: shine.rarity ? rarityColor(shine.rarity) : "#cde9f6" }; }) : []} firstCard={pack[0] ? cardImage(pack[0]) : undefined} onOpen={() => void openPack()} onFoil={(progress) => { void playFoil(progress); packHaptic(); }} />
            </>
          )}

          {mode === "altar" && phase === "revealing" && active && (
            <div className={`reveal-stage rarity-tier-${rarityTier(active.rarity)} direction-${direction} ${transitioning ? "is-transitioning" : ""} ${activeIndex === freshIndex ? `fresh-hit hit-${hitNonce % 2}` : ""}${godPackHit ? " is-god-pack" : ""}`}>
              {rarityTier(active.rarity) >= 3 && <div className="hit-backdrop" aria-hidden="true"><img src={cardImage(active)} alt="" /></div>}
              <div className="reveal-halo" />
              {ghostText && <p className="ghost-ticker" role="status">{ghostText}</p>}
              {activeIndex === freshIndex && <div key={`${active.id}-${hitNonce}`} className={`reveal-burst burst-tier-${rarityTier(active.rarity)}${godPackHit ? " is-god" : ""}`} aria-hidden="true"><i /><i /><i /><i /><strong>{godPackHit ? "GOD PACK" : active.rarity}</strong><b>{godPackHit ? "GOD PACK!" : rarityTier(active.rarity) >= 4 ? "GODDESS HIT!" : rarityTier(active.rarity) >= 3 ? "JACKPOT PULL!" : rarityTier(active.rarity) >= 2 ? "SHINY!" : ""}<small>{rarityTier(active.rarity) >= 2 ? active.character : ""}</small></b></div>}
              <div className="reveal-index"><b>{String(activeIndex + 1).padStart(2, "0")}</b><span>/ {String(pack.length).padStart(2, "0")}</span><i>CARD</i></div>
              <PackStack boosterSize={selectedPack?.odds.cardsPerPack || pack.length} cards={pack.map((card, index) => ({ id: card.id, image: cardImage(card), character: card.character, rarity: card.rarity, color: rarityColor(card.rarity), isNew: pullMarks[index]?.isNew, copies: pullMarks[index]?.copies, chase: pullMarks[index]?.chase }))} activeIndex={activeIndex} onNext={nextCard} onPrevious={previousCard} onInspect={() => { setInspectorFromSummary(false); setInspectorOpen(true); }} onPeek={() => { void playPeek(); }} foilStrength={foilMul} />
              <button className="nav-orb nav-previous" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); previousCard(); } }} onClick={(event) => { if (event.detail === 0) previousCard(); }} disabled={activeIndex === 0} aria-label="Vorherige Karte">←</button>
              <button className="nav-orb nav-next" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); nextCard(); } }} onClick={(event) => { if (event.detail === 0) nextCard(); }} aria-label={activeIndex === pack.length - 1 ? "Pack ansehen" : "Nächste Karte"}>→</button>
              <div className="pull-caption" aria-live="polite" aria-atomic="true"><b style={{ color: rarityColor(active.rarity) }}>{active.rarity}</b><span><strong>{active.character || "Unknown character"}</strong><small>{active.title}</small>{pullMarks[activeIndex]?.chase ? <em className="pull-flag is-chase">CHASE</em> : pullMarks[activeIndex]?.isNew ? <em className="pull-flag is-new">NEW</em> : (pullMarks[activeIndex]?.copies || 0) > 1 ? <em className="pull-flag">×{pullMarks[activeIndex]?.copies}</em> : null}</span></div>
              {packCount === 10 && <div className="batch-reveal-progress"><span>Pack {Math.floor(activeIndex / (selectedPack?.odds.cardsPerPack || 1)) + 1} / 10</span><button onClick={() => { setInspectorOpen(false); setPhase("summary"); }}>Alle ansehen ↗</button></div>}
              <div className="pull-trail" aria-label="Cards in this pack">{pack.map((card, index) => (packCount === 1 || Math.floor(index / (selectedPack?.odds.cardsPerPack || 1)) === Math.floor(activeIndex / (selectedPack?.odds.cardsPerPack || 1))) && <button key={`${card.id}-${index}`} disabled={index > revealedThrough} aria-label={index <= revealedThrough ? `Card ${index + 1}: ${card.rarity} ${card.character}` : `Card ${index + 1}: unrevealed`} aria-current={index === activeIndex ? "step" : undefined} onClick={() => navigateCard(index)} style={{ "--pull-color": index <= revealedThrough ? rarityColor(card.rarity) : "#604568" } as CSSProperties}><i />{index <= revealedThrough ? card.rarity : "·"}</button>)}</div>
              {activeIndex === freshIndex && rarityTier(active.rarity) >= 3 && <div key={`confetti-${hitNonce}`} className="pull-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--angle": `${i * 30}deg`, "--flight": `${110 + (i % 3) * 40}px`, "--delay": `${(i % 3) * 35}ms` } as CSSProperties} />)}</div>}
            </div>
          )}

          {mode === "altar" && phase === "summary" && pack.length > 0 && (
            <div className="pack-summary">
              <div className="summary-heading">
                <span>{packCount === 10 ? "10 BOOSTERS COMPLETE" : "BOOSTER COMPLETE"} · {pack.length} CARDS</span>
                <h1>{selectedPack?.setName}</h1>
                <p>BEST PULL <b style={{ color: rarityColor(bestPull?.rarity || "R") }}>{bestPull?.rarity}</b><em>{bestPull?.character}</em></p>
                <div className="summary-value-line">
                  <span><small>TOTAL VALUE</small><b>{formatYuan(packValueFen)} ¥</b></span>
                  <span><small>PACK COST</small><b>{formatYuan(packCostFen)} ¥</b></span>
                  <span className={packNetFen >= 0 ? "is-profit" : "is-loss"}><small>NET</small><b>{packNetFen > 0 ? "+" : ""}{formatYuan(packNetFen)} ¥</b></span>
                </div>
              </div>
              <div className={`summary-grid summary-${pack.length}`}>
                {pack.map((card, index) => (
                  <div key={`${card.id}-${index}`} className={`summary-slot${summaryPicked.includes(index) ? " is-picked" : ""}${soldIndexes.has(index) ? " is-sold" : ""}`} style={{ "--card-color": rarityColor(card.rarity), "--delay": `${index * 45}ms` } as CSSProperties}>
                    <button className="summary-art" onClick={() => { setActiveIndex(index); setRevealedThrough(pack.length - 1); setFreshIndex(-1); revealedRef.current = pack.length - 1; setDirection(1); setTransitioning(false); setPhase("revealing"); setInspectorFromSummary(true); setInspectorOpen(true); }} aria-label={`${card.rarity} ${card.character} anzeigen`}>
                      <img src={cardImage(card)} alt={`${card.rarity}-${card.number} ${card.character}`} /><b>{card.rarity}</b>
                    </button>
                    <div className="summary-meta">
                      <span>{formatYuan(valueFen(card.id, card.rarity))} ¥</span>
                      {pullMarks[index]?.chase ? <em className="pull-flag is-chase">CHASE</em> : pullMarks[index]?.isNew ? <em className="pull-flag is-new">NEW</em> : null}
                      <button type="button" className={`summary-pick${summaryPicked.includes(index) ? " is-active" : ""}`} disabled={soldIndexes.has(index)} onClick={() => toggleSummaryPick(index)}>{summaryPicked.includes(index) ? "Weg" : "Wahl"}</button>
                      <SellButton className="summary-sell" sold={soldIndexes.has(index)} onSell={() => sellFromPack(index)}>Verkaufen</SellButton>
                    </div>
                  </div>
                ))}
              </div>
              <PackSummaryBulk
                pack={pack}
                soldIndexes={soldIndexes}
                pullMarks={pullMarks}
                valueFen={valueFen}
                selected={summaryPicked}
                onChange={setSummaryPicked}
                onSellIndexes={sellFromPackMany}
              />
              <button className="primary-action summary-footer-action" onClick={prizeLock ? returnToGame : resetForAnother}><span>{isDailyLock ? "FERTIG" : prizeLock ? `BACK TO ${prizeReturnTitle}` : "OPEN ANOTHER"}</span><i><AppIcon name={prizeLock && !isDailyLock ? "back" : "replay"} /></i></button>
            </div>
          )}
        </div>

        {mode === "altar" && selectedPack && (packChosen || phase !== "sealed") && (
          <div className={`set-anchor ${prizeLock ? "is-prize" : ""} ${isDailyLock ? "is-daily" : ""}`}><span className="anchor-kicker">{isDailyLock ? "DAILY 1¥ · LOCKED" : prizeLock ? `${prizeReturnTitle} PRIZE · LOCKED` : arcade.meta.oshiCharacter ? `OSHI · ${arcade.meta.oshiCharacter}` : "SELECTED BOOSTER"}</span><button onClick={() => canChangeSet ? setShowMenu(true) : setShowInfo(true)}><b>{selectedPack.setName}</b><span>{groupLabels[selectedPack.group] || selectedPack.group} · {selectedPack.odds.cardsPerPack} cards</span></button><small>{opened.toLocaleString("de-DE")} packs opened{collation && recipe ? ` · Box ${boxMeter(selectedPack, recipe, collation).boxNumber} · ${boxMeter(selectedPack, recipe, collation).remainingPacks} left` : ""}{pityState(arcade.pityBySet[selectedPack.setName] || 0) !== "idle" ? ` · Pity ${pityState(arcade.pityBySet[selectedPack.setName] || 0)}` : ""}</small></div>
        )}
        {mode === "altar" && (phase !== "sealed" || packChosen) && <div className="action-dock">
          {phase === "sealed" && !canAfford && <p className="funds-hint">Nicht genug Yuan · <Link href="/store">Store</Link></p>}
          {phase === "sealed" && <button className="primary-action" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); void openPack(); } }} onClick={(event) => { if (event.detail === 0) void openPack(); }} disabled={!dataReady || !canAfford}><span>{isDailyLock ? "RIP DAILY BOOSTER" : usingVoucher ? "RIP WITH VOUCHER" : "RIP THIS BOOSTER"}<small>{isDailyLock ? "0 ¥" : selectedPack ? `${selectedPack.cost * packCount} ¥` : ""}</small></span><i><AppIcon name="pack" /></i></button>}
          {phase === "opening" && <div className="opening-meter"><i /><span>DEALING YOUR CARDS</span></div>}
          {phase === "revealing" && <button className="primary-action next-action" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); nextCard(); } }} onClick={(event) => { if (event.detail === 0) nextCard(); }}><span>{activeIndex === pack.length - 1 ? "SHOW FULL PACK" : "NEXT CARD"}<small>{activeIndex + 1} / {pack.length}</small></span><i><AppIcon name="arrow" /></i></button>}
          {phase === "summary" && <button className="primary-action" onClick={prizeLock ? returnToGame : resetForAnother}><span>{isDailyLock ? "FERTIG" : prizeLock ? `BACK TO ${prizeReturnTitle}` : "OPEN ANOTHER"}</span><i><AppIcon name={prizeLock && !isDailyLock ? "back" : "replay"} /></i></button>}
        </div>}

        {mode === "altar" && active && phase === "revealing" && inspectorOpen && (
          <aside className="card-inspector is-open" role="dialog" aria-label="Kartendetails" aria-hidden={false}>
            <button className="inspector-close" onClick={() => { setInspectorOpen(false); if (inspectorFromSummary) setPhase("summary"); }} aria-label="Kartendetails schließen">×</button>
            <div className="inspector-rarity" style={{ color: rarityColor(active.rarity) }}><span>{active.rarity}</span><i /></div>
            <span className="inspector-kicker">CARD {activeIndex + 1} · {selectedPack?.setName}</span><h2>{active.character || "Unknown Goddess"}</h2><p>{active.title || "Goddess Story"}</p>
            <dl><div><dt>Set</dt><dd>{active.set_name}</dd></div><div><dt>Card no.</dt><dd>{active.number}</dd></div><div><dt>Rarity</dt><dd>{active.rarity}</dd></div><div><dt>Wert</dt><dd>{formatYuan(valueFen(active.id, active.rarity))} ¥</dd></div><div><dt>Position</dt><dd>{activeIndex + 1} / {pack.length}</dd></div></dl>
            <SellButton key={`${active.id}-${activeIndex}`} className="inspector-sell" sold={soldIndexes.has(activeIndex)} onSell={() => sellFromPack(activeIndex)} soldLabel="Bereits verkauft">{`Für ${formatYuan(valueFen(active.id, active.rarity))} ¥ verkaufen`}</SellButton>
            <button className="inspector-next" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); nextCard(); } }} onClick={(event) => { if (event.detail === 0) nextCard(); }}>{activeIndex === pack.length - 1 ? "Pack ansehen" : "Nächste Karte"}<span>→</span></button>
          </aside>
        )}

        {showMenu && <aside className="pack-drawer pack-picker-sheet is-open" role="dialog" aria-modal="true" aria-label="Booster auswählen">
          <div className="drawer-head"><div><b>Dein nächstes Set</b></div><button onClick={() => setShowMenu(false)} aria-label="Pack Vault schließen">×</button></div>
          {!canChangeSet && <p className="vault-lock">{isDailyLock ? "Daily pack stays locked until opened." : prizeLock ? "Minigame prizes stay locked until opened." : "Finish this booster first."}</p>}
          <input className="pack-search" type="search" placeholder="Set suchen…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="group-tabs">{groupOptions.map((group) => <button key={group} className={activeGroup === group ? "active" : ""} onClick={() => setGroupFilter(group)}>{groupLabels[group] || group}</button>)}</div>
          <div className="drawer-list">
            {filteredCatalog.map((item) => {
              const record = sets.find((set) => set.name === item.setName);
              const itemCover = cardAsset(record?.images?.[0]);
              return <button key={item.id} className={`drawer-pack ${selectedPack?.id === item.id ? "is-active" : ""}`} onClick={() => selectPack(item)} disabled={!canChangeSet || (isDailyLock && item.cost !== 1)}>{itemCover ? <img src={itemCover} alt="" loading="lazy" /> : <span className="cover-fallback">✦</span>}<span><b>{item.setName}</b><small>{item.odds.cardsPerPack} Karten</small></span><em>{item.cost} ¥</em></button>;
            })}
          </div>
        </aside>}
        {showMenu && <button className="drawer-backdrop" aria-label="Pack Vault schließen" onClick={() => setShowMenu(false)} />}
      </section>

      {showInfo && selectedPack && recipe && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowInfo(false)}>
          <section className="odds-modal" role="dialog" aria-modal="true" aria-labelledby="odds-title">
            <button className="modal-close" onClick={() => setShowInfo(false)} aria-label="Schließen">×</button>
            <span className="odds-kicker">PHYSICAL-STYLE COLLATION · {groupLabels[selectedPack.group]}</span><h2 id="odds-title">{selectedPack.setName}</h2><p className="odds-pattern">{recipe.pattern}</p>
            <p className="odds-intro">Jeder Booster wird in festen Positionsgruppen aufgebaut. Die Box-Verteilung läuft unsichtbar im Hintergrund, damit einzelne Packs spannend bleiben und sich trotzdem wie echte Goddess-Story-Produkte verhalten.</p>
            {collation && (() => {
              const meter = boxMeter(selectedPack, recipe, collation);
              const pity = pityState(arcade.pityBySet[selectedPack.setName] || 0);
              return (
                <>
                  <p className="box-meter-copy">
                    <b>Box {meter.boxNumber}</b> · {meter.packIndex}/{meter.boostersCount} geöffnet · {meter.remainingPacks} übrig · {meter.highRemaining} High-Hits noch in der Box
                    {pity !== "idle" ? ` · Soft-Pity ${pity}` : ` · Pity ${(arcade.pityBySet[selectedPack.setName] || 0)}/${PITY_ARM}`}
                  </p>
                  <p className="box-meter-lanes">
                    {meter.lanes.map((lane) => `${lane.id}: ${lane.highRemaining} Hits / ${lane.remaining} Slots`).join(" · ")}
                  </p>
                  {(() => {
                    const lane = meter.lanes.find((row) => row.remaining > 0) || meter.lanes[0];
                    if (!lane) return null;
                    const locked = arcade.hasDetectiveGuess(selectedPack.setName, meter.boxNumber);
                    return (
                      <div className="detective-row">
                        <b>Collation Detective</b>
                        <span>Lane {lane.id} · High-Hits noch in der Box?</span>
                        <div>
                          {(["0", "1", "2+"] as const).map((guess) => (
                            <button
                              key={guess}
                              type="button"
                              disabled={locked}
                              onClick={() => {
                                if (arcade.hasDetectiveGuess(selectedPack.setName, meter.boxNumber)) return;
                                arcade.markDetectiveGuess(selectedPack.setName, meter.boxNumber);
                                if (guess === detectiveBucket(lane.highRemaining)) {
                                  if (credit(DETECTIVE_PAY_FEN)) {
                                    setWalletFromFen(economy.balanceFen);
                                    setWalletAnimating(true);
                                    window.setTimeout(() => setWalletAnimating(false), 1000);
                                  }
                                  setMetaToast("Detective trifft · +0,10 ¥");
                                } else setMetaToast("Detective daneben. Nächste Box.");
                              }}
                            >{guess}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
            <p className="ten-pack-odds"><b>10er-Bonus · zweite Chance</b> Jeder Booster im 10er erhält eine 10% Chance auf einen zusätzlichen Roll für seinen letzten variablen Hit-Slot. Die höhere Rarity bleibt; bei gleicher Stufe gewinnt die seltenere Rarity im Set. Kein garantierter Upgrade und keine zusätzlichen Kosten. Die Basiswerte unten gelten für einzelne Booster.</p>
            <div className="odds-grid">{targetRows.map((row) => <div key={row.rarity} style={{ "--chip": rarityColor(row.rarity) } as CSSProperties}><b>{row.rarity}</b><span>Ø {(row.perBox / selectedPack.boostersCount).toLocaleString("de-DE", { maximumFractionDigits: 3 })} pro Booster</span></div>)}</div>
            <div className="collation-notes"><p><b>Keine normalen Doppelbilder:</b> Innerhalb eines Boosters wird jede exakte Karten-ID ohne Zurücklegen gezogen.</p><p><b>Pull order bleibt echt:</b> Base-, Shine- und Hit-Slots werden nicht nach Rarity nachsortiert.</p>{selectedPack.odds.bonus.length > 0 && <p><b>Bonus-Packs:</b> PR/Bonus-Karten bleiben Box-Beigaben und werden nicht künstlich in normale Booster gemischt.</p>}</div>
          </section>
        </div>
      )}
      {rainBurst > 0 && <div key={rainBurst} className={`yuan-rain${midnight ? " is-midnight" : ""}`} aria-hidden="true">{Array.from({ length: midnight ? 22 : 14 }, (_, index) => <i key={index} />)}</div>}
      {metaToast && <p className="meta-toast" role="status">{metaToast}</p>}
      {pendingTopup && (
        <div className="modal-backdrop" role="presentation">
          <section className="odds-modal topup-modal" role="dialog" aria-modal="true" aria-labelledby="topup-title">
            <span className="odds-kicker">STORE · EINZAHLUNG</span>
            <h2 id="topup-title">Du erhältst {formatYuan(yuanToFen(pendingTopup.yuan))} Yuan</h2>
            <p className="odds-intro">Die simulierte Zahlung wurde autorisiert. Mit OK wird dein Guthaben gutgeschrieben.</p>
            <button className="primary-action" onClick={acceptTopup}><span>OK, GUTHABEN HOLEN</span><i>¥</i></button>
          </section>
        </div>
      )}
    </main>
  );
}
