export const FEN_PER_YUAN = 100;
export const STARTING_BALANCE_YUAN = 20;
export const STARTING_BALANCE_FEN = STARTING_BALANCE_YUAN * FEN_PER_YUAN;
export const FALLBACK_RARITY_YUAN = 1;
export const ECONOMY_STORAGE_KEY = "goddess-economy-v1";
export const PENDING_TOPUP_KEY = "goddess-pending-topup-v1";
export const PRIZE_LOCK_KEY = "goddess-prize-lock-v1";
export const RARITY_VALUES_URL = "/economy/rarity-values.json";
export const CARD_VALUES_URL = "/economy/card-values.csv";

export type VoucherCost = 1 | 2;

export type EconomyState = {
  version: 1;
  balanceFen: number;
  packsOpenedSinceTopup: number;
  cards: Record<string, number>;
  vouchers: { 1: number; 2: number };
  stats: {
    packsOpened: number;
    yuanSpentFen: number;
    yuanEarnedFen: number;
  };
};

export type StoreSku = {
  id: string;
  yuan: number;
  euro: number;
  baseline: number;
};

export type PendingTopup = {
  yuan: number;
  euro: number;
};

export const MINIGAME_IDS = [
  "waifu21",
  "heartlock",
  "crash",
  "roulette",
  "mines",
  "jackpot",
  "coinflip",
  "upgrader",
] as const;

export type MinigameId = (typeof MINIGAME_IDS)[number];

const LEGACY_MINIGAME_IDS: Record<string, MinigameId> = {
  shrine: "waifu21",
  duel: "heartlock",
};

export function isMinigameId(value: string): value is MinigameId {
  return (MINIGAME_IDS as readonly string[]).includes(value);
}

export function normalizeMinigameId(value: string | null | undefined): MinigameId | null {
  if (!value) return null;
  if (LEGACY_MINIGAME_IDS[value]) return LEGACY_MINIGAME_IDS[value];
  return isMinigameId(value) ? value : null;
}

export type PrizeLockRecord = {
  packId: number;
  returnMode: MinigameId;
};

export type RarityValueFile = {
  fallbackYuan?: number;
  values?: Record<string, number>;
};

export type PriceTable = {
  byId: Map<number, number>;
  rarityYuan: Record<string, number>;
  fallbackYuan: number;
};

export const STORE_SKUS: StoreSku[] = [
  { id: "10", yuan: 10, euro: 1, baseline: 0.95 },
  { id: "50", yuan: 50, euro: 5, baseline: 0.8 },
  { id: "120", yuan: 120, euro: 10, baseline: 0.5 },
  { id: "250", yuan: 250, euro: 20, baseline: 0.3 },
  { id: "750", yuan: 750, euro: 50, baseline: 0.1 },
  { id: "2000", yuan: 2000, euro: 100, baseline: 0.02 },
];

export const TRADE_RULES = {
  R: { excess: 50, voucherCost: 1 as VoucherCost },
  SR: { excess: 5, voucherCost: 2 as VoucherCost },
};

export function yuanToFen(yuan: number) {
  return Math.round(yuan * FEN_PER_YUAN);
}

export function fenToYuan(fen: number) {
  return fen / FEN_PER_YUAN;
}

export function formatYuan(fen: number, locale = "de-DE") {
  return fenToYuan(fen).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function createEconomyState(): EconomyState {
  return {
    version: 1,
    balanceFen: STARTING_BALANCE_FEN,
    packsOpenedSinceTopup: 0,
    cards: {},
    vouchers: { 1: 0, 2: 0 },
    stats: { packsOpened: 0, yuanSpentFen: 0, yuanEarnedFen: 0 },
  };
}

function cloneState(state: EconomyState): EconomyState {
  return {
    version: 1,
    balanceFen: state.balanceFen,
    packsOpenedSinceTopup: state.packsOpenedSinceTopup,
    cards: { ...state.cards },
    vouchers: { 1: state.vouchers[1], 2: state.vouchers[2] },
    stats: { ...state.stats },
  };
}

function asCountMap(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const cards: Record<string, number> = {};
  for (const [id, count] of Object.entries(value as Record<string, unknown>)) {
    const amount = Number(count);
    if (Number.isInteger(amount) && amount > 0) cards[id] = amount;
  }
  return cards;
}

export function parseEconomyState(raw: unknown): EconomyState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<EconomyState>;
  if (value.version !== 1) return null;
  const balanceFen = Number(value.balanceFen);
  const packsOpenedSinceTopup = Number(value.packsOpenedSinceTopup);
  if (!Number.isFinite(balanceFen) || balanceFen < 0) return null;
  if (!Number.isInteger(packsOpenedSinceTopup) || packsOpenedSinceTopup < 0) return null;
  const vouchers = value.vouchers ?? { 1: 0, 2: 0 };
  const one = Number(vouchers[1]) || 0;
  const two = Number(vouchers[2]) || 0;
  const stats = value.stats ?? { packsOpened: 0, yuanSpentFen: 0, yuanEarnedFen: 0 };
  return {
    version: 1,
    balanceFen: Math.round(balanceFen),
    packsOpenedSinceTopup,
    cards: asCountMap(value.cards),
    vouchers: { 1: Math.max(0, Math.floor(one)), 2: Math.max(0, Math.floor(two)) },
    stats: {
      packsOpened: Math.max(0, Math.floor(Number(stats.packsOpened) || 0)),
      yuanSpentFen: Math.max(0, Math.round(Number(stats.yuanSpentFen) || 0)),
      yuanEarnedFen: Math.max(0, Math.round(Number(stats.yuanEarnedFen) || 0)),
    },
  };
}

