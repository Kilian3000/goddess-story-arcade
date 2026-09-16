export const ARCADE_META_KEY = "goddess-arcade-meta-v1";
export const SESSION_OPENS_KEY = "goddess-session-opens-v1";
export const ARCADE_META_EVENT = "goddess-arcade-meta-change";

export const MAX_CHASE = 3;
export const MAX_SHRINE = 9;
export const MAX_PULLS = 24;
export const WONDER_CAP = 2;
export const WONDER_RECHARGE_MS = 12 * 60 * 60 * 1000;
export const DAILY_PACK_MS = 12 * 60 * 60 * 1000;
export const PITY_CHARGED = 20;
export const PITY_ARM = 28;
export const RAIN_AFTER_OPENS = 5;
export const RAIN_MIN_FEN = 8;
export const RAIN_MAX_FEN = 20;
export const OMIKUJI_MS = 12 * 60 * 60 * 1000;
export const CANDLE_MS = 24 * 60 * 60 * 1000;
export const NIGHT_OFFER_MS = 12 * 60 * 60 * 1000;
export const REVERSE_READY_MS = 12 * 60 * 60 * 1000;
export const MAX_REVERSE = 2;
export const SESSION_STAMPS_KEY = "goddess-session-stamps-v1";
export const SESSION_GHOST_KEY = "goddess-session-ghost-v1";
export const STAMP_RAIN_NEED = 4;

export type PullSource = "altar" | "daily" | "prize" | "battle" | "lastpack" | "gacha" | "godpack";

export type PullRecord = {
  id: string;
  setName: string;
  costYuan: number;
  cardIds: number[];
  openedAt: number;
  bestFen: number;
  source: PullSource;
};

export type ArcadeMeta = {
  version: 1;
  chaseCardIds: number[];
  shrineCardIds: number[];
  pulls: PullRecord[];
  pityBySet: Record<string, number>;
  dailyPackAt: number | null;
  wonderCharges: number;
  wonderAt: number | null;
  skillClaims: Record<string, string[]>;
  achievements: string[];
  pickedWonderIds: string[];
  setClears: string[];
  omikujiAt: number | null;
  omikujiId: string | null;
  oshiCharacter: string | null;
  oshiNews: number;
  candleUntil: number | null;
  godPacks: number;
  reverseBoards: ReverseBoard[];
  yearbook: YearbookPage[];
  nightOffer: NightOffer | null;
  detectiveKeys: string[];
};

export type ReverseBoard = {
  id: string;
  cardIds: number[];
  readyAt: number;
  setName: string;
};

export type YearbookPage = {
  character: string;
  unlockedAt: number;
  firstNewId: number;
};

export type NightOffer = {
  setName: string;
  targetId: number;
  payIds: number[];
  createdAt: number;
};

export const ACHIEVEMENTS = [
  { id: "first-rip", title: "First Rip", blurb: "Erstes Pack aufgerissen" },
  { id: "first-new", title: "New Ink", blurb: "Erste neue Karte" },
  { id: "first-clear", title: "Set Bound", blurb: "Ein Set vollständig" },
  { id: "pack-battle-win", title: "Battle Queen", blurb: "Pack Battle gewonnen" },
  { id: "shrine-full", title: "Altar Lit", blurb: "Schrein mit 9 Karten" },
  { id: "packs-100", title: "Century", blurb: "100 Packs geöffnet" },
  { id: "chase-hit", title: "Chased Down", blurb: "Chase-Karte gezogen" },
  { id: "candle-lit", title: "Candle Lit", blurb: "Opferkerze entzündet" },
  { id: "god-pack", title: "God Pack", blurb: "Ein ganzes Pack glänzt" },
  { id: "purikura", title: "Print Club", blurb: "Erster Purikura-Streifen" },
  { id: "yearbook", title: "Yearbook", blurb: "Eine Figur komplett" },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];

