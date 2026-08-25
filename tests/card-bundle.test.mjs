import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

async function readDatabase() {
  const source = await readFile(path.join(root, "public/card-data/db.js"), "utf8");
  const json = source
    .trim()
    .replace(/^window\.CARD_LISTER_DB\s*=\s*/, "")
    .replace(/;\s*$/, "");
  return JSON.parse(json);
}

test("bundled catalog is complete and uses local relative artwork", async () => {
  const database = await readDatabase();
  assert.ok(database.cards.length >= 7_000);
  assert.equal(database.sets.length, 49);

  const imagePaths = new Set();
  for (const card of database.cards) {
    assert.match(card.image_path, /^images\/cards\//);
    imagePaths.add(card.image_path);
  }
  for (const set of database.sets) {
    for (const image of set.images) {
      assert.match(image, /^images\/sets\//);
      imagePaths.add(image);
    }
  }

  await Promise.all(
    [...imagePaths].map((image) => access(path.join(root, "public/card-data", image))),
  );
});

test("every configured booster has bundled cards and set art", async () => {
  const [database, catalogSource] = await Promise.all([
    readDatabase(),
    readFile(path.join(root, "public/pack-configs.json"), "utf8"),
  ]);
  const catalog = JSON.parse(catalogSource);
  const cardSets = new Set(database.cards.map((card) => card.set_name));
  const artSets = new Set(database.sets.filter((set) => set.images.length).map((set) => set.name));

  for (const pack of catalog.packs) {
    assert.ok(cardSets.has(pack.setName), `${pack.setName} has no bundled cards`);
    assert.ok(artSets.has(pack.setName), `${pack.setName} has no bundled set art`);
  }
});
