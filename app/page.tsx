"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
import { LuckyShrine, type WaifuMuse } from "./lucky-shrine";
import { TemptationDuel } from "./temptation-duel";
import { useGachaAudio } from "./use-gacha-audio";

type Card = {
  id: number;
  number: string;
  rarity: string;
  ord: number;
  set_name: string;
  character: string;
  title: string;
  image_path: string | null;
  image_missing?: boolean;
};

type SetRecord = { name: string; group: string; images: string[] };
type CardDatabase = { cards: Card[]; sets: SetRecord[] };
type PackCatalog = { packs: PackConfig[] };
type Phase = "sealed" | "opening" | "revealing" | "summary";
type ExperienceMode = "altar" | "shrine" | "duel";

declare global {
  interface Window { CARD_LISTER_DB?: CardDatabase }
}

const DATABASE_URL = arcadeConfig.cardDatabaseUrl;
const CATALOG_URL = "/pack-configs.json";
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

const groupLabels: Record<string, string> = {
  "1 юань": "1 Yuan",
  "2 юаня": "2 Yuan",
  "5 юаней": "5 Yuan",
  "10 юаней": "10 Yuan",
  "Суприм": "Supreme",
};

const rarityColors: Record<string, string> = {
  R: "#9895a0", SR: "#c8c5d0", CR: "#68ddef", FR: "#ff8dc9", SCR: "#ac88ff",
  SSR: "#ffd36e", SER: "#ff778d", GR: "#7df0b3", PTR: "#5de9ff", PR: "#f2d36b",
  MR: "#ff5da4", ZR: "#bf78ff", XR: "#ff71d0", SP: "#ff8a63", BW: "#ffffff",
  RDM: "#ff3d6d", INS: "#67ead1", BHR: "#f6a05c", SD: "#73adff", SSD: "#b77dff",
  SZR: "#ff59d8", UR: "#ff955e", ACR: "#ff7cbd", HR: "#7ce4ff", MTL: "#e4b871",
  WTR: "#7de9d4", TGR: "#ed8c60", TR: "#ff9880", LSP: "#e7d8ff", JNH: "#f2b4de",
};

