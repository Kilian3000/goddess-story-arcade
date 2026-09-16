import { yuanToFen } from "./economy.ts";

export type BulkScope = "excess" | "all";
export type BulkSort = "value-asc" | "value-desc" | "name" | "rarity";

export type BulkRow = {
  id: number;
  rarity: string;
  setName: string;
  character: string;
  count: number;
  valueFen: number;
  /** Pack-Slots: true = Double/bereits owned, false = Unique. Inventar: weglassen. */
  excessEligible?: boolean;
};

export type BulkQuery = {
  scope: BulkScope;
  rarities: string[];
  setName: string | null;
  character: string | null;
  minValueFen: number | null;
  maxValueFen: number | null;
  minCopies: number;
};

export type BulkApplyOptions = {
  add: boolean;
  sort: BulkSort;
};

export const DEFAULT_BULK_QUERY: BulkQuery = {
  scope: "excess",
  rarities: [],
  setName: null,
  character: null,
  minValueFen: null,
  maxValueFen: null,
  minCopies: 1,
};

export const VALUE_RANGE_PRESETS = [
  { id: "upto-010", label: "≤ 0,10 ¥", minYuan: null, maxYuan: 0.1 },
  { id: "001-050", label: "0,01–0,50 ¥", minYuan: 0.01, maxYuan: 0.5 },
  { id: "050-100", label: "0,50–1 ¥", minYuan: 0.5, maxYuan: 1 },
  { id: "1-5", label: "1–5 ¥", minYuan: 1, maxYuan: 5 },
  { id: "5-10", label: "5–10 ¥", minYuan: 5, maxYuan: 10 },
  { id: "10plus", label: "≥ 10 ¥", minYuan: 10, maxYuan: null },
] as const;

export type ValueRangePresetId = (typeof VALUE_RANGE_PRESETS)[number]["id"];

