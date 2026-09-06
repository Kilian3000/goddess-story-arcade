// Distance scales with the card; a deliberate short flick also counts.
export function swipeIntent(dx: number, dy: number, elapsed: number, width: number): -1 | 0 | 1 {
  const distance = Math.abs(dx);
  if (distance < 18 || distance < Math.abs(dy) * 1.25) return 0;
  const threshold = Math.max(38, Math.min(80, width * 0.22));
  const flick = distance / Math.max(16, elapsed) > 0.48;
  return distance >= threshold || flick ? dx < 0 ? 1 : -1 : 0;
}

export function packHaptic(tier = 0) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try { navigator.vibrate(tier >= 4 ? [16, 40, 24] : tier >= 3 ? [12, 32, 16] : 8); } catch { /* Optional on supported phones. */ }
}
