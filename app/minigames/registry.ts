import { MINIGAME_IDS, isMinigameId, normalizeMinigameId, type MinigameId } from "../economy";

export { MINIGAME_IDS, isMinigameId, normalizeMinigameId, type MinigameId };

export type MinigameKind = "skill" | "house" | "cards" | "rips" | "gesen";

export type MinigameDefinition = {
  id: MinigameId;
  title: string;
  blurb: string;
  kind: MinigameKind;
};

export const MINIGAMES: MinigameDefinition[] = [
  { id: "waifu21", title: "WAIFU 21", blurb: "beat the dealer", kind: "skill" },
  { id: "heartlock", title: "HEARTLOCK", blurb: "choose your prize", kind: "skill" },
  { id: "memory", title: "MEMORY", blurb: "match your arts", kind: "skill" },
  { id: "duel", title: "DUEL", blurb: "best of three", kind: "skill" },
  { id: "mind", title: "THE MIND", blurb: "play in silence", kind: "skill" },
  { id: "speed", title: "SNAP", blurb: "same face, tap", kind: "skill" },
  { id: "crash", title: "CRASH", blurb: "cash out in time", kind: "house" },
  { id: "roulette", title: "ROULETTE", blurb: "0–14 wheel", kind: "house" },
  { id: "mines", title: "MINES", blurb: "pick or bust", kind: "house" },
  { id: "hilo", title: "HI-LO", blurb: "higher or lower", kind: "house" },
  { id: "jackpot", title: "JACKPOT", blurb: "winner takes the pot", kind: "cards" },
  { id: "coinflip", title: "COINFLIP", blurb: "match the class bot", kind: "cards" },
  { id: "upgrader", title: "UPGRADER", blurb: "pick your chance", kind: "cards" },
  { id: "war", title: "WAR", blurb: "high card takes both", kind: "cards" },
  { id: "monte", title: "FIND THE CHASE", blurb: "three card mix", kind: "cards" },
  { id: "cabo", title: "CABO", blurb: "lowest hand wins", kind: "cards" },
  { id: "scopa", title: "SCOPA", blurb: "catch the table", kind: "cards" },
  { id: "loveletter", title: "LOVE LETTER", blurb: "outlast the muse", kind: "cards" },
  { id: "koikoi", title: "KOI-KOI", blurb: "call or continue", kind: "cards" },
  { id: "packbattle", title: "PACK BATTLE", blurb: "rip for the pot", kind: "rips" },
  { id: "sisterrip", title: "SISTER'S RIP", blurb: "copy a past pull", kind: "rips" },
  { id: "lastpack", title: "LAST PACK", blurb: "strike four, keep one", kind: "rips" },
  { id: "gachapon", title: "GACHAPON", blurb: "twist a capsule", kind: "gesen" },
  { id: "ufo", title: "UFO CATCHER", blurb: "push the box", kind: "gesen" },
];

export const MINIGAME_GROUPS: { id: MinigameKind; label: string; games: MinigameId[] }[] = [
  { id: "skill", label: "SKILL", games: ["waifu21", "heartlock", "memory", "duel", "mind", "speed"] },
  { id: "house", label: "HOUSE", games: ["crash", "roulette", "mines", "hilo"] },
  { id: "cards", label: "CARDS", games: ["jackpot", "coinflip", "upgrader", "war", "monte", "cabo", "scopa", "loveletter", "koikoi"] },
  { id: "rips", label: "RIPS", games: ["packbattle", "sisterrip", "lastpack"] },
  { id: "gesen", label: "GESEN", games: ["gachapon", "ufo"] },
];

export const DEFAULT_MINIGAME: MinigameId = "waifu21";

export function minigameById(id: string | null | undefined) {
  const normalized = normalizeMinigameId(id);
  return normalized ? MINIGAMES.find((game) => game.id === normalized) ?? null : null;
}

export const PLAY_CHANGE_EVENT = "goddess-play-change";

export function readPlayParam(search = typeof window === "undefined" ? "" : window.location.search) {
  return normalizeMinigameId(new URLSearchParams(search).get("play"));
}

export function playSnapshot() {
  return readPlayParam() ?? "";
}

export function subscribePlayParam(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(PLAY_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(PLAY_CHANGE_EVENT, onChange);
  };
}

export function writePlayParam(id: MinigameId | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("play", id);
  else url.searchParams.delete("play");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event(PLAY_CHANGE_EVENT));
}