export function createArcadeMeta(now = 0): ArcadeMeta {
  return {
    version: 1,
    chaseCardIds: [],
    shrineCardIds: [],
    pulls: [],
    pityBySet: {},
    dailyPackAt: null,
    wonderCharges: WONDER_CAP,
    wonderAt: now || null,
    skillClaims: {},
    achievements: [],
    pickedWonderIds: [],
    setClears: [],
    omikujiAt: null,
    omikujiId: null,
    oshiCharacter: null,
    oshiNews: 0,
    candleUntil: null,
    godPacks: 0,
    reverseBoards: [],
    yearbook: [],
    nightOffer: null,
    detectiveKeys: [],
  };
}

function asIdList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const item of value) {
    const id = Number(item);
    if (!Number.isInteger(id) || id < 0 || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function asPulls(value: unknown): PullRecord[] {
  if (!Array.isArray(value)) return [];
  const pulls: PullRecord[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<PullRecord>;
    const cardIds = Array.isArray(item.cardIds)
      ? item.cardIds.map(Number).filter((id) => Number.isInteger(id) && id >= 0)
      : [];
    if (!item.id || !item.setName || !cardIds.length) continue;
    const source = item.source;
    pulls.push({
      id: String(item.id),
      setName: String(item.setName),
      costYuan: Number(item.costYuan) || 0,
      cardIds,
      openedAt: Number(item.openedAt) || 0,
      bestFen: Number(item.bestFen) || 0,
      source: source === "daily" || source === "prize" || source === "battle" || source === "lastpack" || source === "gacha" || source === "godpack" ? source : "altar",
    });
    if (pulls.length >= MAX_PULLS) break;
  }
  return pulls;
}

function asCountMap(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const count = Number(raw);
    if (Number.isInteger(count) && count >= 0) next[key] = count;
  }
  return next;
}

function asSkillClaims(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, string[]> = {};
  for (const [day, games] of Object.entries(value as Record<string, unknown>)) {
    next[day] = asStringList(games);
  }
  return next;
}

export function rechargeWonder(meta: ArcadeMeta, now: number): ArcadeMeta {
  if (meta.wonderCharges >= WONDER_CAP) {
    return { ...meta, wonderAt: meta.wonderAt ?? now };
  }
  const from = meta.wonderAt ?? now;
  const gained = Math.floor(Math.max(0, now - from) / WONDER_RECHARGE_MS);
  if (gained <= 0) return meta;
  return {
    ...meta,
    wonderCharges: Math.min(WONDER_CAP, meta.wonderCharges + gained),
    wonderAt: from + gained * WONDER_RECHARGE_MS,
  };
}

export function parseArcadeMeta(raw: unknown, now = 0): ArcadeMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<ArcadeMeta>;
  if (value.version !== 1) return null;
  const parsed: ArcadeMeta = {
    version: 1,
    chaseCardIds: asIdList(value.chaseCardIds, MAX_CHASE),
    shrineCardIds: asIdList(value.shrineCardIds, MAX_SHRINE),
    pulls: asPulls(value.pulls),
    pityBySet: asCountMap(value.pityBySet),
    dailyPackAt: Number.isFinite(Number(value.dailyPackAt)) ? Number(value.dailyPackAt) : null,
    wonderCharges: Math.max(0, Math.min(WONDER_CAP, Math.floor(Number(value.wonderCharges) || 0))),
    wonderAt: Number.isFinite(Number(value.wonderAt)) ? Number(value.wonderAt) : null,
    skillClaims: asSkillClaims(value.skillClaims),
    achievements: asStringList(value.achievements),
    pickedWonderIds: asStringList(value.pickedWonderIds),
    setClears: asStringList(value.setClears),
    omikujiAt: Number.isFinite(Number(value.omikujiAt)) ? Number(value.omikujiAt) : null,
    omikujiId: typeof value.omikujiId === "string" && value.omikujiId ? value.omikujiId : null,
    oshiCharacter: typeof value.oshiCharacter === "string" && value.oshiCharacter ? value.oshiCharacter : null,
    oshiNews: Math.max(0, Math.floor(Number(value.oshiNews) || 0)),
    candleUntil: Number.isFinite(Number(value.candleUntil)) ? Number(value.candleUntil) : null,
    godPacks: Math.max(0, Math.floor(Number(value.godPacks) || 0)),
    reverseBoards: asReverseBoards(value.reverseBoards),
    yearbook: asYearbook(value.yearbook),
    nightOffer: asNightOffer(value.nightOffer),
    detectiveKeys: asStringList(value.detectiveKeys),
  };
  return rechargeWonder(parsed, now);
}

