import { MINIGAME_IDS, isMinigameId, normalizeMinigameId, type MinigameId } from "../economy";

export { MINIGAME_IDS, isMinigameId, normalizeMinigameId, type MinigameId };

export type MinigameKind = "skill" | "house" | "cards";

export type MinigameDefinition = {
  id: MinigameId;
  title: string;
  blurb: string;
  kind: MinigameKind;
};

export const MINIGAMES: MinigameDefinition[] = [
  { id: "waifu21", title: "WAIFU 21", blurb: "beat the dealer", kind: "skill" },
  { id: "heartlock", title: "HEARTLOCK", blurb: "choose your prize", kind: "skill" },
  { id: "crash", title: "CRASH", blurb: "cash out in time", kind: "house" },
  { id: "roulette", title: "ROULETTE", blurb: "0–14 wheel", kind: "house" },
  { id: "mines", title: "MINES", blurb: "pick or bust", kind: "house" },
  { id: "jackpot", title: "JACKPOT", blurb: "winner takes the pot", kind: "cards" },
  { id: "coinflip", title: "COINFLIP", blurb: "match the class bot", kind: "cards" },
  { id: "upgrader", title: "UPGRADER", blurb: "pick your chance", kind: "cards" },
];

export const MINIGAME_GROUPS: { id: MinigameKind; label: string; games: MinigameId[] }[] = [
  { id: "skill", label: "SKILL", games: ["waifu21", "heartlock"] },
  { id: "house", label: "HOUSE", games: ["crash", "roulette", "mines"] },
  { id: "cards", label: "CARDS", games: ["jackpot", "coinflip", "upgrader"] },
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
