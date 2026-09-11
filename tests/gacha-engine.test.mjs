import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  compilePackRecipe,
  applyTenPackBonus,
  createCollationState,
  drawPackRarities,
  isCollationStateValid,
} from "../app/gacha-engine.ts";

const { packs } = JSON.parse(await readFile(new URL("../public/pack-configs.json", import.meta.url), "utf8"));

function seeded(seed = 0xdecafbad) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function availableFor(config) {
  return new Set([
    "R", "CR", "SR", "SCR", "SSR", "MR",
    ...config.odds.perPack.map((row) => row.rarity),
    ...config.odds.perBox.map((row) => row.rarity === "[object Object]" ? "MR" : row.rarity),
  ]);
}

function openBox(setName, seed = 1234) {
  const config = packs.find((pack) => pack.setName === setName);
  assert.ok(config, `missing config for ${setName}`);
  const random = seeded(seed);
  const recipe = compilePackRecipe(config, availableFor(config));
  let state = createCollationState(config, recipe, 1, random);
  const box = [];
  for (let index = 0; index < config.boostersCount; index += 1) {
    const draw = drawPackRarities(config, recipe, state, random);
    box.push(draw.rarities);
    state = draw.state;
  }
  return { box, config, recipe, state };
}

test("NS-02-M16 preserves its four-base, two-shiny physical pull order", () => {
  const { box } = openBox("NS-02-M16", 0x16);
  const base = box.flatMap((pack) => pack.slice(0, 4));
  const ordinary = box.flatMap((pack) => pack.slice(4)).filter((rarity) => rarity === "SR" || rarity === "SCR");
  const high = box.map((pack) => pack[5]).filter((rarity) => rarity !== "SR" && rarity !== "SCR");

  assert.ok(box.every((pack) => pack.length === 6));
  assert.ok(box.every((pack) => pack.slice(0, 4).every((rarity) => rarity === "R" || rarity === "CR")));
  assert.ok(box.every((pack) => pack[4] === "SR" || pack[4] === "SCR"));
  assert.equal(base.filter((rarity) => rarity === "R").length, 100);
  assert.equal(base.filter((rarity) => rarity === "CR").length, 20);
  assert.equal(ordinary.length, 52);
  assert.equal(high.length, 8);
});

test("NS-05-M08 uses independent 48 SR / 12 SCR middle slots and one final hit", () => {
  const { box } = openBox("NS-05-M08", 0x508);
  const middle = box.flatMap((pack) => pack.slice(4, 7));
  const hits = box.map((pack) => pack[7]);

  assert.ok(box.every((pack) => pack.length === 8));
  assert.ok(box.every((pack) => pack.slice(0, 4).every((rarity) => rarity === "R" || rarity === "CR")));
  assert.ok(box.every((pack) => pack.slice(4, 7).every((rarity) => rarity === "SR" || rarity === "SCR")));
  assert.ok(box.every((pack) => pack[7] !== "R" && pack[7] !== "CR" && pack[7] !== "SR" && pack[7] !== "SCR"));
  assert.equal(middle.filter((rarity) => rarity === "SR").length, 48);
  assert.equal(middle.filter((rarity) => rarity === "SCR").length, 12);
  assert.equal(hits.filter((rarity) => rarity === "SSR").length, 18);
  assert.equal(hits.filter((rarity) => rarity === "INS").length, 1);
  assert.equal(hits.length, 20);
});

test("classic one-yuan packs cannot become all-R packs", () => {
  const { box } = openBox("NS-03", 3);
  assert.ok(box.every((pack) => pack.slice(0, 4).every((rarity) => rarity === "R")));
  assert.ok(box.every((pack) => pack[4] === "SR" || pack[4] === "SSR"));
  assert.equal(box.filter((pack) => pack[4] === "SSR").length, 6);
});

test("all 47 configurations compile to complete ordered boosters", () => {
  for (const [index, config] of packs.entries()) {
    const random = seeded(1000 + index);
    const recipe = compilePackRecipe(config, availableFor(config));
    let state = createCollationState(config, recipe, 1, random);
    assert.ok(isCollationStateValid(state, config, recipe), config.setName);
    for (let packIndex = 0; packIndex < config.boostersCount; packIndex += 1) {
      const draw = drawPackRarities(config, recipe, state, random);
      assert.equal(draw.rarities.length, config.odds.cardsPerPack, config.setName);
      assert.ok(draw.rarities.every((rarity) => rarity !== "[object Object]"), config.setName);
      state = draw.state;
    }
  }
});


