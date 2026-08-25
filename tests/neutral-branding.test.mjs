import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const neutralFiles = [
  "../README.md",
  "../INTEGRATION.md",
  "../NOTICE.md",
  "../CONTRIBUTING.md",
  "../SECURITY.md",
  "../package.json",
  "../app/arcade-config.ts",
  "../app/layout.tsx",
  "../app/page.tsx",
  "../Dockerfile",
  "../compose.yaml",
  "../.env.example",
];

test("shared source has no private deployment brand or domain", async () => {
  const contents = await Promise.all(
    neutralFiles.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  const privateBrand = new RegExp(["hen", "tai"].join(""), "i");
  assert.doesNotMatch(contents.join("\n"), privateBrand);
});

test("deployment integration stays behind explicit public configuration", async () => {
  const config = await readFile(new URL("../app/arcade-config.ts", import.meta.url), "utf8");
  assert.match(config, /NEXT_PUBLIC_ARCADE_BRAND_LEAD/);
  assert.match(config, /NEXT_PUBLIC_SITE_URL/);
  assert.match(config, /NEXT_PUBLIC_CARD_DATABASE_URL/);
  assert.match(config, /NEXT_PUBLIC_CARD_IMAGE_ROOT/);
  assert.match(config, /"\/card-data\/db\.js"/);
  assert.match(config, /"\/card-data\/"/);
});
