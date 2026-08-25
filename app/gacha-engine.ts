export type OddsRow = {
  rarity: string;
  count?: number;
  sure?: number;
  expected?: number;
  pack?: number;
};

export type PackConfig = {
  id: number;
  setId: number;
  setName: string;
  title: string;
  group: string;
  cost: number;
  boostersCount: number;
  description: string;
  odds: {
    boostersCount: number;
    cardsPerPack: number;
    perPack: OddsRow[];
    perBox: OddsRow[];
    bonus: OddsRow[];
    godpacks: number;
  };
};

export type RandomSource = () => number;

type LaneTarget = {
  rarity: string;
  target: number;
  minimum: number;
};

export type LaneDefinition = {
  id: string;
  slotsPerPack: number;
  targets: LaneTarget[];
};

type ZoneOrder = "fixed" | "shuffle" | "tiered";

export type RecipeZone = {
  id: string;
  fixed: string[];
  laneId?: string;
  order: ZoneOrder;
};

export type PackRecipe = {
  version: 3;
  setName: string;
  cardsPerPack: number;
  lanes: LaneDefinition[];
  zones: RecipeZone[];
  pattern: string;
};

export type CollationState = {
  version: 3;
  setName: string;
  boxNumber: number;
  packIndex: number;
  laneDecks: Record<string, string[]>;
};

const BASE_RARITIES = new Set(["R", "CR"]);
const MID_RARITIES = new Set(["SR", "SCR"]);
const FEATURE_RARITIES = new Set(["FR", "FRR"]);
const HIGH_RARITIES = new Set([
  "SSR", "SER", "GR", "PTR", "MSR", "UR", "PR", "MR", "ZR", "XR", "SP",
  "BW", "RDM", "INS", "BHR", "SD", "SSD", "SZR", "ACR", "HR", "MTL", "WTR",
  "TGR", "TR", "NTR", "BGL", "DSR", "CP", "LP", "LP/99", "MR/199", "NNS",
  "GP", "QN", "SC", "COM", "MFR", "SFR", "SLP", "SCP", "SWR", "LSP", "JNH",
]);

function normalizeRarity(rarity: string) {
  // One upstream NS-05-M02 row is serialized as [object Object].
  return rarity === "[object Object]" ? "MR" : rarity;
}

function expandedFixed(rows: OddsRow[]) {
  return rows.flatMap((row) => Array.from(
    { length: Math.max(0, Math.round(row.count || 0)) },
    () => normalizeRarity(row.rarity),
  ));
}

function rowTargets(rows: OddsRow[], available: ReadonlySet<string>) {
  return rows
    .map((row): LaneTarget => {
      const rarity = normalizeRarity(row.rarity);
      const minimum = Math.max(0, row.sure || 0);
      return {
        rarity,
        minimum,
        target: minimum + Math.max(0, row.expected || 0),
      };
    })
    .filter((row) => row.target > 0 && available.has(row.rarity));
}

function filterTargets(targets: LaneTarget[], allowed: ReadonlySet<string>) {
  return targets.filter((row) => allowed.has(row.rarity));
}

function excludeTargets(targets: LaneTarget[], excluded: ReadonlySet<string>) {
  return targets.filter((row) => !excluded.has(row.rarity));
}

function subtractFixed(targets: LaneTarget[], rarity: string, count: number) {
  return targets
    .map((row) => row.rarity === rarity
      ? { ...row, target: Math.max(0, row.target - count), minimum: Math.max(0, row.minimum - count) }
      : row)
    .filter((row) => row.target > 0);
}

function lane(id: string, slotsPerPack: number, targets: LaneTarget[]): LaneDefinition | null {
  return slotsPerPack > 0 && targets.some((row) => row.target > 0)
    ? { id, slotsPerPack, targets }
    : null;
}

function fixedOf(rarities: string[], allowed: ReadonlySet<string>) {
  return rarities.filter((rarity) => allowed.has(rarity));
}