export function cardCount(state: EconomyState, cardId: number) {
  return state.cards[String(cardId)] || 0;
}

export function parseRarityValues(raw: unknown): { rarityYuan: Record<string, number>; fallbackYuan: number } {
  const file = (raw && typeof raw === "object" ? raw : {}) as RarityValueFile;
  const rarityYuan: Record<string, number> = {};
  for (const [rarity, yuan] of Object.entries(file.values ?? {})) {
    const amount = Number(yuan);
    if (Number.isFinite(amount) && amount >= 0) rarityYuan[rarity] = amount;
  }
  const fallbackYuan = Number(file.fallbackYuan);
  return {
    rarityYuan,
    fallbackYuan: Number.isFinite(fallbackYuan) && fallbackYuan >= 0 ? fallbackYuan : FALLBACK_RARITY_YUAN,
  };
}

export function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

export function parseCardValuesCsv(text: string) {
  const byId = new Map<number, number>();
  const rows = parseCsvRows(text);
  const header = rows.shift() || [];
  const idIndex = header.indexOf("id");
  const valueIndex = header.indexOf("value_yuan");
  if (idIndex < 0 || valueIndex < 0) return byId;
  for (const row of rows) {
    const id = Number(row[idIndex]);
    const yuan = Number(row[valueIndex]);
    if (!Number.isFinite(id) || !Number.isFinite(yuan)) continue;
    byId.set(id, yuanToFen(yuan));
  }
  return byId;
}

export function emptyPriceTable(): PriceTable {
  return { byId: new Map(), rarityYuan: {}, fallbackYuan: FALLBACK_RARITY_YUAN };
}

export function cardValueFen(
  cardId: number,
  rarity: string,
  prices: PriceTable,
) {
  const override = prices.byId.get(cardId);
  if (override !== undefined) return override;
  const rarityYuan = prices.rarityYuan[rarity];
  if (rarityYuan !== undefined) return yuanToFen(rarityYuan);
  return yuanToFen(prices.fallbackYuan);
}

export function voucherForCost(costYuan: number): VoucherCost | null {
  if (costYuan === 1 || costYuan === 2) return costYuan;
  return null;
}

export function canOpenPack(state: EconomyState, costYuan: number) {
  const voucher = voucherForCost(costYuan);
  if (voucher && state.vouchers[voucher] > 0) return true;
  return state.balanceFen >= yuanToFen(costYuan);
}

export function addCardsToCollection(state: EconomyState, cardIds: number[]) {
  const next = cloneState(state);
  for (const cardId of cardIds) {
    const key = String(cardId);
    next.cards[key] = (next.cards[key] || 0) + 1;
  }
  return next;
}

export function canSpendFen(state: EconomyState, fen: number) {
  const amount = Math.round(fen);
  return Number.isFinite(amount) && amount > 0 && state.balanceFen >= amount;
}

export function spendFen(state: EconomyState, fen: number) {
  const amount = Math.round(fen);
  if (!canSpendFen(state, amount)) return { ok: false as const };
  const next = cloneState(state);
  next.balanceFen -= amount;
  next.stats.yuanSpentFen += amount;
  return { ok: true as const, state: next };
}

