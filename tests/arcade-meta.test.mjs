import assert from "node:assert/strict";
import test from "node:test";
import {
  PITY_ARM,
  PITY_CHARGED,
  WONDER_CAP,
  WONDER_RECHARGE_MS,
  canDailyPack,
  createArcadeMeta,
  hasSkillClaim,
  markDailyPack,
  markSetClear,
  markSkillClaim,
  parseArcadeMeta,
  pityState,
  recordPulls,
  rechargeWonder,
  skillConsolationFen,
  spendWonder,
  todayKey,
  toggleChase,
  unlockAchievement,
  wonderBoards,
  canOmikuji,
  markOmikuji,
  skillClaimCount,
  bumpSkillClaim,
} from "../app/arcade-meta.ts";
import { shouldGodPack } from "../app/arcade-flavor.ts";

test("meta parse rejects other versions and keeps chase caps", () => {
  assert.equal(parseArcadeMeta({ version: 2 }), null);
  const meta = toggleChase(toggleChase(toggleChase(toggleChase(createArcadeMeta(), 1), 2), 3), 4);
  assert.deepEqual(meta.chaseCardIds, [1, 2, 3]);
});

test("pull history stays at 24 and wonder boards skip used packs", () => {
  const pulls = Array.from({ length: 26 }, (_, index) => ({
    setName: "NS-03",
    costYuan: 1,
    cardIds: [index + 1, index + 2, index + 3, index + 4, index + 5],
    openedAt: 1000 + index,
    bestFen: 10,
    source: "altar",
  }));
  let meta = recordPulls(createArcadeMeta(), pulls, { "NS-03": 4 });
  assert.equal(meta.pulls.length, 24);
  assert.equal(meta.pityBySet["NS-03"], 4);
  const first = wonderBoards(meta, 5)[0];
  const spent = spendWonder(meta, first.id, 50);
  assert.equal(spent.ok, true);
  assert.equal(spent.state.wonderCharges, WONDER_CAP - 1);
  assert.equal(wonderBoards(spent.state, 5).some((board) => board.id === first.id), false);
});

test("wonder charges refill every 12 hours", () => {
  const empty = { ...createArcadeMeta(0), wonderCharges: 0, wonderAt: 0 };
  const refilled = rechargeWonder(empty, WONDER_RECHARGE_MS * 2 + 10);
  assert.equal(refilled.wonderCharges, 2);
});

test("daily pack, skill claims and pity flags", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  let meta = createArcadeMeta(now);
  assert.equal(canDailyPack(meta, now), true);
  meta = markDailyPack(meta, now);
  assert.equal(canDailyPack(meta, now + 1000), false);
  assert.equal(hasSkillClaim(meta, "waifu21", now), false);
  meta = markSkillClaim(meta, "waifu21", now);
  assert.equal(hasSkillClaim(meta, "waifu21", now), true);
  assert.equal(todayKey(now).startsWith("2026-"), true);
  assert.equal(skillConsolationFen(1), 10);
  assert.equal(skillConsolationFen(10), 50);
  assert.equal(pityState(19), "idle");
  assert.equal(pityState(PITY_CHARGED), "charged");
  assert.equal(pityState(PITY_ARM), "armed");
  const cleared = markSetClear(meta, "NS-03");
  assert.equal(cleared.ok, true);
  assert.equal(markSetClear(cleared.state, "NS-03").ok, false);
  const awarded = unlockAchievement(meta, "first-rip");
  assert.deepEqual(awarded.achievements, ["first-rip"]);
});

test("old meta saves gain empty flavor fields", () => {
  const parsed = parseArcadeMeta({
    version: 1,
    chaseCardIds: [1],
    shrineCardIds: [],
    pulls: [],
    pityBySet: {},
    dailyPackAt: null,
    wonderCharges: 2,
    wonderAt: 0,
    skillClaims: {},
    achievements: [],
    pickedWonderIds: [],
    setClears: [],
  });
  assert.ok(parsed);
  assert.equal(parsed.omikujiId, null);
  assert.equal(parsed.oshiNews, 0);
  assert.equal(parsed.godPacks, 0);
  assert.deepEqual(parsed.reverseBoards, []);
  assert.equal(parsed.nightOffer, null);
  assert.equal(canOmikuji(parsed, 1000), true);
  const drawn = markOmikuji(parsed, "kichi", 1000);
  assert.equal(canOmikuji(drawn, 1000 + 1000), false);
  assert.equal(canOmikuji(drawn, 1000 + 12 * 60 * 60 * 1000), true);
  let counted = createArcadeMeta();
  counted = bumpSkillClaim(counted, "gachapon");
  counted = bumpSkillClaim(counted, "gachapon");
  assert.equal(skillClaimCount(counted, "gachapon"), 2);
  assert.equal(shouldGodPack(false, 1, () => 0), false);
  assert.equal(shouldGodPack(true, 10, () => 0), false);
  assert.equal(shouldGodPack(true, 1, () => 0), true);
});

test("omikuji claim does not touch pity", () => {
  const meta = { ...createArcadeMeta(), pityBySet: { "NS-03": 17 } };
  const drawn = markOmikuji(meta, "kichi", 5000);
  assert.equal(drawn.pityBySet["NS-03"], 17);
  assert.equal(drawn.omikujiId, "kichi");
});
