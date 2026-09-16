export const GOD_PACK_CHANCE = 1 / 400;
export const DETECTIVE_PAY_FEN = 10;
export const GACHAPON_CAP = 3;
export const UFO_GRIP_FEN = 20;
export const UFO_CHARGE_AFTER = 10;
export const UFO_CHARGE_PUSH = 25;

export const OMIKUJI = [
  { id: "daikichi", title: "DAIKICHI", line: "Die Folie hält den Atem an.", foil: 1.15 },
  { id: "kichi", title: "KICHI", line: "Ein warmer Zug durch die Box.", foil: 1.08 },
  { id: "chukichi", title: "CHUKICHI", line: "Die Schwester nickt einmal.", foil: 1.05 },
  { id: "shokichi", title: "SHOKICHI", line: "Heute reicht ein langsamer Rip.", foil: 1 },
  { id: "suekichi", title: "SUEKICHI", line: "Später wird es hell.", foil: 1 },
  { id: "kyo", title: "KYO", line: "Die Hülle knistert trocken.", foil: 0.92 },
  { id: "daikyo", title: "DAIKYO", line: "Nichts erzwingen. Nur zuhören.", foil: 0.85 },
  { id: "hanami", title: "HANAMI", line: "Rosa Staub auf dem Altar.", foil: 1.06 },
  { id: "tsuki", title: "TSUKI", line: "Die Nacht zählt mit.", foil: 1.1 },
  { id: "ame", title: "AME", line: "Yuan fällt leiser.", foil: 1 },
  { id: "kaze", title: "KAZE", line: "Ein Pack fühlt sich leichter an.", foil: 0.96 },
  { id: "hoshi", title: "HOSHI", line: "Chase sieht dich zuerst.", foil: 1.12 },
] as const;

export type OmikujiId = (typeof OMIKUJI)[number]["id"];

export function omikujiById(id: string | null | undefined) {
  return OMIKUJI.find((item) => item.id === id) ?? null;
}

export function rollOmikuji(random = Math.random) {
  return OMIKUJI[Math.floor(random() * OMIKUJI.length)] ?? OMIKUJI[0];
}

export function isMidnight(now = Date.now()) {
  const hour = new Date(now).getHours();
  return hour === 0;
}

export function shouldGodPack(allow: boolean, count: number, random = Math.random) {
  return allow && count === 1 && random() < GOD_PACK_CHANCE;
}

export function weighPack(random = Math.random) {
  const roll = random();
  if (roll < 0.18) return { feel: "heavy" as const, line: "Schwer. Oder du willst, dass es schwer ist." };
  if (roll < 0.36) return { feel: "light" as const, line: "Leicht wie ein All-R. Vielleicht." };
  if (roll < 0.52) return { feel: "warm" as const, line: "Die Folie ist warm. Theater." };
  if (roll < 0.68) return { feel: "crisp" as const, line: "Knistert an der Naht." };
  return { feel: "quiet" as const, line: "Stumm. Kein Orakel, nur Papier." };
}

export function ghostLine(marks: { chase?: boolean; isNew?: boolean; copies?: number }[], god = false) {
  if (god) return "GHOST: das ganze Pack brennt.";
  if (marks.some((mark) => mark.chase)) return "GHOST: chase sitzt. nicht blinken.";
  if (marks.some((mark) => mark.isNew)) return "GHOST: new ink. binder merkt sich das.";
  if (marks.some((mark) => mark.copies > 2)) return "GHOST: dupe train. verkauf oder craft.";
  return "GHOST: clean rip. weiter.";
}

export function oshiLetter(character: string, milestone: number) {
  if (milestone >= 12) return `${character} bleibt. Das Jahrbuch kennt den Namen.`;
  if (milestone >= 7) return `${character} hat die Route gesehen. Ein kurzer Brief.`;
  return `${character} winkt vom Rand der Box.`;
}

export function ufoPush(zone: "left" | "center" | "right", random = Math.random) {
  const bias = zone === "center" ? 4 : 0;
  return 8 + Math.floor(random() * 15) + bias;
}

export function scopaRank(valueFen: number) {
  const rank = Math.min(10, Math.max(1, Math.round(valueFen / 20)));
  return rank;
}

export function detectiveBucket(highRemaining: number): "0" | "1" | "2+" {
  if (highRemaining <= 0) return "0";
  if (highRemaining === 1) return "1";
  return "2+";
}