function cardImage(card: Card) { return cardAsset(card.image_path); }
function rarityColor(rarity: string) { return rarityColors[rarity] || "#b18aff"; }
function rarityClass(rarity: string) { return rarity.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
function groupClass(group?: string) {
  if (group === "1 юань") return "tier-one";
  if (group === "2 юаня") return "tier-two";
  if (group === "5 юаней") return "tier-five";
  if (group === "10 юаней") return "tier-ten";
  return "tier-supreme";
}
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
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [catalog, setCatalog] = useState<PackConfig[]>([]);
  const [dbStatus, setDbStatus] = useState<"loading" | "ready" | "error">("loading");
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedPack, setSelectedPack] = useState<PackConfig | null>(null);
  const [collation, setCollation] = useState<CollationState | null>(null);
  const [opened, setOpened] = useState(0);
  const [pack, setPack] = useState<Card[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealedThrough, setRevealedThrough] = useState(-1);
  const [phase, setPhase] = useState<Phase>("sealed");
  const [mode, setMode] = useState<ExperienceMode>("altar");
  const [prizeLock, setPrizeLock] = useState<PackConfig | null>(null);
  const [prizeReturnMode, setPrizeReturnMode] = useState<"shrine" | "duel">("shrine");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [groupFilter, setGroupFilter] = useState("2 юаня");
  const [search, setSearch] = useState("");
  const [tearProgress, setTearProgress] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [transitioning, setTransitioning] = useState(false);
  const [freshIndex, setFreshIndex] = useState(-1);
  const [hitNonce, setHitNonce] = useState(0);
  const sequence = useRef(0);
  const tearStart = useRef<number | null>(null);
  const dragged = useRef(false);
  const suppressClick = useRef(false);
  const swipeStart = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const revealedRef = useRef(-1);
  const navigationTimer = useRef<number | null>(null);
  const {
    muted,
    musicEnabled,
    toggleMuted,
    toggleMusic,
    startMusic,
    playFoil,
    playTear,
    playCardTravel,
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

  useEffect(() => {
    fetch(CATALOG_URL)
      .then((response) => {
        if (!response.ok) throw new Error("catalog");
        return response.json() as Promise<PackCatalog>;
      })
      .then((data) => {
        setCatalog(data.packs);
        setSelectedPack(data.packs.find((item) => item.setName === "NS-02-M16") || data.packs[0]);
        setCatalogStatus("ready");
      })
      .catch(() => setCatalogStatus("error"));

    const acceptDatabase = () => {
      const database = window.CARD_LISTER_DB;
      if (!database?.cards?.length || !database?.sets?.length) return false;
      setAllCards(database.cards.filter((card) => !card.image_missing && Boolean(card.image_path)));
      setSets(database.sets);
      setDbStatus("ready");
      return true;
    };

    if (acceptDatabase()) return;
    let script = document.querySelector<HTMLScriptElement>(`script[src="${DATABASE_URL}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = DATABASE_URL;
      script.async = true;
      document.head.appendChild(script);
    }
    const onLoad = () => { if (!acceptDatabase()) setDbStatus("error"); };
    const onError = () => setDbStatus("error");
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    return () => {
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, []);

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
      setPhase("sealed");
      setInspectorOpen(false);
      setTearProgress(0);
      setGenerationError("");
    }, 0);
    return () => window.clearTimeout(sync);
  }, [recipe, selectedPack]);

  const active = pack[activeIndex];
  const dataReady = dbStatus === "ready" && catalogStatus === "ready" && Boolean(selectedPack && recipe && collation);
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
    if (!pack[index] || transitioning || index === activeIndex) return;
    const nextDirection: 1 | -1 = index > activeIndex ? 1 : -1;
    const fresh = index > revealedRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tier = rarityTier(pack[index].rarity);
    const travelTime = reducedMotion ? 20 : tier >= 4 && fresh ? 720 : tier >= 3 && fresh ? 560 : 390;

    if (fresh) {
      revealedRef.current = index;
    }
    if (fresh) void playReveal(pack[index].rarity);
    else void playCardTravel();
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
    if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current);
    navigationTimer.current = window.setTimeout(() => {
      setTransitioning(false);
      navigationTimer.current = null;
    }, travelTime);
  }, [activeIndex, pack, playCardTravel, playReveal, transitioning]);

  const nextCard = useCallback(() => {
    if (transitioning) return;
    if (activeIndex >= pack.length - 1) {
      const highest = pack.reduce((value, card) => Math.max(value, rarityTier(card.rarity)), 0);
      void playSummary(highest);
      setInspectorOpen(false);
      setPhase("summary");
      return;
    }
    navigateCard(activeIndex + 1);
  }, [activeIndex, navigateCard, pack, playSummary, transitioning]);

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
    if (!selectedPack || !recipe || !collation || !dataReady || phase !== "sealed" || mode !== "altar") return;
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

    const nextOpened = opened + 1;
    void playTear();
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
    window.localStorage.setItem(collationKey(selectedPack.setName), JSON.stringify(draw.state));
    window.localStorage.setItem(openedKey(selectedPack.setName), String(nextOpened));

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void preloadCards(result);
    await new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 30 : 1100));
    if (sequence.current !== token) return;
    revealedRef.current = 0;
    void playReveal(result[0].rarity);
    flushSync(() => {
      setPhase("revealing");
      setRevealedThrough(0);
      setFreshIndex(0);
      setHitNonce((value) => value + 1);
    });
  }, [collation, dataReady, getPool, mode, opened, phase, playReveal, playTear, recipe, selectedPack, startMusic]);

  const onPackPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!(event.target as HTMLElement).closest(".tear-handle")) return;
    tearStart.current = event.clientX;
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    void playFoil();
  };
  const onPackPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (tearStart.current === null) return;
    const distance = Math.max(0, event.clientX - tearStart.current);
    if (distance > 6) dragged.current = true;
    setTearProgress(Math.min(1, distance / 150));
  };
  const onPackPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (tearStart.current === null) return;
    const finalProgress = Math.min(1, Math.max(0, event.clientX - tearStart.current) / 150);
    const shouldOpen = dragged.current && finalProgress >= 0.58;
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
  };
  const selectPack = (item: PackConfig) => {
    if (!canChangeSet) return;
    setSelectedPack(item);
    setGroupFilter(item.group);
    setShowMenu(false);
  };
  const claimGamePrize = (item: PackConfig, source: "shrine" | "duel") => {
    sequence.current += 1;
    setPrizeReturnMode(source);
    setPrizeLock(item);
    setSelectedPack(item);
    setGroupFilter(item.group);
    setMode("altar");
    setPack([]);
    setActiveIndex(0);
    setRevealedThrough(-1);
    setFreshIndex(-1);
    revealedRef.current = -1;
    setInspectorOpen(false);
    setTearProgress(0);
    setPhase("sealed");
  };
  const claimShrinePrize = (item: PackConfig) => claimGamePrize(item, "shrine");
  const claimDuelPrize = (item: PackConfig) => claimGamePrize(item, "duel");
  const returnToGame = () => {
    resetForAnother();
    setPrizeLock(null);
    setMode(prizeReturnMode);
  };
  const switchMode = (next: ExperienceMode) => {
    if (phase === "opening" || phase === "revealing" || prizeLock) return;
    void playUiTap();
    void startMusic();
    if (phase === "summary") resetForAnother();
    setMode(next);
    setShowMenu(false);
    setShowInfo(false);
  };

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalog.filter((item) => item.group === groupFilter && (!query || item.setName.toLowerCase().includes(query)));
  }, [catalog, groupFilter, search]);
  const targetRows = useMemo(() => (
    recipe && selectedPack
      ? recipeRarityTargets(recipe, selectedPack).sort((left, right) => rarityTier(left.rarity) - rarityTier(right.rarity))
      : []
  ), [recipe, selectedPack]);
  const sceneStyle = active && phase === "revealing"
    ? { "--rarity-color": rarityColor(active.rarity) } as CSSProperties
    : undefined;

  return (
    <main className={`gacha-stage ${palette} phase-${phase} mode-${mode}`} style={sceneStyle}>
      <div className="scene-vignette" /><div className="constellation constellation-a" /><div className="constellation constellation-b" />
      <div className="orbit orbit-one" /><div className="orbit orbit-two" />
      <div className="dust" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      <div className="set-watermark" aria-hidden="true">{selectedPack?.setName || "NS"}</div>

      <section className="gacha-shell" aria-label={arcadeConfig.brandLabel}>
        <header className="gacha-header">
          <div className="header-left">
            <button className="edge-control vault-trigger" aria-label="Booster-Auswahl öffnen" aria-expanded={showMenu} onClick={() => setShowMenu(true)} disabled={mode !== "altar" || Boolean(prizeLock)}><span className="hamburger"><i /><i /></span><b>BOOSTER MENU</b></button>
          </div>
          <div className="wordmark" aria-label={arcadeConfig.brandLabel}>{arcadeConfig.brandLead}<span>{arcadeConfig.brandAccent}</span><small>{arcadeConfig.brandTagline}</small></div>
          <div className="header-actions">
            <button className="edge-control music-control" aria-label={musicEnabled ? "Musik ausschalten" : "Musik einschalten"} aria-pressed={musicEnabled} onClick={() => void toggleMusic()}><span>♫</span><b>{musicEnabled ? "MUSIC ON" : "MUSIC OFF"}</b></button>
            <button className="edge-control sound-control" aria-label={muted ? "Sound einschalten" : "Sound ausschalten"} aria-pressed={!muted} onClick={() => void toggleMuted()}><span>{muted ? "◇" : "◈"}</span><b>{muted ? "SOUND OFF" : "SOUND ON"}</b></button>
            <button className="edge-control" onClick={() => setShowInfo(true)} disabled={!selectedPack}><span>◎</span><b>PULL RATES</b></button>
          </div>
        </header>

        <nav className="experience-switch" aria-label="Spielmodus">
          <button className={mode === "altar" ? "is-active" : ""} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); switchMode("altar"); } }} onClick={(event) => { if (event.detail === 0) switchMode("altar"); }} disabled={phase === "opening" || phase === "revealing" || Boolean(prizeLock)}><span>01</span><b>OPEN PACKS</b><small>pick your poison</small></button>
          <button className={mode === "shrine" ? "is-active" : ""} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); switchMode("shrine"); } }} onClick={(event) => { if (event.detail === 0) switchMode("shrine"); }} disabled={phase === "opening" || phase === "revealing" || Boolean(prizeLock)}><span>02</span><b>WAIFU 21</b><small>beat the dealer</small><i>BONUS GAME</i></button>
          <button className={mode === "duel" ? "is-active" : ""} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); switchMode("duel"); } }} onClick={(event) => { if (event.detail === 0) switchMode("duel"); }} disabled={phase === "opening" || phase === "revealing" || Boolean(prizeLock)}><span>03</span><b>HEARTLOCK</b><small>choose your prize</small><i>NEW GAME</i></button>
        </nav>

        <div className="experience" aria-live="polite">
          {!dataReady && dbStatus !== "error" && catalogStatus !== "error" && <div className="loading-state"><span className="loader-sigil" />Goddess-Story-Archiv wird geladen…</div>}
          {(dbStatus === "error" || catalogStatus === "error") && <div className="error-card"><b>Archiv nicht erreichbar</b><span>Pack- oder Kartendaten konnten nicht geladen werden.</span></div>}
          {generationError && <div className="generation-error">{generationError}</div>}

          {mode === "shrine" && dataReady && (
            <LuckyShrine
              catalog={catalog}
              ready={dataReady}
              muses={shrineDealerCards}
              onClaim={claimShrinePrize}
              playDrop={playShrineDrop}
              playBounce={playShrineBounce}
              playWin={playShrineWin}
            />
          )}

          {mode === "duel" && dataReady && (
            <TemptationDuel
              catalog={catalog}
              ready={dataReady}
              muses={shrineDealerCards}
              onClaim={claimDuelPrize}
              startMusic={startMusic}
              playLock={playDuelLock}
              playUiTap={playUiTap}
              playStart={playDuelStart}
              playLoss={playDuelLoss}
              playWin={playShrineWin}
            />
          )}

          {mode === "altar" && selectedPack && (phase === "sealed" || phase === "opening") && (
            <div className="pack-presentation">
              <div className="pack-halo" />
              <aside className="pack-side pack-side-left" aria-label="Featured adult card artwork">
                <img src={sideMuse.image} alt="" />
                <span><small>TONIGHT&apos;S BADDIE</small><b>{sideMuse.character}</b><em>{sideMuse.setName} · {sideMuse.rarity}</em></span>
              </aside>
              <button className={`pack-wrapper ${phase === "opening" ? "is-opening" : ""}`} style={{ "--tear": tearProgress, "--pack-art": `url(${packMuse.image})` } as CSSProperties} onClick={onPackClick} onPointerDown={onPackPointerDown} onPointerMove={onPackPointerMove} onPointerUp={onPackPointerUp} onPointerCancel={() => { tearStart.current = null; setTearProgress(0); }} disabled={!dataReady || phase === "opening"} aria-label={`${selectedPack.setName} Booster öffnen`}>
                <span className="pack-card-stack" aria-hidden="true"><i /><i /><b>GS</b></span>
                <img className="foil-texture" src="/booster-foil.webp" alt="" />
                <img className="pack-hero-art" src={packMuse.image} alt="" />
                <span className="foil-color" /><span className="foil-shimmer" />
                <span className="pack-rip-seam" aria-hidden="true" />
                <span className="pack-rip-piece pack-rip-piece-left" aria-hidden="true"><i /></span>
                <span className="pack-rip-piece pack-rip-piece-right" aria-hidden="true"><i /></span>
                <span className="pack-copy"><span className="pack-series">GODDESS</span><span className="pack-series pack-series-outline">STORY</span><span className="pack-subtitle">VIRTUAL BOOSTER</span></span>
                <PackSigil />
                <span className="pack-cover-tag">COVER GIRL · {packMuse.character}</span>
                <span className="pack-code">{selectedPack.setName}</span>
                <span className="pack-edition">{selectedPack.cost} YUAN · {selectedPack.odds.cardsPerPack} CARDS</span>
                <span className="tear-handle"><i /><b>SLIDE TO RIP</b></span>
              </button>
              <aside className="pack-side pack-side-right" aria-label="Selected booster profile">
                <img src={rivalMuse.image} alt="" />
                <div className="pack-profile-copy"><small>BOOSTER PROFILE</small><b>{selectedPack.setName}</b><strong>{selectedPack.odds.cardsPerPack}<i>CARDS</i></strong><p>{recipe?.pattern || `${selectedPack.cost} Yuan pack`}</p><em>FEAT. {rivalMuse.character}</em></div>
              </aside>
              <p className="gesture-hint">Swipe the tab <span>or tap to rip</span></p>
              {phase === "opening" && <p className="opening-copy"><span>✦</span> FOIL RIPPED — CARDS LOADING</p>}
            </div>
          )}

          {mode === "altar" && phase === "revealing" && active && (
            <div className={`reveal-stage rarity-tier-${rarityTier(active.rarity)} direction-${direction} ${transitioning ? "is-transitioning" : ""} ${activeIndex === freshIndex ? `fresh-hit hit-${hitNonce % 2}` : ""}`}>
              {rarityTier(active.rarity) >= 3 && <div className="hit-backdrop" aria-hidden="true"><img src={cardImage(active)} alt="" /></div>}
              <div className="reveal-halo" />
              {activeIndex === freshIndex && <div key={`${active.id}-${hitNonce}`} className={`reveal-burst burst-tier-${rarityTier(active.rarity)}`} aria-hidden="true"><i /><i /><i /><i /><strong>{active.rarity}</strong><b>{rarityTier(active.rarity) >= 4 ? "GODDESS HIT!" : rarityTier(active.rarity) >= 3 ? "JACKPOT PULL!" : rarityTier(active.rarity) >= 2 ? "SHINY!" : ""}<small>{rarityTier(active.rarity) >= 2 ? active.character : ""}</small></b></div>}
              <div className="reveal-index"><b>{String(activeIndex + 1).padStart(2, "0")}</b><span>/ {String(pack.length).padStart(2, "0")}</span><i>CARD</i></div>
              <div className="card-deck">
                {pack.map((card, index) => {
                  const delta = index - activeIndex;
                  if (Math.abs(delta) > 1) return null;
                  const current = delta === 0;
                  const visible = index <= revealedThrough;
                  return (
                    <button
                      key={`${card.id}-${index}`}
                      className={`card-plane ${current ? "is-current" : delta < 0 ? "is-before" : "is-after"} rarity-${rarityClass(card.rarity)}`}
                      tabIndex={current ? 0 : -1}
                      aria-hidden={!current}
                      aria-label={current ? `${card.rarity} ${card.character}: Details anzeigen` : undefined}
                      onClick={() => { if (!current) return; if (didSwipe.current) { didSwipe.current = false; return; } setInspectorOpen(true); }}
                      onPointerDown={(event) => { if (!current) return; didSwipe.current = false; swipeStart.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.classList.add("is-dragging"); }}
                      onPointerUp={(event) => { if (!current || swipeStart.current === null) return; const deltaX = event.clientX - swipeStart.current; swipeStart.current = null; event.currentTarget.classList.remove("is-dragging"); event.currentTarget.style.removeProperty("--drag-x"); event.currentTarget.style.removeProperty("--drag-rot"); try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ } if (Math.abs(deltaX) > 72) { didSwipe.current = true; event.preventDefault(); if (deltaX < 0) nextCard(); else previousCard(); } }}
                      onPointerCancel={(event) => { swipeStart.current = null; event.currentTarget.classList.remove("is-dragging"); event.currentTarget.style.removeProperty("--drag-x"); event.currentTarget.style.removeProperty("--drag-rot"); }}
                      onPointerMove={(event) => { if (!current) return; const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--mx", `${(event.clientX - rect.left) / rect.width * 100}%`); event.currentTarget.style.setProperty("--my", `${(event.clientY - rect.top) / rect.height * 100}%`); if (swipeStart.current !== null) { const dragX = Math.max(-150, Math.min(150, event.clientX - swipeStart.current)); event.currentTarget.style.setProperty("--drag-x", `${dragX}px`); event.currentTarget.style.setProperty("--drag-rot", `${dragX / 32}deg`); } }}
                      onTransitionEnd={(event) => { if (current && transitioning && event.propertyName === "transform") setTransitioning(false); }}
                    >
                      <span className="card-body">
                        {visible ? <img src={cardImage(card)} alt={current ? `${card.rarity}-${card.number} ${card.character}` : ""} /> : <span className="digital-card-back"><PackSigil /><b>GODDESS STORY</b><i>{String(index + 1).padStart(2, "0")}</i></span>}
                        {current && rarityTier(card.rarity) >= 2 && <span className="card-holo" />}
                        {current && rarityTier(card.rarity) >= 3 && <span className="card-spark"><i /><i /><i /></span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button className="nav-orb nav-previous" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); previousCard(); } }} onClick={(event) => { if (event.detail === 0) previousCard(); }} disabled={activeIndex === 0 || transitioning} aria-label="Vorherige Karte">←</button>
              <button className="nav-orb nav-next" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); nextCard(); } }} onClick={(event) => { if (event.detail === 0) nextCard(); }} disabled={transitioning} aria-label={activeIndex === pack.length - 1 ? "Pack ansehen" : "Nächste Karte"}>→</button>
              <div className="progress-rail" aria-label={`${activeIndex + 1} von ${pack.length} Karten`}>{pack.map((card, index) => <i key={`${card.id}-${index}`} className={index <= revealedThrough ? "is-revealed" : ""} />)}</div>
              <button className="detail-hint" onClick={() => setInspectorOpen(true)}><b>{active.rarity}</b><span>TAP CARD FOR DETAILS</span></button>
            </div>
          )}

          {mode === "altar" && phase === "summary" && pack.length > 0 && (
            <div className="pack-summary">
              <div className="summary-heading"><span>BOOSTER COMPLETE</span><h1>{selectedPack?.setName}</h1><p>Every card, in the order you pulled it.</p></div>
              <div className={`summary-grid summary-${pack.length}`}>
                {pack.map((card, index) => (
                  <button key={`${card.id}-${index}`} style={{ "--card-color": rarityColor(card.rarity), "--delay": `${index * 45}ms` } as CSSProperties} onClick={() => { setActiveIndex(index); setRevealedThrough(pack.length - 1); setFreshIndex(-1); revealedRef.current = pack.length - 1; setDirection(1); setTransitioning(false); setPhase("revealing"); setInspectorOpen(true); }} aria-label={`${card.rarity} ${card.character} anzeigen`}>
                    <img src={cardImage(card)} alt={`${card.rarity}-${card.number} ${card.character}`} /><b>{card.rarity}</b>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {mode === "altar" && selectedPack && (
          <div className={`set-anchor ${prizeLock ? "is-prize" : ""}`}><span className="anchor-kicker">{prizeLock ? `${prizeReturnMode === "duel" ? "HEARTLOCK" : "WAIFU 21"} PRIZE · LOCKED` : "SELECTED BOOSTER"}</span><button onClick={() => canChangeSet ? setShowMenu(true) : setShowInfo(true)}><b>{selectedPack.setName}</b><span>{groupLabels[selectedPack.group] || selectedPack.group} · {selectedPack.odds.cardsPerPack} cards</span></button><small>{opened.toLocaleString("de-DE")} packs opened</small></div>
        )}
        {mode === "altar" && <div className="action-dock">
          {phase === "sealed" && <button className="primary-action" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); void openPack(); } }} onClick={(event) => { if (event.detail === 0) void openPack(); }} disabled={!dataReady}><span>RIP THIS BOOSTER</span><i>↗</i></button>}
          {phase === "opening" && <div className="opening-meter"><i /><span>DEALING YOUR CARDS</span></div>}
          {phase === "revealing" && <button className="primary-action next-action" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); nextCard(); } }} onClick={(event) => { if (event.detail === 0) nextCard(); }} disabled={transitioning}><span>{transitioning ? "DEALING…" : activeIndex === pack.length - 1 ? "SHOW FULL PACK" : "NEXT CARD"}</span><i>→</i></button>}
          {phase === "summary" && <button className="primary-action" onClick={prizeLock ? returnToGame : resetForAnother}><span>{prizeLock ? `BACK TO ${prizeReturnMode === "duel" ? "HEARTLOCK" : "WAIFU 21"}` : "OPEN ANOTHER"}</span><i>{prizeLock ? "←" : "↻"}</i></button>}
        </div>}

        {mode === "altar" && active && phase === "revealing" && inspectorOpen && (
          <aside className="card-inspector is-open" aria-hidden={false}>
            <button className="inspector-close" onClick={() => setInspectorOpen(false)} aria-label="Kartendetails schließen">×</button>
            <div className="inspector-rarity" style={{ color: rarityColor(active.rarity) }}><span>{active.rarity}</span><i /></div>
            <span className="inspector-kicker">CARD {activeIndex + 1} · {selectedPack?.setName}</span><h2>{active.character || "Unknown Goddess"}</h2><p>{active.title || "Goddess Story"}</p>
            <dl><div><dt>Set</dt><dd>{active.set_name}</dd></div><div><dt>Card no.</dt><dd>{active.number}</dd></div><div><dt>Rarity</dt><dd>{active.rarity}</dd></div><div><dt>Position</dt><dd>{activeIndex + 1} / {pack.length}</dd></div></dl>
            <button className="inspector-next" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); nextCard(); } }} onClick={(event) => { if (event.detail === 0) nextCard(); }}>{activeIndex === pack.length - 1 ? "Pack ansehen" : "Nächste Karte"}<span>→</span></button>
          </aside>
        )}

        <aside className={`pack-drawer ${showMenu ? "is-open" : ""}`} aria-hidden={!showMenu}>
          <div className="drawer-head"><div><span>GODDESS STORY // PACK MENU</span><b>Choose a booster</b></div><button onClick={() => setShowMenu(false)} aria-label="Pack Vault schließen">×</button></div>
          {!canChangeSet && <p className="vault-lock">{prizeLock ? "Waifu-21 prizes stay locked until opened." : "Finish this booster first."}</p>}
          <input className="pack-search" type="search" placeholder="Set suchen…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="group-tabs">{groupOptions.map((group) => <button key={group} className={groupFilter === group ? "active" : ""} onClick={() => setGroupFilter(group)}>{groupLabels[group] || group}</button>)}</div>
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
    </main>
  );
}
