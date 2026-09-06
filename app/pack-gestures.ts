export type GestureMode = "pending" | "peek" | "swipe";

export function gestureMode(dx: number, dy: number, current: GestureMode): GestureMode {
  if (current !== "pending") return current;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return "pending";
  if (Math.abs(dy) > Math.abs(dx) * 1.15) return "peek";
  if (Math.abs(dx) > Math.abs(dy) * 1.15) return "swipe";
  return "pending";
}

export function peekAmount(dy: number, height: number): number {
  return Math.max(0, Math.min(1, -dy / Math.max(80, height * .25)));
}

// Distance scales with the card; a deliberate short flick also counts.
export function swipeIntent(dx: number, dy: number, elapsed: number, width: number, releaseVelocity?: number): -1 | 0 | 1 {
  const distance = Math.abs(dx);
  if (distance < 18 || distance < Math.abs(dy) * 1.25) return 0;
  const threshold = Math.max(38, Math.min(80, width * 0.22));
  const velocity = releaseVelocity ?? dx / Math.max(16, elapsed);
  const flick = Math.abs(velocity) > 0.48 && Math.sign(velocity) === Math.sign(dx);
  return distance >= threshold || flick ? dx < 0 ? 1 : -1 : 0;
}

// Finger-following translation with restrained, two-dimensional rotation.
export function cardDragTransform(dx: number, dy: number, width: number): string {
  const rotation = Math.max(-7, Math.min(7, dx / Math.max(1, width) * 9));
  const vertical = Math.max(-24, Math.min(24, dy * .12));
  return `translate3d(${dx}px,${vertical}px,0) rotate(${rotation}deg)`;
}

export function packHaptic(tier = 0) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try { navigator.vibrate(tier >= 4 ? [16, 40, 24] : tier >= 3 ? [12, 32, 16] : 8); } catch { /* Optional on supported phones. */ }
}
