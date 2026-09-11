import type { PackRecipe } from "./gacha-engine";

/** Finish families reflect the printing hierarchy, without hiding the illustration. */
export function cardFinish(rarity: string): number {
  if (rarity === "R") return 0;
  if (["SR", "CR", "FR"].includes(rarity)) return 1; // satin silver
  if (["SCR", "FRR", "SSR", "BHR"].includes(rarity)) return 2; // fine rainbow etching
  if (["UR", "MR", "GR", "PR", "GP", "LP", "LP/99", "MR/199"].includes(rarity)) return 3; // gold microglints
  return 4; // faceted prism for the other premium finishes
}

/** An honest hint from this booster's drawn cards, relative to its own recipe. */
export function boosterGlow(rarities: string[], recipe: PackRecipe): number {
  let glow = 0;
  for (const rarity of rarities) {
    if (["R", "SR", "CR", "FR"].includes(rarity) || recipe.zones.some(zone => zone.fixed.includes(rarity))) continue;
    // Expected copies per pack: rare in this set, rather than a universal label.
    let frequency = 0;
    for (const lane of recipe.lanes) {
      const total = lane.targets.reduce((sum, row) => sum + row.target, 0);
      if (total > 0) frequency += lane.slotsPerPack * lane.targets.filter(row => row.rarity === rarity).reduce((sum, row) => sum + row.target, 0) / total;
    }
    if (frequency > 0) glow = Math.max(glow, frequency <= .05 ? 3 : frequency <= .18 ? 2 : frequency <= .45 ? 1 : 0);
  }
  return glow;
}


/** Hue follows the strongest pulled rarity; recipe frequency controls intensity. */
export function boosterShine(rarities: string[], recipe: PackRecipe) {
  const rank = (rarity: string) => ["R", "SR", "CR", "FR"].includes(rarity) ? 0 : ["SCR", "FRR"].includes(rarity) ? 2 : ["SSR", "BHR"].includes(rarity) ? 3 : 4;
  const frequency = (rarity: string) => recipe.lanes.reduce((sum, lane) => {
    const total = lane.targets.reduce((n, row) => n + row.target, 0);
    return sum + (total ? lane.slotsPerPack * lane.targets.filter(row => row.rarity === rarity).reduce((n,row) => n + row.target, 0) / total : 0);
  }, 0);
  const best = rarities.filter(rarity => rank(rarity) > 0).sort((a,b) => rank(b)-rank(a) || frequency(a)-frequency(b))[0];
  return { rarity: best, level: Math.max(boosterGlow(rarities, recipe), best ? 1 : 0) };
}