export function compilePackRecipe(config: PackConfig, availableRarities: ReadonlySet<string>): PackRecipe {
  const targets = rowTargets(config.odds.perBox, availableRarities);
  const fixed = fixedOf(expandedFixed(config.odds.perPack), availableRarities);
  const zones: RecipeZone[] = [];
  const lanes: LaneDefinition[] = [];
  let pattern = "Structured booster";

  const addLane = (definition: LaneDefinition | null) => {
    if (definition) lanes.push(definition);
    return definition?.id;
  };

  if (config.group === "1 юань") {
    const fixedBase = fixed.filter((rarity) => BASE_RARITIES.has(rarity));
    const base = fixedBase.length
      ? null
      : lane("base", 4, filterTargets(targets, BASE_RARITIES));
    const foilTargets = fixedBase.length ? targets : excludeTargets(targets, BASE_RARITIES);
    const foil = lane("foil", 1, foilTargets);
    zones.push({ id: "base", fixed: fixedBase, laneId: addLane(base), order: "shuffle" });
    zones.push({ id: "foil", fixed: [], laneId: addLane(foil), order: "fixed" });
    pattern = availableRarities.has("CR")
      ? "4 R/CR base · 1 SR-or-higher foil"
      : "4 R base · 1 SR-or-higher foil";
  } else if (config.group === "2 юаня") {
    const fixedBase = fixed.filter((rarity) => BASE_RARITIES.has(rarity));
    const fixedMiddle = fixed.filter((rarity) => MID_RARITIES.has(rarity));
    const base = fixedBase.length
      ? null
      : lane("base", 4, filterTargets(targets, BASE_RARITIES));
    let flexTargets = fixedBase.length ? targets : excludeTargets(targets, BASE_RARITIES);
    let middleLane: LaneDefinition | null = null;
    if (!fixedMiddle.length && availableRarities.has("SR")) {
      const ordinary = filterTargets(flexTargets, MID_RARITIES);
      const ordinaryTotal = ordinary.reduce((sum, row) => sum + row.target, 0);
      const middleTargets = ordinary.map((row) => ({
        ...row,
        minimum: 0,
        target: ordinaryTotal > 0 ? row.target / ordinaryTotal * config.boostersCount : 0,
      }));
      middleLane = lane("middle", 1, middleTargets);
      for (const row of middleTargets) flexTargets = subtractFixed(flexTargets, row.rarity, row.target);
    }
    const flex = lane("foil-flex", 1, flexTargets);
    zones.push({ id: "base", fixed: fixedBase, laneId: addLane(base), order: "shuffle" });
    zones.push({ id: "middle", fixed: fixedMiddle, laneId: addLane(middleLane), order: "fixed" });
    zones.push({ id: "hit", fixed: [], laneId: addLane(flex), order: "fixed" });
    pattern = availableRarities.has("CR")
      ? "4 R/CR base · 1 SR/SCR · 1 SR-or-higher hit"
      : "4 R base · 1 SR · 1 flex foil";
  } else if (config.group === "5 юаней") {
    const baseSlots = config.odds.cardsPerPack === 7 ? 3 : 4;
    const fixedBase = fixed.filter((rarity) => BASE_RARITIES.has(rarity));
    const fixedMiddle = fixed.filter((rarity) => MID_RARITIES.has(rarity));
    const base = fixedBase.length
      ? null
      : lane("base", baseSlots, filterTargets(targets, BASE_RARITIES));
    let midTargets = filterTargets(targets, MID_RARITIES);
    if (config.setName === "NS-05-M08") {
      // Two filmed physical boxes show a clean 48 SR / 12 SCR middle bag.
      midTargets = [
        { rarity: "SR", target: 48, minimum: 0 },
        { rarity: "SCR", target: 12, minimum: 0 },
      ].filter((row) => availableRarities.has(row.rarity));
    }
    const highTargets = excludeTargets(targets, new Set([...BASE_RARITIES, ...MID_RARITIES]));

    const expectedMiddleSlots = Math.max(0, config.odds.cardsPerPack - baseSlots - 1);
    const midFlexSlots = fixedMiddle.length ? 0 : expectedMiddleSlots;
    const midFlex = lane("middle-flex", midFlexSlots, midTargets);
    const hit = lane("hit", 1, fixedBase.length ? targets : highTargets);

    zones.push({ id: "base", fixed: fixedBase, laneId: addLane(base), order: "shuffle" });
    zones.push({ id: "middle", fixed: fixedMiddle, laneId: addLane(midFlex), order: "shuffle" });
    zones.push({ id: "hit", fixed: [], laneId: addLane(hit), order: "fixed" });
    pattern = `${baseSlots} R/CR base · ${expectedMiddleSlots} SR/SCR · 1 SSR-or-higher hit`;
  } else if (config.group === "10 юаней") {
    const fixedMiddle = fixed.filter((rarity) => MID_RARITIES.has(rarity));
    const fixedFeature = fixed.filter((rarity) => FEATURE_RARITIES.has(rarity));
    let remainder = [...targets];
    let middleLane: LaneDefinition | null = null;
    let featureLane: LaneDefinition | null = null;

    if (config.setName === "NS-10-M06") {
      const middleTargets = filterTargets(remainder, MID_RARITIES);
      middleLane = lane("middle", 3, middleTargets);
      remainder = excludeTargets(remainder, MID_RARITIES);
    }

    if (!fixedFeature.length) {
      const featureTargets = filterTargets(remainder, FEATURE_RARITIES);
      if (featureTargets.length) {
        featureLane = lane("feature", 1, featureTargets);
        remainder = excludeTargets(remainder, FEATURE_RARITIES);
      }
    }

    const hit = lane("hit", 1, remainder);
    zones.push({ id: "middle", fixed: fixedMiddle, laneId: addLane(middleLane), order: "shuffle" });
    zones.push({ id: "feature", fixed: fixedFeature, laneId: addLane(featureLane), order: "fixed" });
    zones.push({ id: "hit", fixed: [], laneId: addLane(hit), order: "fixed" });
    pattern = `${fixedMiddle.length || middleLane?.slotsPerPack || 0} SR/SCR · 1 feature · 1 premium hit`;
  } else {
    const variableSlots = Math.max(0, config.odds.cardsPerPack - fixed.length);
    const variable = lane("variable", variableSlots, targets);
    zones.push({ id: "fixed", fixed, order: "fixed" });
    zones.push({ id: "variable", fixed: [], laneId: addLane(variable), order: "fixed" });
    pattern = `${fixed.length} fixed · ${variableSlots} premium draw`;
  }

  // Keep compilation safe when an incomplete upstream row is filtered out.
  const compiledCount = zones.reduce((sum, zone) => {
    const definition = lanes.find((item) => item.id === zone.laneId);
    return sum + zone.fixed.length + (definition?.slotsPerPack || 0);
  }, 0);
  if (compiledCount !== config.odds.cardsPerPack) {
    const missing = config.odds.cardsPerPack - compiledCount;
    const fallbackRarity = availableRarities.has("SR") ? "SR" : [...availableRarities][0];
    if (missing > 0 && fallbackRarity) zones.push({
      id: "catalog-repair",
      fixed: Array.from({ length: missing }, () => fallbackRarity),
      order: "fixed",
    });
  }

  return {
    version: 3,
    setName: config.setName,
    cardsPerPack: config.odds.cardsPerPack,
    lanes,
    zones,
    pattern,
  };
}

