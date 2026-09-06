import assert from "node:assert/strict";
import test from "node:test";
import { swipeIntent } from "../app/pack-gestures.ts";

test("a slow swipe scales to the phone card width", () => {
  assert.equal(swipeIntent(-55, 3, 400, 240), 1);
  assert.equal(swipeIntent(55, 3, 400, 240), -1);
  assert.equal(swipeIntent(-55, 3, 400, 500), 0);
});
test("a short intentional flick works in both directions", () => {
  assert.equal(swipeIntent(-30, 2, 50, 400), 1);
  assert.equal(swipeIntent(30, 2, 50, 400), -1);
});
test("taps, vertical gestures and slow short drags do not reveal cards", () => {
  assert.equal(swipeIntent(7, 1, 0, 280), 0);
  assert.equal(swipeIntent(-60, 80, 50, 280), 0);
  assert.equal(swipeIntent(20, 0, 300, 280), 0);
});
