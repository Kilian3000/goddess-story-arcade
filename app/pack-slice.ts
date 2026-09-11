// The broad seam hit area is forgiving on a phone; a tap or vertical drag cannot buy a pack.
export function canStartSlice(x: number, y: number) {
  return y >= -.06 && y <= .38 && (x <= .35 || x >= .65);
}
export function sliceProgress(startX: number, currentX: number, width: number, direction: 1 | -1) {
  if (width <= 0) return 0;
  return Math.max(0, Math.min(1, (currentX - startX) * direction / (width * .72)));
}