export function parseYuanInput(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function yuanBoundsToFen(minYuan: number | null, maxYuan: number | null) {
  const rawMin = minYuan == null ? null : yuanToFen(minYuan);
  const rawMax = maxYuan == null ? null : yuanToFen(maxYuan);
  if (rawMin != null && rawMax != null && rawMin > rawMax) {
    return { minFen: rawMax, maxFen: rawMin };
  }
  return { minFen: rawMin, maxFen: rawMax };
}

export function presetToFen(id: ValueRangePresetId) {
  const preset = VALUE_RANGE_PRESETS.find((item) => item.id === id);
  if (!preset) return { minFen: null, maxFen: null };
  return yuanBoundsToFen(preset.minYuan, preset.maxYuan);
}

export function matchingValuePreset(query: BulkQuery): ValueRangePresetId | null {
  for (const preset of VALUE_RANGE_PRESETS) {
    const bounds = yuanBoundsToFen(preset.minYuan, preset.maxYuan);
    if (bounds.minFen === query.minValueFen && bounds.maxFen === query.maxValueFen) return preset.id;
  }
  return null;
}

export function apparentCopies(row: BulkRow) {
  if (row.excessEligible === true) return Math.max(row.count + 1, 2);
  return row.count;
}

export function copiesForRow(row: BulkRow, scope: BulkScope) {
  if (row.count <= 0) return 0;
  if (scope === "all") return row.count;
  if (row.excessEligible === false) return 0;
  if (row.excessEligible === true) return row.count;
  return Math.max(0, row.count - 1);
}

export function matchesBulkQuery(row: BulkRow, query: BulkQuery) {
  if (query.rarities.length > 0 && !query.rarities.includes(row.rarity)) return false;
  if (query.setName && row.setName !== query.setName) return false;
  if (query.character && row.character !== query.character) return false;
  if (query.minValueFen != null && row.valueFen < query.minValueFen) return false;
  if (query.maxValueFen != null && row.valueFen > query.maxValueFen) return false;
  if (apparentCopies(row) < query.minCopies) return false;
  return copiesForRow(row, query.scope) > 0;
}

export function sortBulkRows(rows: readonly BulkRow[], sort: BulkSort) {
  return [...rows].sort((left, right) => {
    if (sort === "value-desc") return right.valueFen - left.valueFen || left.id - right.id;
    if (sort === "name") return left.character.localeCompare(right.character, "de") || left.id - right.id;
    if (sort === "rarity") return left.rarity.localeCompare(right.rarity) || right.valueFen - left.valueFen;
    return left.valueFen - right.valueFen || left.id - right.id;
  });
}

export function collectBulkIds(
  rows: readonly BulkRow[],
  query: BulkQuery,
  options: { max?: number; sort?: BulkSort } = {},
) {
  const max = options.max ?? Number.POSITIVE_INFINITY;
  const ids: number[] = [];
  for (const row of sortBulkRows(rows, options.sort ?? "value-asc")) {
    if (!matchesBulkQuery(row, query)) continue;
    const copies = copiesForRow(row, query.scope);
    for (let copy = 0; copy < copies && ids.length < max; copy += 1) ids.push(row.id);
    if (ids.length >= max) break;
  }
  return ids;
}

export function selectedCountOf(selected: readonly number[], cardId: number) {
  return selected.filter((id) => id === cardId).length;
}

export function selectionValueFen(rows: readonly BulkRow[], selected: readonly number[]) {
  const values = new Map(rows.map((row) => [row.id, row.valueFen]));
  return selected.reduce((sum, id) => sum + (values.get(id) || 0), 0);
}

export function mergeSelections(
  current: readonly number[],
  extra: readonly number[],
  rows: readonly BulkRow[],
  max = Number.POSITIVE_INFINITY,
) {
  const owned = new Map(rows.map((row) => [row.id, row.count]));
  const used = new Map<number, number>();
  const next: number[] = [];
  for (const id of [...current, ...extra]) {
    if (next.length >= max) break;
    const cap = owned.get(id) || 0;
    const have = used.get(id) || 0;
    if (have >= cap) continue;
    next.push(id);
    used.set(id, have + 1);
  }
  return next;
}

export function applyBulkSelection(
  current: readonly number[],
  rows: readonly BulkRow[],
  query: BulkQuery,
  options: BulkApplyOptions & { max?: number },
) {
  const incoming = collectBulkIds(rows, query, { max: options.max, sort: options.sort });
  return options.add ? mergeSelections(current, incoming, rows, options.max) : incoming;
}

export function toggleRowSelection(
  selected: readonly number[],
  row: BulkRow,
  scope: BulkScope = "excess",
  max = Number.POSITIVE_INFINITY,
) {
  if (selectedCountOf(selected, row.id) > 0) {
    return selected.filter((id) => id !== row.id);
  }
  const copies = Math.min(copiesForRow(row, scope), Math.max(0, max - selected.length));
  return copies > 0 ? [...selected, ...Array.from({ length: copies }, () => row.id)] : [...selected];
}

export function addRowCopy(selected: readonly number[], row: BulkRow, max = Number.POSITIVE_INFINITY) {
  if (selected.length >= max) return [...selected];
  if (selectedCountOf(selected, row.id) >= row.count) return [...selected];
  return [...selected, row.id];
}

export function removeRowCopy(selected: readonly number[], cardId: number) {
  const index = selected.lastIndexOf(cardId);
  if (index < 0) return [...selected];
  return selected.filter((_, current) => current !== index);
}

export function removeAllOfId(selected: readonly number[], cardId: number) {
  return selected.filter((id) => id !== cardId);
}

export function dropHighestValue(rows: readonly BulkRow[], selected: readonly number[], count = 1) {
  if (!selected.length || count <= 0) return [...selected];
  const values = new Map(rows.map((row) => [row.id, row.valueFen]));
  const ranked = [...new Set(selected)].sort((left, right) => (
    (values.get(right) || 0) - (values.get(left) || 0) || right - left
  ));
  const drop = new Set(ranked.slice(0, count));
  return selected.filter((id) => !drop.has(id));
}

export function collectAllIds(
  rows: readonly BulkRow[],
  scope: BulkScope,
  options: { max?: number; sort?: BulkSort } = {},
) {
  return collectBulkIds(rows, { ...DEFAULT_BULK_QUERY, scope }, options);
}

export function collectAllExceptHighest(
  rows: readonly BulkRow[],
  scope: BulkScope,
  options: { max?: number; sort?: BulkSort } = {},
) {
  return dropHighestValue(rows, collectAllIds(rows, scope, options));
}

export function pruneSelection(selected: readonly number[], rows: readonly BulkRow[]) {
  const remaining = new Map(rows.map((row) => [row.id, row.count]));
  const next: number[] = [];
  for (const id of selected) {
    const left = remaining.get(id) || 0;
    if (left <= 0) continue;
    next.push(id);
    remaining.set(id, left - 1);
  }
  return next;
}

export function selectionTouchesLastCopy(rows: readonly BulkRow[], selected: readonly number[]) {
  const owned = new Map(rows.map((row) => [row.id, row.count]));
  const used = new Map<number, number>();
  for (const id of selected) used.set(id, (used.get(id) || 0) + 1);
  for (const [id, count] of used) {
    const have = owned.get(id) || 0;
    if (have > 0 && count >= have) return true;
  }
  return false;
}

export function pickSingleId(
  rows: readonly BulkRow[],
  kind: "cheap" | "expensive" | "cheap-excess",
) {
  const pool = kind === "cheap-excess" ? rows.filter((row) => copiesForRow(row, "excess") > 0) : rows.filter((row) => row.count > 0);
  if (!pool.length) return null;
  const sort: BulkSort = kind === "expensive" ? "value-desc" : "value-asc";
  return sortBulkRows(pool, sort)[0]?.id ?? null;
}

export function uniqueSorted(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "de"));
}

export function withRarity(query: BulkQuery, rarity: string): BulkQuery {
  const rarities = query.rarities.includes(rarity)
    ? query.rarities.filter((item) => item !== rarity)
    : [...query.rarities, rarity];
  return { ...query, rarities };
}

export function withValuePreset(query: BulkQuery, id: ValueRangePresetId): BulkQuery {
  const current = matchingValuePreset(query);
  if (current === id) {
    return { ...query, minValueFen: null, maxValueFen: null };
  }
  const bounds = presetToFen(id);
  return { ...query, minValueFen: bounds.minFen, maxValueFen: bounds.maxFen };
}