export function secureRandom(): number {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) return Math.random();
  const values = new Uint32Array(1);
  cryptoObject.getRandomValues(values);
  return values[0] / 4294967296;
}

export function shuffleWith<T>(items: readonly T[], random: RandomSource = secureRandom) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function integerizeTargets(targets: LaneTarget[], capacity: number, random: RandomSource) {
  if (!targets.length || capacity <= 0) return [] as string[];

  const minimums = targets.map((row) => Math.max(0, Math.floor(row.minimum)));
  let minimumTotal = minimums.reduce((sum, value) => sum + value, 0);
  if (minimumTotal > capacity) {
    const scale = capacity / minimumTotal;
    for (let index = 0; index < minimums.length; index += 1) minimums[index] = Math.floor(minimums[index] * scale);
    minimumTotal = minimums.reduce((sum, value) => sum + value, 0);
  }

  const remaining = capacity - minimumTotal;
  const extras = targets.map((row, index) => Math.max(0, row.target - minimums[index]));
  const extrasTotal = extras.reduce((sum, value) => sum + value, 0);
  const ideals = extras.map((value) => extrasTotal > 0 ? value / extrasTotal * remaining : 0);
  const counts = ideals.map((value, index) => minimums[index] + Math.floor(value));
  let unfilled = capacity - counts.reduce((sum, value) => sum + value, 0);
  const fractions = ideals.map((value) => value - Math.floor(value));

  while (unfilled > 0) {
    const total = fractions.reduce((sum, value) => sum + value, 0);
    let chosen = -1;
    if (total > 0) {
      let roll = random() * total;
      for (let index = 0; index < fractions.length; index += 1) {
        roll -= fractions[index];
        if (roll <= 0) { chosen = index; break; }
      }
    }
    if (chosen < 0) chosen = Math.floor(random() * targets.length);
    counts[chosen] += 1;
    fractions[chosen] = 0;
    unfilled -= 1;
  }

  return targets.flatMap((row, index) => Array.from({ length: counts[index] }, () => row.rarity));
}

