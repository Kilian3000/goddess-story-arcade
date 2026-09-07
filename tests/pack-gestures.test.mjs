import assert from "node:assert/strict";
import test from "node:test";
import { swipeIntent, cardDragTransform, gestureMode, peekAmount, phoneSwipeIntent, phoneReleaseVelocity, phonePeekAmount } from "../app/pack-gestures.ts";
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

test("upward peek and sideways swipe lock to separate gestures", () => {
  assert.equal(gestureMode(3, -9, "pending"), "pending");
  assert.equal(gestureMode(3, -20, "pending"), "peek");
  assert.equal(gestureMode(-20, 3, "pending"), "swipe");
  assert.equal(gestureMode(-120, -30, "peek"), "peek");
  assert.equal(gestureMode(-30, -120, "swipe"), "swipe");
  assert.equal(gestureMode(20, 20, "pending"), "pending");
  assert.equal(peekAmount(-55, 440), .5);
  assert.equal(peekAmount(-150, 440), 1);
  assert.equal(peekAmount(30, 440), 0);
});

test("a stationary input pad is separate from interruptible animated artwork", async () => {
  const source = await readFile(new URL("../app/pack-stack.tsx", import.meta.url), "utf8");
  assert.match(source, /const intent = cancelled \? 0 : current.phone/);
  assert.match(source, /current.mode !== "swipe" \? 0 : swipeIntent/);
  assert.doesNotMatch(source, /setTimeout|holdTimer|stack-turntable|stack-hidden-face|locked/);
  assert.match(source, /card\.style\.transform = cardDragTransform/);
  assert.match(source, /animateCard\(previous,/);
  assert.match(source, /animateCard\(activeIndex,/);
  assert.match(source, /<button className="pack-touch-pad"/);
  assert.match(source, /: gestureMode\(dx, dy, current.mode\)/);
  assert.match(source, /!current.sounded/);
  assert.match(source, /stack-peek-control/);
  assert.match(source, /<img src=\{card.image\}/);
  assert.match(source, /onContextMenu=\{event => event\.preventDefault\(\)\}/);
  assert.match(source, /draggable=\{false\}/);
  assert.match(source, /onLostPointerCapture/);
  assert.match(source, /running\.forEach\(animation => animation.cancel\(\)\)/);
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.pack-card\.is-next \{ z-index: 1; visibility: visible; \}/);
  assert.match(css, /\.pack-touch-pad[\s\S]*?transform: none;/);
  assert.match(css, /pack-reveal-sheen/);
});

test("phone flicks advance forward in all eight directions", () => {
  for (const [dx, dy] of [[80,0],[-80,0],[0,80],[0,-80],[60,60],[-60,60],[60,-60],[-60,-60]]) {
    const samples = [{x:0,y:0,time:0},{x:dx/2,y:dy/2,time:40},{x:dx,y:dy,time:80}];
    assert.equal(phoneSwipeIntent(dx, dy, 320, samples, 80), 1);
    assert.ok(phonePeekAmount(dx, dy, 320, 440) > .5);
  }
});

test("phone slow drags remain peeks even across the entire card", () => {
  for (const [dx,dy] of [[300,0],[-300,0],[0,300],[0,-300]]) {
    const samples = Array.from({length:16}, (_,i)=>({x:dx*i/15,y:dy*i/15,time:i*100}));
    assert.equal(phoneSwipeIntent(dx, dy, 320, samples, 1500), 0);
    assert.equal(phonePeekAmount(dx, dy, 320, 440), 1);
  }
});

test("phone peeking can become a flick, but a pause or tap never commits", () => {
  const flick = [{x:0,y:0,time:0},{x:100,y:0,time:1000},{x:125,y:0,time:1020},{x:160,y:0,time:1040}];
  assert.equal(phoneSwipeIntent(160,0,320,flick,1040),1);
  const stopped = [...flick,{x:160,y:0,time:1200}];
  assert.equal(phoneSwipeIntent(160,0,320,stopped,1200),0);
  assert.deepEqual(phoneReleaseVelocity(stopped,1200),{x:0,y:0});
  assert.equal(phoneSwipeIntent(9,0,320,[{x:0,y:0,time:0},{x:9,y:0,time:10}],10),0);
  assert.equal(phoneSwipeIntent(80,0,320,[{x:0,y:0,time:0},{x:80,y:0,time:0}],0),0);
});

test("phone presentation removes the peek button without removing desktop controls", async () => {
  const source = await readFile(new URL("../app/pack-stack.tsx", import.meta.url), "utf8");
  assert.match(source, /phone: boolean; samples: MotionSample\[\]/);
  assert.match(source, /phoneSwipeIntent\(dx, dy/);
  assert.match(source, /releaseVector.current = \{ x: velocity.x \/ speed, y: velocity.y \/ speed \}/);
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.mode-altar \.stack-peek-control, \.stack-gesture-controls \.desktop-gesture-hint \{ display: none; \}/);
  assert.match(source, /useSyncExternalStore/);
});

test("card navigation releases its input lock before scheduling visual cleanup", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const navigate = source.slice(source.indexOf("const navigateCard ="), source.indexOf("const nextCard ="));
  assert.ok(navigate.indexOf("inputLock.current = false") < navigate.indexOf("window.setTimeout"));
  assert.ok(navigate.indexOf("playReveal") < navigate.indexOf("flushSync"));
  assert.doesNotMatch(source, /locked=\{transitioning\}|aria-disabled=\{transitioning\}/);
});
