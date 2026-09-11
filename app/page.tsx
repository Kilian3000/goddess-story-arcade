"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  compilePackRecipe,
  createCollationState,
  drawPackRarities,
  isCollationStateValid,
  rarityTier,
  recipeRarityTargets,
  secureRandom,
  type CollationState,
  type PackConfig,
  type PackRecipe,
} from "./gacha-engine";
import { arcadeConfig, cardAsset } from "./arcade-config";
import { groupClass, groupLabels, rarityColor } from "./arcade-ui";
import type { Card } from "./card-types";
import {
  canOpenPack,
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
import { PackCarousel } from "./pack-carousel";
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
function collationKey(setName: string) { return `goddess-gacha-collation-${setName}-v3`; }
function openedKey(setName: string) { return `goddess-gacha-opened-${setName}-v3`; }

function chooseUniqueCard(pool: Card[], used: Set<number>) {
  const available = pool.filter((card) => !used.has(card.id));
  if (!available.length) return null;
  const card = available[Math.floor(secureRandom() * available.length)];
  used.add(card.id);
  return card;
}

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

function readCollation(config: PackConfig, recipe: PackRecipe) {
  try {
    const raw = window.localStorage.getItem(collationKey(config.setName));
    const saved: unknown = raw ? JSON.parse(raw) : null;
    if (isCollationStateValid(saved, config, recipe)) return saved;
  } catch {
    // Invalid local state starts a fresh hidden box.
  }
  return createCollationState(config, recipe);
}

function PackSigil() {
  return (
    <svg className="pack-sigil" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="48" fill="none" stroke="currentColor" strokeWidth=".8" />
      {[0, 60, 120, 180, 240, 300].map((rotation) => (
        <ellipse key={rotation} cx="100" cy="55" rx="19" ry="43" fill="none" stroke="currentColor" strokeWidth="1.4" transform={`rotate(${rotation} 100 100)`} />
      ))}
      <path d="M100 79a21 21 0 1 0 0 42 17 17 0 1 1 0-42Z" fill="currentColor" />
      <path d="M100 7v17M100 176v17M7 100h17M176 100h17" stroke="currentColor" />
    </svg>
  );
}

export default function Home() {
  const { allCards, sets, catalog, dbStatus, catalogStatus, catalogReady } = useCardCatalog();
  const { state: economy, valueFen, openPack: chargeOpenedPack, sell, creditTopup } = useEconomy();
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
  const playFromUrl = useSyncExternalStore(subscribePlayParam, playSnapshot, () => "");
  const activeGame = minigameById(playFromUrl)?.id ?? DEFAULT_MINIGAME;
  const mode: ExperienceMode = prizeRecord ? "altar" : playFromUrl ? "games" : "altar";
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [tearProgress, setTearProgress] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [transitioning, setTransitioning] = useState(false);
  const [freshIndex, setFreshIndex] = useState(-1);
  const [hitNonce, setHitNonce] = useState(0);
  const [soldIndexes, setSoldIndexes] = useState<Set<number>>(() => new Set());
  const [walletAnimating, setWalletAnimating] = useState(false);
  const [walletFromFen, setWalletFromFen] = useState(0);
  const sequence = useRef(0);
  const tearStart = useRef<number | null>(null);
  const dragged = useRef(false);
  const suppressClick = useRef(false);
  const tearTick = useRef(0);
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
  const prizeReturnMode = prizeRecord?.returnMode ?? DEFAULT_MINIGAME;
  const prizeReturnTitle = minigameById(prizeReturnMode)?.title ?? "MINIGAMES";
  const selectedPack = prizeLock ?? pickedPack ?? fallbackPack;
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
      setOpened(Number(window.localStorage.getItem(openedKey(selectedPack.setName)) || 0) || 0);
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
      setTearProgress(0);
      setGenerationError("");
      setSoldIndexes(new Set());
    }, 0);
    return () => window.clearTimeout(sync);
  }, [recipe, selectedPack]);

  const active = pack[activeIndex];
  const dataReady = catalogReady && Boolean(selectedPack && recipe && collation);
  const canAfford = selectedPack ? canOpenPack(economy, selectedPack.cost) : false;
  const usingVoucher = selectedPack ? Boolean(voucherForCost(selectedPack.cost) && economy.vouchers[voucherForCost(selectedPack.cost)!] > 0) : false;
  const packValueFen = pack.reduce((sum, card) => sum + valueFen(card.id, card.rarity), 0);
  const packCostFen = (selectedPack?.cost ?? 0) * 100;
  const packNetFen = packValueFen - packCostFen;
  const bestPull = pack.length
    ? pack.reduce((best, card) => rarityTier(card.rarity) > rarityTier(best.rarity) ? card : best)
    : null;
  const canChangeSet = mode === "altar" && !prizeLock && (phase === "sealed" || phase === "summary");
  const palette = groupClass(selectedPack?.group);
  const groupOptions = [...new Set(catalog.map((item) => item.group))];
  const shrineMuse = shrineDealerCards[0];
  const packMuse = shrineDealerCards[(selectedPack?.id || 0) % shrineDealerCards.length] || shrineMuse;
  const sideMuse = shrineDealerCards[((selectedPack?.id || 0) + 7) % shrineDealerCards.length] || shrineMuse;
  const rivalMuse = shrineDealerCards[((selectedPack?.id || 0) + 13) % shrineDealerCards.length] || shrineMuse;

  const getPool = useCallback((rarity: string) => {
    if (!selectedPack) return [];
    let pool = allCards.filter((card) => card.set_name === selectedPack.setName && card.rarity === rarity);
    if (rarity === "R" && selectedPack.group === "1 юань") {
      const oneYuan = catalog.filter((item) => item.group === "1 юань");
      const index = oneYuan.findIndex((item) => item.setName === selectedPack.setName);
      const previous = index > 0 ? oneYuan[index - 1] : null;
      if (previous) pool = pool.concat(allCards.filter((card) => card.set_name === previous.setName && card.rarity === "R"));
    }
    return pool;
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
    if (fresh) void playReveal(pack[index].rarity);
    else void playCardTravel();
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
  }, [activeIndex, pack, playCardTravel, playReveal]);

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
        if (inspectorOpen) setInspectorOpen(false);
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
  }, [inspectorOpen, nextCard, phase, previousCard, showInfo, showMenu]);

  const openPack = useCallback(async () => {
    if (!selectedPack || !recipe || !collation || !dataReady || !packChosen || phase !== "sealed" || mode !== "altar" || inputLock.current) return;
    if (!canOpenPack(economy, selectedPack.cost)) {
      setGenerationError("Nicht genug Yuan für diesen Booster.");
      return;
    }
    void startMusic();
    setGenerationError("");
    const token = ++sequence.current;
    const draw = drawPackRarities(selectedPack, recipe, collation);
    const used = new Set<number>();
    const result: Card[] = [];
    for (const rarity of draw.rarities) {
      const card = chooseUniqueCard(getPool(rarity), used);
      if (!card) {
        setGenerationError(`Für ${rarity} fehlen eindeutige Kartenbilder in ${selectedPack.setName}.`);
        return;
      }
      result.push(card);
    }
    if (result.length !== selectedPack.odds.cardsPerPack) {
      setGenerationError("Die Pack-Kollation konnte nicht vollständig aufgebaut werden.");
      return;
    }
    const charged = chargeOpenedPack(selectedPack.cost, result.map((card) => card.id));
    if (!charged.ok) {
      setGenerationError("Nicht genug Yuan für diesen Booster.");
      return;
    }

    const nextOpened = opened + 1;
    inputLock.current = true;
    void playTear();
    packHaptic(3);
    setPack(result);
    setActiveIndex(0);
    setRevealedThrough(-1);
    setFreshIndex(-1);
    revealedRef.current = -1;
    setDirection(1);
    setTransitioning(false);
    setInspectorOpen(false);
    setCollation(draw.state);
    setOpened(nextOpened);
    setPhase("opening");
    setTearProgress(1);
    setSoldIndexes(new Set());
    window.localStorage.setItem(collationKey(selectedPack.setName), JSON.stringify(draw.state));
    window.localStorage.setItem(openedKey(selectedPack.setName), String(nextOpened));

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    await Promise.all([
      preloadCards(result),
      new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 30 : 650)),
    ]);
    if (sequence.current !== token) return;
    inputLock.current = false;
    revealedRef.current = 0;
    void playReveal(result[0].rarity);
    packHaptic(rarityTier(result[0].rarity));
    flushSync(() => {
      setPhase("revealing");
      setRevealedThrough(0);
      setFreshIndex(0);
      setHitNonce((value) => value + 1);
    });
  }, [chargeOpenedPack, collation, dataReady, economy, getPool, mode, opened, packChosen, phase, playReveal, playTear, recipe, selectedPack, startMusic]);

  const onPackPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || !dataReady || phase !== "sealed") return;
    tearStart.current = event.clientX;
    tearTick.current = 0;
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    void playFoil();
  };
  const onPackPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (tearStart.current === null) return;
    const distance = Math.abs(event.clientX - tearStart.current);
    if (distance > 6) dragged.current = true;
    const progress = Math.min(1, distance / (event.currentTarget.offsetWidth * .55));
    setTearProgress(progress);
    const tick = Math.floor(progress * 4);
    if (tick > tearTick.current) { tearTick.current = tick; void playFoil(progress); packHaptic(); }
  };
  const onPackPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (tearStart.current === null) return;
    const finalProgress = Math.min(1, Math.abs(event.clientX - tearStart.current) / (event.currentTarget.offsetWidth * .55));
    const shouldOpen = dragged.current && finalProgress >= 0.65;
    suppressClick.current = dragged.current;
    tearStart.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* capture may already be gone */ }
    if (shouldOpen) void openPack(); else setTearProgress(0);
  };
  const onPackClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    void openPack();
  };

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
    setTearProgress(0);
    setPhase("sealed");
    setPackChosen(false);
    setSoldIndexes(new Set());
  };
  const selectPack = (item: PackConfig) => {
    if (!canChangeSet) return;
    setPickedPack(item);
    setPackChosen(false);
    setGroupFilter(item.group);
    setShowMenu(false);
  };
  const claimGamePrize = (item: PackConfig, source: MinigameId) => {
    sequence.current += 1;
    setPickedPack(item);
    setGroupFilter(item.group);
    setPack([]);
    setActiveIndex(0);
    setRevealedThrough(-1);
    setFreshIndex(-1);
    revealedRef.current = -1;
    setInspectorOpen(false);
    setTearProgress(0);
    setPhase("sealed");
    setPackChosen(false);
    writePlayParam(null);
    writePrizeLock({ packId: item.id, returnMode: source });
  };
  const returnToGame = () => {
    resetForAnother();
    writePrizeLock(null);
    writePlayParam(prizeReturnMode);
  };
  const pulseWallet = () => {
    setWalletFromFen(economy.balanceFen);
    setWalletAnimating(true);
    window.setTimeout(() => setWalletAnimating(false), 1000);
  };
  const sellFromPack = (index: number) => {
    const card = pack[index];
    if (!card || soldIndexes.has(index)) return;
    if (sell(card.id, valueFen(card.id, card.rarity))) {
      setSoldIndexes((current) => new Set(current).add(index));
    }
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

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalog.filter((item) => item.group === activeGroup && (!query || item.setName.toLowerCase().includes(query)));
  }, [activeGroup, catalog, search]);
  const targetRows = useMemo(() => (
    recipe && selectedPack
      ? recipeRarityTargets(recipe, selectedPack).sort((left, right) => rarityTier(left.rarity) - rarityTier(right.rarity))
      : []
  ), [recipe, selectedPack]);
  const sceneStyle = active && phase === "revealing"
    ? { "--rarity-color": rarityColor(active.rarity) } as CSSProperties
    : undefined;

  return (
    <main className={`gacha-stage ${palette} phase-${phase} mode-${mode}${mode === "games" ? ` game-${activeGame}${activeGame === "waifu21" ? " mode-shrine" : ""}${activeGame === "heartlock" ? " mode-duel" : ""}` : ""}${showMenu ? " menu-open" : ""}`} style={sceneStyle}>
      <div className="scene-vignette" /><div className="constellation constellation-a" /><div className="constellation constellation-b" />
      <div className="orbit orbit-one" /><div className="orbit orbit-two" />
      <div className="dust" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      <div className="set-watermark" aria-hidden="true">{selectedPack?.setName || "NS"}</div>

      <section className="gacha-shell" aria-label={arcadeConfig.brandLabel}>
        <header className="gacha-header">
          <div className="header-left">
            {mode === "altar" && phase === "sealed" && packChosen && !prizeLock
              ? <button className="edge-control vault-trigger back-trigger" aria-label="Zurück zum Booster-Karussell" onClick={() => { setPackChosen(false); setTearProgress(0); }}><span className="edge-icon"><AppIcon name="back" /></span><b>BACK</b></button>
              : <button className="edge-control vault-trigger" aria-label="Booster-Auswahl öffnen" aria-expanded={showMenu} onClick={() => setShowMenu(true)} disabled={mode !== "altar" || Boolean(prizeLock)}><span className="edge-icon"><AppIcon name="menu" /></span><b>BOOSTERS</b></button>}
          </div>
          <div className="wordmark" aria-label={arcadeConfig.brandLabel}>{arcadeConfig.brandLead}<span>{arcadeConfig.brandAccent}</span><small>{arcadeConfig.brandTagline}</small></div>
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

          {mode === "altar" && selectedPack && dataReady && phase === "sealed" && !packChosen && <PackCarousel key={selectedPack.setName} art={packMuse.image} setName={selectedPack.setName} cost={selectedPack.cost} cards={selectedPack.odds.cardsPerPack} onTick={() => { void playUiTap(); packHaptic(); }} onChoose={() => { setPackChosen(true); void startMusic(); }} />}

          {mode === "altar" && selectedPack && packChosen && (phase === "sealed" || phase === "opening") && (
            <div className="pack-presentation">
              <div className="pack-halo" />
              <aside className="pack-side pack-side-left" aria-label="Featured adult card artwork">
                <img src={sideMuse.image} alt="" />
                <span><small>TONIGHT&apos;S BADDIE</small><b>{sideMuse.character}</b><em>{sideMuse.setName} · {sideMuse.rarity}</em></span>
              </aside>
              <button className={`pack-wrapper ${phase === "opening" ? "is-opening" : ""}`} style={{ "--tear": tearProgress, "--pack-art": `url(${packMuse.image})` } as CSSProperties} onClick={onPackClick} onPointerDown={onPackPointerDown} onPointerMove={onPackPointerMove} onPointerUp={onPackPointerUp} onPointerCancel={() => { tearStart.current = null; setTearProgress(0); }} disabled={!dataReady || phase === "opening" || !canAfford} aria-label={`${selectedPack.setName} Booster öffnen`}>
                <span className="pack-card-stack" aria-hidden="true"><i /><i /><b>GS</b></span>
                {(["body", "top"] as const).map((part) => <span key={part} className={`pack-face pack-face-${part}`} aria-hidden="true">
                <img className="pack-hero-art" src={packMuse.image} alt="" draggable={false} />
                <span className="foil-color" /><span className="foil-shimmer" />
                <span className="pack-copy"><span className="pack-series">GODDESS</span><span className="pack-series pack-series-outline">STORY</span><span className="pack-subtitle">VIRTUAL BOOSTER</span></span>
                <PackSigil />
                <span className="pack-cover-tag">COVER GIRL · {packMuse.character}</span>
                <span className="pack-code">{selectedPack.setName}</span>
                <span className="pack-edition">{selectedPack.cost} YUAN · {selectedPack.odds.cardsPerPack} CARDS</span>
                </span>)}
                <span className="tear-handle"><i /><b aria-hidden="true">← ✦ →</b></span>
              </button>
              <aside className="pack-side pack-side-right" aria-label="Selected booster profile">
                <img src={rivalMuse.image} alt="" />
                <div className="pack-profile-copy"><small>BOOSTER PROFILE</small><b>{selectedPack.setName}</b><strong>{selectedPack.odds.cardsPerPack}<i>CARDS</i></strong><p>{recipe?.pattern || `${selectedPack.cost} Yuan pack`}</p><em>FEAT. {rivalMuse.character}</em></div>
              </aside>
              <p className="gesture-hint">Swipe the seam <span>or tap</span></p>
              {phase === "opening" && <p className="opening-copy"><span>✦</span> HERE WE GO</p>}
            </div>
          )}

          {mode === "altar" && phase === "revealing" && active && (
            <div className={`reveal-stage rarity-tier-${rarityTier(active.rarity)} direction-${direction} ${transitioning ? "is-transitioning" : ""} ${activeIndex === freshIndex ? `fresh-hit hit-${hitNonce % 2}` : ""}`}>
              {rarityTier(active.rarity) >= 3 && <div className="hit-backdrop" aria-hidden="true"><img src={cardImage(active)} alt="" /></div>}
              <div className="reveal-halo" />
              {activeIndex === freshIndex && <div key={`${active.id}-${hitNonce}`} className={`reveal-burst burst-tier-${rarityTier(active.rarity)}`} aria-hidden="true"><i /><i /><i /><i /><strong>{active.rarity}</strong><b>{rarityTier(active.rarity) >= 4 ? "GODDESS HIT!" : rarityTier(active.rarity) >= 3 ? "JACKPOT PULL!" : rarityTier(active.rarity) >= 2 ? "SHINY!" : ""}<small>{rarityTier(active.rarity) >= 2 ? active.character : ""}</small></b></div>}
              <div className="reveal-index"><b>{String(activeIndex + 1).padStart(2, "0")}</b><span>/ {String(pack.length).padStart(2, "0")}</span><i>CARD</i></div>
              <PackStack cards={pack.map(card => ({ id: card.id, image: cardImage(card), character: card.character, rarity: card.rarity, color: rarityColor(card.rarity) }))} activeIndex={activeIndex} onNext={nextCard} onPrevious={previousCard} onInspect={() => setInspectorOpen(true)} onPeek={() => { void playPeek(); }} />
              <button className="nav-orb nav-previous" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); previousCard(); } }} onClick={(event) => { if (event.detail === 0) previousCard(); }} disabled={activeIndex === 0} aria-label="Vorherige Karte">←</button>
              <button className="nav-orb nav-next" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); nextCard(); } }} onClick={(event) => { if (event.detail === 0) nextCard(); }} aria-label={activeIndex === pack.length - 1 ? "Pack ansehen" : "Nächste Karte"}>→</button>
              <div className="pull-caption" aria-live="polite" aria-atomic="true"><b style={{ color: rarityColor(active.rarity) }}>{active.rarity}</b><span><strong>{active.character || "Unknown character"}</strong><small>{active.title}</small></span></div>
              <div className="pull-trail" aria-label="Cards in this pack">{pack.map((card, index) => <button key={`${card.id}-${index}`} disabled={index > revealedThrough} aria-label={index <= revealedThrough ? `Card ${index + 1}: ${card.rarity} ${card.character}` : `Card ${index + 1}: unrevealed`} aria-current={index === activeIndex ? "step" : undefined} onClick={() => navigateCard(index)} style={{ "--pull-color": index <= revealedThrough ? rarityColor(card.rarity) : "#604568" } as CSSProperties}><i />{index <= revealedThrough ? card.rarity : "·"}</button>)}</div>
              <button className="detail-hint" onClick={() => setInspectorOpen(true)}><span>Swipe to reveal · Tap for details</span></button>
              {activeIndex === freshIndex && rarityTier(active.rarity) >= 3 && <div key={`confetti-${hitNonce}`} className="pull-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--angle": `${i * 30}deg`, "--flight": `${110 + (i % 3) * 40}px`, "--delay": `${(i % 3) * 35}ms` } as CSSProperties} />)}</div>}
            </div>
          )}

          {mode === "altar" && phase === "summary" && pack.length > 0 && (
            <div className="pack-summary">
              <div className="summary-heading">
                <span>BOOSTER COMPLETE · {pack.length} CARDS</span>
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
                  <div key={`${card.id}-${index}`} className="summary-slot" style={{ "--card-color": rarityColor(card.rarity), "--delay": `${index * 45}ms` } as CSSProperties}>
                    <button className="summary-art" onClick={() => { setActiveIndex(index); setRevealedThrough(pack.length - 1); setFreshIndex(-1); revealedRef.current = pack.length - 1; setDirection(1); setTransitioning(false); setPhase("revealing"); setInspectorOpen(true); }} aria-label={`${card.rarity} ${card.character} anzeigen`}>
                      <img src={cardImage(card)} alt={`${card.rarity}-${card.number} ${card.character}`} /><b>{card.rarity}</b>
                    </button>
                    <div className="summary-meta">
                      <span>{formatYuan(valueFen(card.id, card.rarity))} ¥</span>
                      <button className="summary-sell" disabled={soldIndexes.has(index)} onClick={() => sellFromPack(index)}>{soldIndexes.has(index) ? "Verkauft" : "Verkaufen"}</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="primary-action summary-footer-action" onClick={prizeLock ? returnToGame : resetForAnother}><span>{prizeLock ? `BACK TO ${prizeReturnTitle}` : "OPEN ANOTHER"}</span><i><AppIcon name={prizeLock ? "back" : "replay"} /></i></button>
            </div>
          )}
        </div>

        {mode === "altar" && selectedPack && (packChosen || phase !== "sealed") && (
          <div className={`set-anchor ${prizeLock ? "is-prize" : ""}`}><span className="anchor-kicker">{prizeLock ? `${prizeReturnTitle} PRIZE · LOCKED` : "SELECTED BOOSTER"}</span><button onClick={() => canChangeSet ? setShowMenu(true) : setShowInfo(true)}><b>{selectedPack.setName}</b><span>{groupLabels[selectedPack.group] || selectedPack.group} · {selectedPack.odds.cardsPerPack} cards</span></button><small>{opened.toLocaleString("de-DE")} packs opened</small></div>
        )}
        {mode === "altar" && (phase !== "sealed" || packChosen) && <div className="action-dock">
          {phase === "sealed" && !canAfford && <p className="funds-hint">Nicht genug Yuan · <Link href="/store">Store</Link></p>}
          {phase === "sealed" && <button className="primary-action" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); void openPack(); } }} onClick={(event) => { if (event.detail === 0) void openPack(); }} disabled={!dataReady || !canAfford}><span>{usingVoucher ? "RIP WITH VOUCHER" : "RIP THIS BOOSTER"}<small>{selectedPack ? `${selectedPack.cost} ¥` : ""}</small></span><i><AppIcon name="pack" /></i></button>}
          {phase === "opening" && <div className="opening-meter"><i /><span>DEALING YOUR CARDS</span></div>}
          {phase === "revealing" && <button className="primary-action next-action" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); nextCard(); } }} onClick={(event) => { if (event.detail === 0) nextCard(); }}><span>{activeIndex === pack.length - 1 ? "SHOW FULL PACK" : "NEXT CARD"}<small>{activeIndex + 1} / {pack.length}</small></span><i><AppIcon name="arrow" /></i></button>}
          {phase === "summary" && <button className="primary-action" onClick={prizeLock ? returnToGame : resetForAnother}><span>{prizeLock ? `BACK TO ${prizeReturnTitle}` : "OPEN ANOTHER"}</span><i><AppIcon name={prizeLock ? "back" : "replay"} /></i></button>}
        </div>}

        {mode === "altar" && active && phase === "revealing" && inspectorOpen && (
          <aside className="card-inspector is-open" aria-hidden={false}>
            <button className="inspector-close" onClick={() => setInspectorOpen(false)} aria-label="Kartendetails schließen">×</button>
            <div className="inspector-rarity" style={{ color: rarityColor(active.rarity) }}><span>{active.rarity}</span><i /></div>
            <span className="inspector-kicker">CARD {activeIndex + 1} · {selectedPack?.setName}</span><h2>{active.character || "Unknown Goddess"}</h2><p>{active.title || "Goddess Story"}</p>
            <dl><div><dt>Set</dt><dd>{active.set_name}</dd></div><div><dt>Card no.</dt><dd>{active.number}</dd></div><div><dt>Rarity</dt><dd>{active.rarity}</dd></div><div><dt>Wert</dt><dd>{formatYuan(valueFen(active.id, active.rarity))} ¥</dd></div><div><dt>Position</dt><dd>{activeIndex + 1} / {pack.length}</dd></div></dl>
            <button className="inspector-sell" disabled={soldIndexes.has(activeIndex)} onClick={() => sellFromPack(activeIndex)}>{soldIndexes.has(activeIndex) ? "Bereits verkauft" : `Für ${formatYuan(valueFen(active.id, active.rarity))} ¥ verkaufen`}</button>
            <button className="inspector-next" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); nextCard(); } }} onClick={(event) => { if (event.detail === 0) nextCard(); }}>{activeIndex === pack.length - 1 ? "Pack ansehen" : "Nächste Karte"}<span>→</span></button>
          </aside>
        )}

        <aside className={`pack-drawer ${showMenu ? "is-open" : ""}`} aria-hidden={!showMenu}>
          <div className="drawer-head"><div><span>GODDESS STORY // PACK MENU</span><b>Choose a booster</b></div><button onClick={() => setShowMenu(false)} aria-label="Pack Vault schließen">×</button></div>
          {!canChangeSet && <p className="vault-lock">{prizeLock ? "Minigame prizes stay locked until opened." : "Finish this booster first."}</p>}
          <input className="pack-search" type="search" placeholder="Set suchen…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="group-tabs">{groupOptions.map((group) => <button key={group} className={activeGroup === group ? "active" : ""} onClick={() => setGroupFilter(group)}>{groupLabels[group] || group}</button>)}</div>
          <div className="drawer-list">
            {filteredCatalog.map((item) => {
              const record = sets.find((set) => set.name === item.setName);
              const itemCover = cardAsset(record?.images?.[0]);
              return <button key={item.id} className={`drawer-pack ${selectedPack?.id === item.id ? "is-active" : ""}`} onClick={() => selectPack(item)} disabled={!canChangeSet}>{itemCover ? <img src={itemCover} alt="" /> : <span className="cover-fallback">✦</span>}<span><b>{item.setName}</b><small>{item.odds.cardsPerPack} cards · {item.boostersCount} packs</small></span><em>{item.cost} ¥</em></button>;
            })}
          </div>
        </aside>
        {showMenu && <button className="drawer-backdrop" aria-label="Pack Vault schließen" onClick={() => setShowMenu(false)} />}
      </section>

      {showInfo && selectedPack && recipe && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowInfo(false)}>
          <section className="odds-modal" role="dialog" aria-modal="true" aria-labelledby="odds-title">
            <button className="modal-close" onClick={() => setShowInfo(false)} aria-label="Schließen">×</button>
            <span className="odds-kicker">PHYSICAL-STYLE COLLATION · {groupLabels[selectedPack.group]}</span><h2 id="odds-title">{selectedPack.setName}</h2><p className="odds-pattern">{recipe.pattern}</p>
            <p className="odds-intro">Jeder Booster wird in festen Positionsgruppen aufgebaut. Die Box-Verteilung läuft unsichtbar im Hintergrund, damit einzelne Packs spannend bleiben und sich trotzdem wie echte Goddess-Story-Produkte verhalten.</p>
            <div className="odds-grid">{targetRows.map((row) => <div key={row.rarity} style={{ "--chip": rarityColor(row.rarity) } as CSSProperties}><b>{row.rarity}</b><span>Ø {(row.perBox / selectedPack.boostersCount).toLocaleString("de-DE", { maximumFractionDigits: 3 })} pro Booster</span></div>)}</div>
            <div className="collation-notes"><p><b>Keine normalen Doppelbilder:</b> Innerhalb eines Boosters wird jede exakte Karten-ID ohne Zurücklegen gezogen.</p><p><b>Pull order bleibt echt:</b> Base-, Shine- und Hit-Slots werden nicht nach Rarity nachsortiert.</p>{selectedPack.odds.bonus.length > 0 && <p><b>Bonus-Packs:</b> PR/Bonus-Karten bleiben Box-Beigaben und werden nicht künstlich in normale Booster gemischt.</p>}</div>
          </section>
        </div>
      )}
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