function createLaneDeck(definition: LaneDefinition, boostersCount: number, random: RandomSource) {
  const capacity = definition.slotsPerPack * boostersCount;
  return shuffleWith(integerizeTargets(definition.targets, capacity, random), random);
}

export function createCollationState(
  config: PackConfig,
  recipe: PackRecipe,
  boxNumber = 1,
  random: RandomSource = secureRandom,
): CollationState {
  return {
    version: 3,
    setName: config.setName,
    boxNumber,
    packIndex: 0,
    laneDecks: Object.fromEntries(
      recipe.lanes.map((definition) => [definition.id, createLaneDeck(definition, config.boostersCount, random)]),
    ),
  };
}

export function isCollationStateValid(state: unknown, config: PackConfig, recipe: PackRecipe): state is CollationState {
  if (!state || typeof state !== "object") return false;
  const candidate = state as Partial<CollationState>;
  if (candidate.version !== 3 || candidate.setName !== config.setName) return false;
  if (!Number.isInteger(candidate.packIndex) || (candidate.packIndex || 0) < 0 || (candidate.packIndex || 0) > config.boostersCount) return false;
  if (!candidate.laneDecks || typeof candidate.laneDecks !== "object") return false;
  return recipe.lanes.every((definition) => (
    Array.isArray(candidate.laneDecks?.[definition.id])
    && candidate.laneDecks[definition.id].length === definition.slotsPerPack * config.boostersCount
  ));
}

export function drawPackRarities(
  config: PackConfig,
  recipe: PackRecipe,
  savedState: CollationState,
  random: RandomSource = secureRandom,
) {
  const state = savedState.packIndex >= config.boostersCount
    ? createCollationState(config, recipe, savedState.boxNumber + 1, random)
    : savedState;
  const rarities: string[] = [];

  for (const zone of recipe.zones) {
    const values = [...zone.fixed];
    if (zone.laneId) {
      const definition = recipe.lanes.find((item) => item.id === zone.laneId);
      if (definition) {
        const start = state.packIndex * definition.slotsPerPack;
        values.push(...state.laneDecks[definition.id].slice(start, start + definition.slotsPerPack));
      }
    }

    if (zone.order === "shuffle") {
      rarities.push(...shuffleWith(values, random));
    } else if (zone.order === "tiered") {
      const lower = values.filter((rarity) => !HIGH_RARITIES.has(rarity));
      const higher = values.filter((rarity) => HIGH_RARITIES.has(rarity));
      rarities.push(...shuffleWith(lower, random), ...shuffleWith(higher, random));
    } else {
      rarities.push(...values);
    }
  }

  return {
    rarities: rarities.slice(0, config.odds.cardsPerPack),
    state: { ...state, packIndex: state.packIndex + 1 },
  };
}

export function rarityTier(rarity: string) {
  if (rarity === "R") return 0;
  if (rarity === "CR" || rarity === "SR" || rarity === "FR") return 1;
  if (rarity === "SCR" || rarity === "FRR") return 2;
  if (rarity === "SSR" || rarity === "BHR") return 3;
  return 4;
}

export function recipeRarityTargets(recipe: PackRecipe, config: PackConfig) {
  const counts = new Map<string, number>();
  for (const zone of recipe.zones) {
    for (const rarity of zone.fixed) counts.set(rarity, (counts.get(rarity) || 0) + config.boostersCount);
  }
  for (const definition of recipe.lanes) {
    for (const row of definition.targets) counts.set(row.rarity, (counts.get(row.rarity) || 0) + row.target);
  }
  return [...counts.entries()].map(([rarity, perBox]) => ({ rarity, perBox }));
}