export function creditFen(state: EconomyState, fen: number) {
  const amount = Math.round(fen);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false as const };
  const next = cloneState(state);
  next.balanceFen += amount;
  next.stats.yuanEarnedFen += amount;
  return { ok: true as const, state: next };
}

export function countedCardIds(cardIds: number[]) {
  const needed = new Map<number, number>();
  for (const cardId of cardIds) {
    if (!Number.isInteger(cardId) || cardId < 0) continue;
    needed.set(cardId, (needed.get(cardId) || 0) + 1);
  }
  return needed;
}

export function canRemoveCards(state: EconomyState, cardIds: number[]) {
  for (const [cardId, count] of countedCardIds(cardIds)) {
    if (cardCount(state, cardId) < count) return false;
  }
  return cardIds.length > 0;
}

export function removeCards(state: EconomyState, cardIds: number[]) {
  if (!canRemoveCards(state, cardIds)) return { ok: false as const };
  const next = cloneState(state);
  for (const [cardId, count] of countedCardIds(cardIds)) {
    const key = String(cardId);
    const remain = (next.cards[key] || 0) - count;
    if (remain <= 0) delete next.cards[key];
    else next.cards[key] = remain;
  }
  return { ok: true as const, state: next };
}

export function chargePack(state: EconomyState, costYuan: number) {
  if (!canOpenPack(state, costYuan)) return { ok: false as const };
  const next = cloneState(state);
  const voucher = voucherForCost(costYuan);
  let usedVoucher: VoucherCost | null = null;
  if (voucher && next.vouchers[voucher] > 0) {
    next.vouchers[voucher] -= 1;
    usedVoucher = voucher;
  } else {
    const fen = yuanToFen(costYuan);
    next.balanceFen -= fen;
    next.stats.yuanSpentFen += fen;
  }
  next.packsOpenedSinceTopup += 1;
  next.stats.packsOpened += 1;
  return { ok: true as const, usedVoucher, state: next };
}

export function finalizeOpenedPack(state: EconomyState, costYuan: number, cardIds: number[]) {
  const charged = chargePack(state, costYuan);
  if (!charged.ok) return charged;
  return {
    ok: true as const,
    usedVoucher: charged.usedVoucher,
    state: addCardsToCollection(charged.state, cardIds),
  };
}

// Build the entire purchase in memory; callers persist only a successful batch.
export function canOpenPacks(state: EconomyState, costYuan: number, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 10) return false;
  const voucher = voucherForCost(costYuan);
  const paid = Math.max(0, count - (voucher ? state.vouchers[voucher] : 0));
  return costYuan > 0 && Number.isFinite(costYuan) && state.balanceFen >= yuanToFen(costYuan) * paid;
}

export function finalizeOpenedPacks(state: EconomyState, costYuan: number, packs: number[][]) {
  if (!canOpenPacks(state, costYuan, packs.length) || packs.some(pack => !pack.length)) return { ok: false as const };
  let next = state;
  for (const cards of packs) {
    const result = finalizeOpenedPack(next, costYuan, cards);
    if (!result.ok) return { ok: false as const };
    next = result.state;
  }
  return { ok: true as const, state: next };
}

export function sellCard(state: EconomyState, cardId: number, valueFen: number) {
  const key = String(cardId);
  const count = state.cards[key] || 0;
  if (count < 1 || valueFen < 0) return { ok: false as const };
  const next = cloneState(state);
  if (count === 1) delete next.cards[key];
  else next.cards[key] = count - 1;
  next.balanceFen += valueFen;
  next.stats.yuanEarnedFen += valueFen;
  return { ok: true as const, state: next };
}

export type RarityLookup = (cardId: number) => string | undefined;

export function excessCopies(state: EconomyState, rarityOf: RarityLookup, rarity: string) {
  let excess = 0;
  for (const [id, count] of Object.entries(state.cards)) {
    if (rarityOf(Number(id)) === rarity) excess += Math.max(0, count - 1);
  }
  return excess;
}

export function tradeExcess(state: EconomyState, rarityOf: RarityLookup, rarity: "R" | "SR") {
  const rule = TRADE_RULES[rarity];
  if (excessCopies(state, rarityOf, rarity) < rule.excess) return { ok: false as const };
  const next = cloneState(state);
  const owned = Object.entries(next.cards)
    .map(([id, count]) => ({ id: Number(id), count }))
    .filter((row) => rarityOf(row.id) === rarity && row.count > 1)
    .sort((left, right) => right.count - left.count || left.id - right.id);
  let remain = rule.excess;
  for (const row of owned) {
    const take = Math.min(remain, row.count - 1);
    const key = String(row.id);
    next.cards[key] = row.count - take;
    remain -= take;
    if (remain === 0) break;
  }
  next.vouchers[rule.voucherCost] += 1;
  return { ok: true as const, state: next };
}