test("ten-pack second chance improves only the final hit and never consumes the box queue", () => {
  const { recipe, state } = openBox("NS-03", 10);
  const saved = structuredClone(state);
  const base = ["R","R","R","R","SR"];
  const rolls = [0,.99];
  const bonus = applyTenPackBonus(base,recipe,10,()=>rolls.shift());
  assert.deepEqual(bonus.rarities,["R","R","R","R","SSR"]);
  assert.equal(bonus.boostedIndex,4);
  assert.deepEqual(base,["R","R","R","R","SR"]);
  assert.deepEqual(state,saved);
  assert.deepEqual(applyTenPackBonus(["R","R","R","R","SSR"],recipe,10,()=>0).rarities,["R","R","R","R","SSR"]);
  assert.equal(applyTenPackBonus(base,recipe,10,()=>.1).rarities,base);
  assert.equal(applyTenPackBonus(base,recipe,1,()=>{throw Error("single packs must not roll a bonus");}).rarities,base);
});

test("10% second chance gives a modest measured boost to a 20% SSR hit", () => {
  const { recipe }=openBox("NS-03",3);
  const random=seeded(303);
  let ordinary=0, boosted=0;
  for(let i=0;i<100000;i++) {
    const hit=random()<.2 ? "SSR" : "SR";
    ordinary+=Number(hit==="SSR");
    boosted+=Number(applyTenPackBonus(["R","R","R","R",hit],recipe,10,random).rarities[4]==="SSR");
  }
  assert.ok(boosted>ordinary);
  assert.ok(Math.abs(boosted/100000-.216)<.004,`measured ${boosted/100000}`);
});

test("same-tier premium rolls keep the less frequent rarity in that set", () => {
  const recipe={zones:[{fixed:[],laneId:"hit",order:"fixed"}],lanes:[{id:"hit",slotsPerPack:1,targets:[{rarity:"MR",target:9},{rarity:"GP",target:1}]}]};
  let rolls=[0,.99];
  assert.deepEqual(applyTenPackBonus(["MR"],recipe,10,()=>rolls.shift()).rarities,["GP"]);
  assert.deepEqual(applyTenPackBonus(["GP"],recipe,10,()=>0).rarities,["GP"]);
});


test("opening flashes use each recipe's actual rarity frequency", async () => {
  const { boosterGlow, cardFinish } = await import("../app/pack-presentation.ts");
  const recipe = { zones: [{fixed:["R", "SR"]}], lanes: [{slotsPerPack:1, targets:[{rarity:"SSR",target:70},{rarity:"MR",target:20},{rarity:"UR",target:8},{rarity:"GP",target:2}]}] };
  assert.equal(boosterGlow(["R","SR","SSR"],recipe),0);
  assert.equal(boosterGlow(["R","MR"],recipe),1);
  assert.equal(boosterGlow(["R","UR"],recipe),2);
  assert.equal(boosterGlow(["R","GP"],recipe),3);
  assert.equal(boosterGlow([],recipe),0);
  assert.equal(boosterGlow(["GP"],{...recipe,zones:[{fixed:["GP"]}]}),0);
  assert.deepEqual(["R","SR","SSR","UR","ZR"].map(cardFinish),[0,1,2,3,4]);
});


test("pack shine identifies PTR independently from rarity-frequency intensity", async () => {
  const { boosterShine } = await import("../app/pack-presentation.ts");
  const recipe = { zones: [{fixed:["R"]}], lanes: [{slotsPerPack:1,targets:[{rarity:"SSR",target:80},{rarity:"PTR",target:2},{rarity:"MR",target:18}]}] };
  assert.equal(boosterShine(["R","SSR","PTR"],recipe).rarity,"PTR");
  assert.equal(boosterShine(["R","SSR","PTR"],recipe).level,3);
  assert.equal(boosterShine(["R","SSR"],recipe).rarity,"SSR");
  assert.equal(boosterShine(["R"],recipe).rarity,undefined);
  assert.equal(boosterShine(["R"],recipe).level,0);
});
