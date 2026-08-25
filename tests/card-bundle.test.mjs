import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path.join(directory, entry.name), relative));
    } else {
      files.push(relative);
    }
  }
  return files;
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

  const bundledFiles = new Set(await listFiles(path.join(root, "public/card-data")));
  for (const image of imagePaths) {
    assert.ok(bundledFiles.has(image), `${image} is missing or has different filename casing`);
  }
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
