import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Goddess Story gacha shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Goddess Story Arcade<\/title>/i);
  assert.match(html, /aria-label="GODDESS\.STORY CARD ARCADE"/);
  assert.match(html, /GODDESS<span>\.STORY<\/span>/);
  assert.match(html, /Goddess-Story-Archiv wird geladen/);
  assert.match(html, /BOOSTER MENU/);
  assert.match(html, /WAIFU 21/);
  assert.match(html, /HEARTLOCK/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

test("ships the verified Goddess Story pack catalog", async () => {
  const [catalogText, page, config] = await Promise.all([
    readFile(new URL("../public/pack-configs.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/arcade-config.ts", import.meta.url), "utf8"),
  ]);
  const { packs } = JSON.parse(catalogText);
  assert.equal(packs.length, 47);

  const ns03 = packs.find((pack) => pack.setName === "NS-03");
  assert.ok(ns03);
  assert.equal(ns03.boostersCount, 30);
  assert.equal(ns03.odds.cardsPerPack, 5);
  assert.deepEqual(ns03.odds.perPack, [{ rarity: "R", count: 4 }]);
  assert.deepEqual(ns03.odds.perBox, [
    { rarity: "SR", sure: 24, expected: 0 },
    { rarity: "SSR", sure: 6, expected: 0 },
  ]);

  assert.match(config, /DEFAULT_CARD_DATABASE_URL = "\/card-data\/db\.js"/);
  assert.match(config, /NEXT_PUBLIC_CARD_DATABASE_URL/);
  assert.match(config, /NEXT_PUBLIC_CARD_IMAGE_ROOT/);
  assert.match(page, /images\/cards\/NS-05-M05\/XR-114\.webp/);
  assert.match(page, /LuckyShrine/);
  assert.match(page, /TemptationDuel/);
  assert.match(page, /window\.localStorage/);
  assert.doesNotMatch(page, /arcade-hostess\.png/);
  const privateBrand = new RegExp(["hen", "tai"].join(""), "i");
  assert.doesNotMatch(`${page}\n${config}`, privateBrand);
});
