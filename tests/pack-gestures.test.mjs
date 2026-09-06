import assert from "node:assert/strict";
import test from "node:test";
import { swipeIntent, cardDragTransform } from "../app/pack-gestures.ts";
import { readFile } from "node:fs/promises";

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

test("a flick after a long peek uses release speed, not total hold time", () => {
  assert.equal(swipeIntent(-30, 2, 2500, 320, -.7), 1);
  assert.equal(swipeIntent(-30, 2, 2500, 320, 0), 0);
  assert.equal(swipeIntent(-30, 2, 2500, 320, .7), 0);
  assert.equal(swipeIntent(-4, 2, 100, 320, -.7), 0);
});

test("the card follows horizontal movement without rotating the deck", () => {
  assert.equal(cardDragTransform(-32, 10, 320), "translate3d(-32px,1.2px,0) rotate(-0.9deg)");
  assert.equal(cardDragTransform(500, 1000, 320), "translate3d(500px,24px,0) rotate(7deg)");
  assert.equal(cardDragTransform(-500, -1000, 320), "translate3d(-500px,-24px,0) rotate(-7deg)");
});

test("gestures have no timed peek mode, cancel safely, and move only the top card", async () => {
  const source = await readFile(new URL("../app/pack-stack.tsx", import.meta.url), "utf8");
  assert.match(source, /cancelled \? 0 : swipeIntent/);
  assert.doesNotMatch(source, /setTimeout|holdTimer|stack-turntable|stack-hidden-face|locked/);
  assert.match(source, /current\.element\.style\.transform = cardDragTransform/);
  assert.match(source, /outgoing\.animate/);
  assert.match(source, /<img src=\{card.image\}/);
  assert.match(source, /onContextMenu=\{event => event\.preventDefault\(\)\}/);
  assert.match(source, /draggable=\{false\}/);
  assert.match(source, /onLostPointerCapture/);
  assert.match(source, /running\.forEach\(animation => animation.cancel\(\)\)/);
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.pack-card\.is-next \{ z-index: 2; visibility: visible; \}/);
  assert.doesNotMatch(css, /stack-turntable|tactile-stack.is-peeking/);
});

test("card navigation releases its input lock before scheduling visual cleanup", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const navigate = source.slice(source.indexOf("const navigateCard ="), source.indexOf("const nextCard ="));
  assert.ok(navigate.indexOf("inputLock.current = false") < navigate.indexOf("window.setTimeout"));
  assert.ok(navigate.indexOf("playReveal") < navigate.indexOf("flushSync"));
  assert.doesNotMatch(source, /locked=\{transitioning\}|aria-disabled=\{transitioning\}/);
});
