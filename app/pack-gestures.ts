export type GestureMode = "pending" | "peek" | "swipe";

export const PHONE_GESTURE_QUERY = "(max-width: 700px), (pointer: coarse) and (max-width: 1000px) and (max-height: 600px)";
export type MotionSample = { x: number; y: number; time: number };

// Measure the release, not the total gesture: a slow peek can end in a flick,
// and a fast movement followed by a pause must not unexpectedly reveal a card.
export function phoneReleaseVelocity(samples: MotionSample[], now: number) {
  const recent = samples.filter(sample => sample.time >= now - 100 && sample.time <= now);
  if (recent.length < 2) return { x: 0, y: 0 };
  const first = recent[0];
  const last = recent[recent.length - 1];
  const elapsed = last.time - first.time;
  if (elapsed < 8) return { x: 0, y: 0 };
  return { x: (last.x - first.x) / elapsed, y: (last.y - first.y) / elapsed };
}

export function phoneSwipeIntent(dx: number, dy: number, width: number, samples: MotionSample[], now: number): 0 | 1 {
  const distance = Math.hypot(dx, dy);
  const velocity = phoneReleaseVelocity(samples, now);
  const minimumTravel = Math.max(20, Math.min(28, width * .07));
  return distance >= minimumTravel && Math.hypot(velocity.x, velocity.y) >= .55 ? 1 : 0;
}

export function phonePeekAmount(dx: number, dy: number, width: number, height: number): number {
  return Math.min(1, Math.hypot(dx, dy) / Math.max(70, Math.min(width, height) * .33));
}

// Signed components keep diagonal peeks continuous and expose the opposite edge.
export function phonePeekVector(dx: number, dy: number, width: number, height: number) {
  const distance = Math.hypot(dx, dy);
  if (!distance) return { x: 0, y: 0 };
  const amount = phonePeekAmount(dx, dy, width, height);
  return { x: dx / distance * amount, y: dy / distance * amount };
}

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
