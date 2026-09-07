export const CAROUSEL_PACKS = 12;

export function carouselOffset(index: number, position: number) {
  return ((index - position) % CAROUSEL_PACKS + CAROUSEL_PACKS * 1.5) % CAROUSEL_PACKS - CAROUSEL_PACKS / 2;
}

export function carouselRelease(position: number, velocity: number) {
  return Math.round(position + Math.max(-2.5, Math.min(2.5, velocity * 180))) || 0;
}