function asReverseBoards(value: unknown): ReverseBoard[] {
  if (!Array.isArray(value)) return [];
  const boards: ReverseBoard[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<ReverseBoard>;
    const cardIds = Array.isArray(item.cardIds)
      ? item.cardIds.map(Number).filter((id) => Number.isInteger(id) && id >= 0)
      : [];
    if (!item.id || cardIds.length < 5) continue;
    boards.push({
      id: String(item.id),
      cardIds,
      readyAt: Number(item.readyAt) || 0,
      setName: String(item.setName || "REVERSE"),
    });
    if (boards.length >= MAX_REVERSE) break;
  }
  return boards;
}

function asYearbook(value: unknown): YearbookPage[] {
  if (!Array.isArray(value)) return [];
  const pages: YearbookPage[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<YearbookPage>;
    if (!item.character) continue;
    pages.push({
      character: String(item.character),
      unlockedAt: Number(item.unlockedAt) || 0,
      firstNewId: Number(item.firstNewId) || 0,
    });
  }
  return pages;
}

function asNightOffer(value: unknown): NightOffer | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<NightOffer>;
  const payIds = Array.isArray(item.payIds)
    ? item.payIds.map(Number).filter((id) => Number.isInteger(id) && id >= 0)
    : [];
  if (!item.setName || !Number.isInteger(Number(item.targetId)) || !payIds.length) return null;
  return {
    setName: String(item.setName),
    targetId: Number(item.targetId),
    payIds,
    createdAt: Number(item.createdAt) || 0,
  };
}

export function cloneMeta(meta: ArcadeMeta): ArcadeMeta {
  return {
    version: 1,
    chaseCardIds: [...meta.chaseCardIds],
    shrineCardIds: [...meta.shrineCardIds],
    pulls: meta.pulls.map((pull) => ({ ...pull, cardIds: [...pull.cardIds] })),
    pityBySet: { ...meta.pityBySet },
    dailyPackAt: meta.dailyPackAt,
    wonderCharges: meta.wonderCharges,
    wonderAt: meta.wonderAt,
    skillClaims: Object.fromEntries(Object.entries(meta.skillClaims).map(([day, games]) => [day, [...games]])),
    achievements: [...meta.achievements],
    pickedWonderIds: [...meta.pickedWonderIds],
    setClears: [...meta.setClears],
    omikujiAt: meta.omikujiAt,
    omikujiId: meta.omikujiId,
    oshiCharacter: meta.oshiCharacter,
    oshiNews: meta.oshiNews,
    candleUntil: meta.candleUntil,
    godPacks: meta.godPacks,
    reverseBoards: meta.reverseBoards.map((board) => ({ ...board, cardIds: [...board.cardIds] })),
    yearbook: meta.yearbook.map((page) => ({ ...page })),
    nightOffer: meta.nightOffer ? { ...meta.nightOffer, payIds: [...meta.nightOffer.payIds] } : null,
    detectiveKeys: [...meta.detectiveKeys],
  };
}

