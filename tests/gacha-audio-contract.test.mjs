import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/use-gacha-audio.ts", import.meta.url), "utf8");

function numberConstant(name) {
  const match = source.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `missing ${name}`);
  return Number(match[1]);
}

function section(from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `missing section ${from}`);
  return source.slice(start, end);
}

test("Safari audio is created and resumed inside a trusted gesture", () => {
  assert.match(source, /window\.AudioContext\s*\|\|/);
  assert.match(source, /webkitAudioContext/);
  assert.match(source, /new AudioContextClass\(\{ latencyHint: "interactive" \}\)/);
  assert.match(source, /new AudioContextClass\(\);[\s\S]*?return null;/);

  const prime = section("const prime = () => {", "document.addEventListener");
  assert.match(prime, /current = makeRig\(\)/);
  assert.match(prime, /state === "closed"/);
  assert.match(prime, /resumeContext\(current\.context\)/);
  assert.match(source, /document\.addEventListener\("pointerdown", prime, true\)/);
  assert.match(source, /document\.addEventListener\("keydown", prime, true\)/);

  const resume = section("function resumeContext", "function tone");
  assert.match(resume, /state === "running" \|\| context\.state === "closed"/);
  assert.match(resume, /context\.resume\(\)\.catch/);
});

test("effects schedule synchronously before Safari resume settles", () => {
  const trigger = section("const trigger = useCallback", "const stopMusic");
  assert.equal(trigger.includes("await "), false);
  assert.ok(trigger.indexOf("emit(current)") < trigger.indexOf("resumeContext(current.context)"));
  assert.equal(source.includes("createDynamicsCompressor"), false);
});

test("pack sounds use immediate paper transients and keep peek separate", () => {
  const reveal = section("const playReveal = useCallback", "const playShrineDrop");
  assert.match(reveal, /paperSlide\(current\)/);
  assert.doesNotMatch(reveal, /cardSlap|await /);
  assert.match(reveal, /music\.gain\.cancelScheduledValues\(now\)/);
  assert.match(reveal, /musicEnabledRef\.current/);
  const peek = section("const playPeek = useCallback", "const playReveal");
  assert.match(peek, /glassNote\(current, 88, 0,/);
  assert.doesNotMatch(peek, /playReveal|cardSlap/);
  const stop = section("const stopMusic = useCallback", "const beginMusic");
  assert.match(stop, /cancelScheduledValues/);
});

test("desktop mix has an audible but headroom-safe default", () => {
  const master = numberConstant("MASTER_LEVEL");
  const sfx = numberConstant("SFX_LEVEL");
  const music = numberConstant("MUSIC_LEVEL");
  assert.ok(master >= 0.5 && master <= 0.65, `master ${master} outside approved range`);
  assert.ok(sfx >= 0.8 && sfx <= 1, `sfx ${sfx} outside approved range`);
  assert.ok(music >= 0.85 && music <= 1, `music ${music} outside approved range`);
  assert.ok(master * music >= 0.44, "music bus is still too faint for laptop speakers");
  assert.ok(master * Math.max(sfx, music) <= 0.65, "bus gain leaves too little transient headroom");
});

test("each fresh card advances the pack melody with an immediate attack", () => {
  const reveal = section("const playReveal = useCallback", "const playShrineDrop");
  assert.match(reveal, /revealStep.current\+\+/);
  assert.match(reveal, /glassNote\(current, pitch, 0,/);
  const tear = section("const playTear = useCallback", "const playCardTravel");
  assert.match(tear, /revealStep.current = 0/);
});

test("music is a varied 16-step arcade groove and starts immediately", () => {
  const bass = source.match(/const bassPattern[^=]*= \[([^\]]+)\]/)?.[1]
    .split(",")
    .map((value) => value.trim());
  assert.equal(bass?.length, 16);
  assert.ok(new Set(bass?.filter((value) => value !== "null")).size >= 3);
  assert.match(source, /function musicKick/);
  assert.match(source, /function musicSnare/);
  assert.match(source, /function musicHat/);
  assert.match(source, /const arpShapes = \[[\s\S]*?\];/);

  const begin = section("const beginMusic = useCallback", "const toggleMuted");
  assert.equal(begin.includes("await "), false);
  assert.ok(begin.indexOf("pump();") < begin.indexOf("window.setInterval"));
  assert.match(begin, /if \(musicTimer\.current !== null\) return/);
  assert.match(begin, /if \(mutedRef\.current \|\| !musicEnabledRef\.current\) return/);
});
