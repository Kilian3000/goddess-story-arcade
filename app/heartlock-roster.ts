export type HeartlockTier = 1 | 2 | 5 | 10;

export const HEARTLOCK_ROSTERS: Record<HeartlockTier, readonly string[]> = {
  1: ["Yor Forger", "Tifa Lockhart", "Shenhe"],
  2: ["Nami", "Chun-Li", "Yelan"],
  5: ["Jolyne Kujo", "Bayonetta", "Yae Miko"],
  10: ["Makima", "Boa Hancock", "Raiden Shogun"],
};

export function heartlockTierForCost(cost: number): HeartlockTier {
  if (cost <= 1) return 1;
  if (cost <= 2) return 2;
  if (cost <= 5) return 5;
  return 10;
}

export function heartlockPool<T extends { character: string }>(muses: readonly T[], cost: number): T[] {
  const allowed = new Set<string>(HEARTLOCK_ROSTERS[heartlockTierForCost(cost)]);
  return muses.filter((muse) => allowed.has(muse.character));
}