export function todayKey(now = Date.now()) {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function toggleChase(meta: ArcadeMeta, cardId: number) {
  const next = cloneMeta(meta);
  const index = next.chaseCardIds.indexOf(cardId);
  if (index >= 0) next.chaseCardIds.splice(index, 1);
  else if (next.chaseCardIds.length < MAX_CHASE) next.chaseCardIds.push(cardId);
  return next;
}

export function setShrineSlot(meta: ArcadeMeta, slot: number, cardId: number | null) {
  const next = cloneMeta(meta);
  const filled = [...next.shrineCardIds];
  if (slot < 0 || slot >= MAX_SHRINE) return next;
  while (filled.length < MAX_SHRINE) filled.push(-1);
  if (cardId == null) filled[slot] = -1;
  else {
    const existing = filled.indexOf(cardId);
    if (existing >= 0) filled[existing] = -1;
    filled[slot] = cardId;
  }
  next.shrineCardIds = filled.filter((id) => id >= 0);
  return next;
}

export function placeOnShrine(meta: ArcadeMeta, cardId: number) {
  const next = cloneMeta(meta);
  if (next.shrineCardIds.includes(cardId) || next.shrineCardIds.length >= MAX_SHRINE) return next;
  next.shrineCardIds = [...next.shrineCardIds, cardId];
  return next;
}

export function removeFromShrine(meta: ArcadeMeta, cardId: number) {
  const next = cloneMeta(meta);
  next.shrineCardIds = next.shrineCardIds.filter((id) => id !== cardId);
  return next;
}

export function recordPulls(
  meta: ArcadeMeta,
  pulls: Omit<PullRecord, "id">[],
  pityBySet: Record<string, number>,
) {
  const next = cloneMeta(meta);
  const stamped = pulls.map((pull, index) => ({
    ...pull,
    id: `${pull.openedAt}-${pull.setName}-${index}-${pull.cardIds[0]}`,
  }));
  next.pulls = [...stamped, ...next.pulls].slice(0, MAX_PULLS);
  next.pityBySet = { ...next.pityBySet, ...pityBySet };
  return next;
}

export function setPity(meta: ArcadeMeta, setName: string, count: number) {
  const next = cloneMeta(meta);
  next.pityBySet[setName] = Math.max(0, count);
  return next;
}

export function canDailyPack(meta: ArcadeMeta, now = Date.now()) {
  return !meta.dailyPackAt || now - meta.dailyPackAt >= DAILY_PACK_MS;
}

export function markDailyPack(meta: ArcadeMeta, now = Date.now()) {
  const next = cloneMeta(meta);
  next.dailyPackAt = now;
  return next;
}

export function dailyRemainingMs(meta: ArcadeMeta, now = Date.now()) {
  if (canDailyPack(meta, now)) return 0;
  return Math.max(0, (meta.dailyPackAt || 0) + DAILY_PACK_MS - now);
}

export function hasSkillClaim(meta: ArcadeMeta, gameId: string, now = Date.now()) {
  const day = todayKey(now);
  return (meta.skillClaims[day] || []).includes(gameId);
}

export function markSkillClaim(meta: ArcadeMeta, gameId: string, now = Date.now()) {
  const next = cloneMeta(meta);
  const day = todayKey(now);
  const current = next.skillClaims[day] || [];
  if (!current.includes(gameId)) next.skillClaims[day] = [...current, gameId];
  return next;
}

export function skillConsolationFen(costYuan: number) {
  return Math.min(50, Math.max(10, Math.round(10 * costYuan)));
}

export function spendWonder(meta: ArcadeMeta, pullId: string, now = Date.now()) {
  const charged = rechargeWonder(meta, now);
  if (charged.wonderCharges < 1 || charged.pickedWonderIds.includes(pullId)) return { ok: false as const };
  const next = cloneMeta(charged);
  next.wonderCharges -= 1;
  next.wonderAt = next.wonderAt ?? now;
  next.pickedWonderIds = [...next.pickedWonderIds, pullId].slice(-48);
  return { ok: true as const, state: next };
}

export function wonderBoards(meta: ArcadeMeta, minCards = 5, now = Date.now()) {
  const pulls = meta.pulls.filter((pull) => (
    pull.cardIds.length >= minCards
    && !meta.pickedWonderIds.includes(pull.id)
    && pull.source !== "battle"
  ));
  const reverse = meta.reverseBoards
    .filter((board) => board.cardIds.length >= minCards && board.readyAt <= now && !meta.pickedWonderIds.includes(board.id))
    .map((board): PullRecord => ({
      id: board.id,
      setName: board.setName,
      costYuan: 0,
      cardIds: board.cardIds,
      openedAt: board.readyAt,
      bestFen: 0,
      source: "altar",
    }));
  return [...reverse, ...pulls];
}

export function canOmikuji(meta: ArcadeMeta, now = Date.now()) {
  return !meta.omikujiAt || now - meta.omikujiAt >= OMIKUJI_MS;
}

export function markOmikuji(meta: ArcadeMeta, id: string, now = Date.now()) {
  const next = cloneMeta(meta);
  next.omikujiAt = now;
  next.omikujiId = id;
  return next;
}

export function candleLit(meta: ArcadeMeta, now = Date.now()) {
  return Boolean(meta.candleUntil && meta.candleUntil > now);
}

export function lightCandle(meta: ArcadeMeta, now = Date.now()) {
  const next = cloneMeta(meta);
  next.candleUntil = now + CANDLE_MS;
  return next;
}

export function setOshi(meta: ArcadeMeta, character: string | null) {
  const next = cloneMeta(meta);
  next.oshiCharacter = character;
  if (character !== meta.oshiCharacter) next.oshiNews = 0;
  return next;
}

export function bumpOshiNews(meta: ArcadeMeta, character: string) {
  if (!meta.oshiCharacter || meta.oshiCharacter !== character) return { hit: false as const, state: meta, milestone: 0 };
  const next = cloneMeta(meta);
  next.oshiNews += 1;
  const milestone = next.oshiNews === 3 || next.oshiNews === 7 || next.oshiNews === 12 ? next.oshiNews : 0;
  return { hit: true as const, state: next, milestone };
}

export function bumpGodPacks(meta: ArcadeMeta) {
  const next = cloneMeta(meta);
  next.godPacks += 1;
  return next;
}

export function placeReverseBoard(meta: ArcadeMeta, cardIds: number[], setName: string, now = Date.now()) {
  if (cardIds.length < 5 || meta.reverseBoards.length >= MAX_REVERSE) return { ok: false as const, state: meta };
  const next = cloneMeta(meta);
  next.reverseBoards = [...next.reverseBoards, {
    id: `reverse-${now}-${cardIds[0]}`,
    cardIds: cardIds.slice(0, 5),
    readyAt: now + REVERSE_READY_MS,
    setName,
  }];
  return { ok: true as const, state: next };
}

export function addYearbookPage(meta: ArcadeMeta, character: string, firstNewId: number, now = Date.now()) {
  if (meta.yearbook.some((page) => page.character === character)) return { ok: false as const, state: meta };
  const next = cloneMeta(meta);
  next.yearbook = [...next.yearbook, { character, unlockedAt: now, firstNewId }];
  return { ok: true as const, state: next };
}

export function setNightOffer(meta: ArcadeMeta, offer: NightOffer | null) {
  const next = cloneMeta(meta);
  next.nightOffer = offer;
  return next;
}

export function nightOfferFresh(meta: ArcadeMeta, now = Date.now()) {
  if (!meta.nightOffer) return false;
  return now - meta.nightOffer.createdAt < NIGHT_OFFER_MS;
}

export function detectiveKey(setName: string, boxNumber: number) {
  return `${setName}:${boxNumber}`;
}

export function hasDetectiveGuess(meta: ArcadeMeta, setName: string, boxNumber: number) {
  return meta.detectiveKeys.includes(detectiveKey(setName, boxNumber));
}

export function markDetectiveGuess(meta: ArcadeMeta, setName: string, boxNumber: number) {
  const key = detectiveKey(setName, boxNumber);
  if (meta.detectiveKeys.includes(key)) return meta;
  const next = cloneMeta(meta);
  next.detectiveKeys = [...next.detectiveKeys, key].slice(-48);
  return next;
}

export function skillClaimCount(meta: ArcadeMeta, gameId: string, now = Date.now()) {
  const day = todayKey(now);
  return (meta.skillClaims[day] || []).filter((id) => id === gameId || id.startsWith(`${gameId}:`)).length;
}

export function bumpSkillClaim(meta: ArcadeMeta, gameId: string, now = Date.now()) {
  const next = cloneMeta(meta);
  const day = todayKey(now);
  const current = next.skillClaims[day] || [];
  const count = skillClaimCount(meta, gameId, now);
  next.skillClaims[day] = [...current, count === 0 ? gameId : `${gameId}:${count + 1}`];
  return next;
}

export function unlockAchievement(meta: ArcadeMeta, id: AchievementId) {
  if (meta.achievements.includes(id)) return meta;
  const next = cloneMeta(meta);
  next.achievements.push(id);
  return next;
}

export function markSetClear(meta: ArcadeMeta, setName: string) {
  if (meta.setClears.includes(setName)) return { ok: false as const, state: meta };
  const next = cloneMeta(meta);
  next.setClears.push(setName);
  return { ok: true as const, state: next };
}

export function pityState(count: number) {
  if (count >= PITY_ARM) return "armed" as const;
  if (count >= PITY_CHARGED) return "charged" as const;
  return "idle" as const;
}

export function readStoredMeta(now = Date.now()) {
  try {
    const raw = window.localStorage.getItem(ARCADE_META_KEY);
    return parseArcadeMeta(raw ? JSON.parse(raw) : null, now) ?? createArcadeMeta(now);
  } catch {
    return createArcadeMeta(now);
  }
}

export function writeStoredMeta(meta: ArcadeMeta) {
  window.localStorage.setItem(ARCADE_META_KEY, JSON.stringify(meta));
  window.dispatchEvent(new Event(ARCADE_META_EVENT));
}

export function subscribeArcadeMeta(onChange: () => void) {
  window.addEventListener(ARCADE_META_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ARCADE_META_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readMetaSnapshot() {
  try {
    return window.localStorage.getItem(ARCADE_META_KEY) ?? "";
  } catch {
    return "";
  }
}

export function metaFromSnapshot(raw: string, now = Date.now()) {
  try {
    return parseArcadeMeta(raw ? JSON.parse(raw) : null, now) ?? createArcadeMeta(now);
  } catch {
    return createArcadeMeta(now);
  }
}

export function readSessionOpens() {
  try {
    return Math.max(0, Number(window.sessionStorage.getItem(SESSION_OPENS_KEY) || 0) || 0);
  } catch {
    return 0;
  }
}

export function writeSessionOpens(count: number) {
  window.sessionStorage.setItem(SESSION_OPENS_KEY, String(count));
}

export function bumpSessionOpens() {
  const next = readSessionOpens() + 1;
  writeSessionOpens(next);
  return next;
}

export function rainFen(random = Math.random) {
  return RAIN_MIN_FEN + Math.floor(random() * (RAIN_MAX_FEN - RAIN_MIN_FEN + 1));
}

export function shouldRain(opens: number, hit: boolean) {
  return hit || opens > 0 && opens % RAIN_AFTER_OPENS === 0;
}

export function readSessionStamps() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STAMPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function stampGroup(group: string) {
  const current = readSessionStamps();
  if (current.includes(group)) return { stamps: current, filled: false };
  const next = [...current, group];
  window.sessionStorage.setItem(SESSION_STAMPS_KEY, JSON.stringify(next));
  return { stamps: next, filled: current.length < STAMP_RAIN_NEED && next.length >= STAMP_RAIN_NEED };
}

export function readGhostBreak() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_GHOST_KEY);
    return raw !== "0";
  } catch {
    return true;
  }
}

export function writeGhostBreak(on: boolean) {
  window.sessionStorage.setItem(SESSION_GHOST_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(ARCADE_META_EVENT));
}