export function storeSuccessChance(baseline: number, packsOpenedSinceTopup: number) {
  return Math.min(1, Math.round((baseline + 0.01 * packsOpenedSinceTopup) * 100) / 100);
}

export function resolveTopup(
  sku: StoreSku,
  packsOpenedSinceTopup: number,
  random: () => number = Math.random,
) {
  const chance = storeSuccessChance(sku.baseline, packsOpenedSinceTopup);
  return { approved: random() < chance, chance };
}

export function applyTopup(state: EconomyState, yuan: number) {
  const next = cloneState(state);
  next.balanceFen += yuanToFen(yuan);
  next.packsOpenedSinceTopup = 0;
  return next;
}

export function readStoredEconomy() {
  try {
    const raw = window.localStorage.getItem(ECONOMY_STORAGE_KEY);
    return parseEconomyState(raw ? JSON.parse(raw) : null) ?? createEconomyState();
  } catch {
    return createEconomyState();
  }
}

export const ECONOMY_CHANGE_EVENT = "goddess-economy-change";
export const PENDING_TOPUP_EVENT = "goddess-pending-topup-change";
export const PRIZE_LOCK_EVENT = "goddess-prize-lock-change";

export function writeStoredEconomy(state: EconomyState) {
  window.localStorage.setItem(ECONOMY_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(ECONOMY_CHANGE_EVENT));
}

export function subscribeEconomy(onChange: () => void) {
  window.addEventListener(ECONOMY_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ECONOMY_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readEconomySnapshot() {
  try {
    return window.localStorage.getItem(ECONOMY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function economyFromSnapshot(raw: string) {
  try {
    return parseEconomyState(raw ? JSON.parse(raw) : null) ?? createEconomyState();
  } catch {
    return createEconomyState();
  }
}

export function readPendingTopup(): PendingTopup | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_TOPUP_KEY);
    const value = raw ? JSON.parse(raw) as PendingTopup : null;
    if (!value || !Number.isFinite(value.yuan) || !Number.isFinite(value.euro)) return null;
    return { yuan: value.yuan, euro: value.euro };
  } catch {
    return null;
  }
}

export function writePendingTopup(pending: PendingTopup) {
  window.sessionStorage.setItem(PENDING_TOPUP_KEY, JSON.stringify(pending));
  window.dispatchEvent(new Event(PENDING_TOPUP_EVENT));
}

export function clearPendingTopup() {
  window.sessionStorage.removeItem(PENDING_TOPUP_KEY);
  window.dispatchEvent(new Event(PENDING_TOPUP_EVENT));
}

export function subscribePendingTopup(onChange: () => void) {
  window.addEventListener(PENDING_TOPUP_EVENT, onChange);
  return () => window.removeEventListener(PENDING_TOPUP_EVENT, onChange);
}

export function readPendingSnapshot() {
  try {
    return window.sessionStorage.getItem(PENDING_TOPUP_KEY) ?? "";
  } catch {
    return "";
  }
}

export function readPrizeLock(): PrizeLockRecord | null {
  try {
    const raw = window.sessionStorage.getItem(PRIZE_LOCK_KEY);
    const value = raw ? JSON.parse(raw) as PrizeLockRecord : null;
    if (!value || !Number.isFinite(value.packId)) return null;
    const returnMode = normalizeMinigameId(value.returnMode);
    if (!returnMode) return null;
    return { packId: value.packId, returnMode };
  } catch {
    return null;
  }
}

export function writePrizeLock(lock: PrizeLockRecord | null) {
  if (!lock) window.sessionStorage.removeItem(PRIZE_LOCK_KEY);
  else window.sessionStorage.setItem(PRIZE_LOCK_KEY, JSON.stringify(lock));
  window.dispatchEvent(new Event(PRIZE_LOCK_EVENT));
}

export function subscribePrizeLock(onChange: () => void) {
  window.addEventListener(PRIZE_LOCK_EVENT, onChange);
  return () => window.removeEventListener(PRIZE_LOCK_EVENT, onChange);
}

export function readPrizeSnapshot() {
  try {
    return window.sessionStorage.getItem(PRIZE_LOCK_KEY) ?? "";
  } catch {
    return "";
  }
}
