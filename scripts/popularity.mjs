export const POPULARITY_TIERS = ["common", "rare", "epic", "legendary", "mythic"];
export const CARD_VALUES_HEADER = "id,set_name,number,rarity,character,title,popularity,popularity_factor,value_yuan";

const TIER_RANK = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 4,
};

export function compilePopularityRules(rules) {
  return {
    ranges: rules.ranges,
    rareTitles: new Set(rules.rareTitles),
    epicTitles: new Set(rules.epicTitles),
    characterTiers: new Map(
      rules.characterTiers.map((rule) => [`${rule.title}\0${rule.character}`, rule.tier]),
    ),
  };
}

function compiledRules(rules) {
  return rules.rareTitles instanceof Set ? rules : compilePopularityRules(rules);
}

export function popularityTier(card, rules) {
  const compiled = compiledRules(rules);
  const title = card.title || "";
  const character = String(card.character || "").trim();
  let tier = "common";
  if (compiled.rareTitles.has(title)) tier = "rare";
  if (compiled.epicTitles.has(title)) tier = "epic";
  const characterTier = compiled.characterTiers.get(`${title}\0${character}`);
  if (characterTier && TIER_RANK[characterTier] > TIER_RANK[tier]) {
    tier = characterTier;
  }
  return tier;
}

function mix32(value) {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

export function popularityFactor(cardId, tier, rules) {
  const range = rules.ranges[tier];
  if (!range) throw new Error(`Unknown popularity tier: ${tier}`);
  const min = Number(range[0]);
  const max = Number(range[1]);
  const steps = Math.round((max - min) * 100);
  const slot = mix32(Number(cardId)) % (steps + 1);
  return Number((min + slot / 100).toFixed(2));
}

export function cardValueYuan(baseYuan, factor) {
  return Math.round(Number(baseYuan) * Number(factor) * 100) / 100;
}

export function listedRuleTitles(rules) {
  return new Set([
    ...rules.rareTitles,
    ...rules.epicTitles,
    ...rules.characterTiers.map((rule) => rule.title),
  ]);
}

export function missingRuleTitles(cards, rules) {
  const present = new Set(cards.map((card) => card.title).filter(Boolean));
  return [...listedRuleTitles(rules)].filter((title) => !present.has(title)).sort();
}

export function emptyTierCounts() {
  return Object.fromEntries(POPULARITY_TIERS.map((tier) => [tier, 0]));
}

export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}
