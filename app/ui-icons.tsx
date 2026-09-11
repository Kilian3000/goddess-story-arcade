import type { SVGProps } from "react";

export type AppIconName =
  | "menu"
  | "back"
  | "pack"
  | "games"
  | "collection"
  | "store"
  | "wallet"
  | "music"
  | "sound"
  | "odds"
  | "cards"
  | "heart"
  | "crash"
  | "roulette"
  | "mines"
  | "jackpot"
  | "coin"
  | "upgrade"
  | "arrow"
  | "replay";

type Props = SVGProps<SVGSVGElement> & { name: AppIconName };

export function AppIcon({ name, className = "app-icon", ...props }: Props) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...props };

  if (name === "menu") return <svg {...common}><path d="M4 7h16M4 12h11M4 17h16" /></svg>;
  if (name === "back") return <svg {...common}><path d="m15 5-7 7 7 7M8 12h12" /></svg>;
  if (name === "pack") return <svg {...common}><path d="M6 3h12l1 4v14H5V7l1-4Z" /><path d="M5 7h14M9 11h6" /></svg>;
  if (name === "games") return <svg {...common}><path d="M8 9h8a5 5 0 0 1 4.7 6.7l-.6 1.7a2 2 0 0 1-3.3.8L14.5 16h-5l-2.3 2.2a2 2 0 0 1-3.3-.8l-.6-1.7A5 5 0 0 1 8 9Z" /><path d="M8 12v4M6 14h4M16.5 13.5h.01M18.5 15.5h.01" /></svg>;
  if (name === "collection") return <svg {...common}><rect x="6" y="3" width="13" height="17" rx="2" /><path d="m10 8 2-2 3 3-5 5-2-2M4 7v13a2 2 0 0 0 2 2h9" /></svg>;
  if (name === "store") return <svg {...common}><path d="M4 9h16l-1 12H5L4 9Z" /><path d="M8 9V7a4 4 0 0 1 8 0v2" /></svg>;
  if (name === "wallet") return <svg {...common}><path d="M3 7a3 3 0 0 1 3-3h12v16H6a3 3 0 0 1-3-3V7Z" /><path d="M15 10h6v5h-6a2.5 2.5 0 0 1 0-5Z" /></svg>;
  if (name === "music") return <svg {...common}><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>;
  if (name === "sound") return <svg {...common}><path d="M5 10v4h3l4 4V6l-4 4H5Z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>;
  if (name === "odds") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 4v8l5 3" /></svg>;
  if (name === "cards") return <svg {...common}><rect x="5" y="4" width="14" height="16" rx="2" /><path d="m9 9 3-3 3 3-3 3-3-3Z" /></svg>;
  if (name === "heart") return <svg {...common}><path d="M20.5 9.5C20.5 15 12 20 12 20S3.5 15 3.5 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 2.5Z" /></svg>;
  if (name === "crash") return <svg {...common}><path d="M4 18 9 12l4 3 7-9" /><path d="M15 6h5v5" /></svg>;
  if (name === "roulette") return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v6M21 12h-6M12 21v-6M3 12h6" /></svg>;
  if (name === "mines") return <svg {...common}><circle cx="12" cy="13" r="7" /><path d="m12 6 2-3h4M12 1v3M7 8 5 6M17 8l2-2" /></svg>;
  if (name === "jackpot") return <svg {...common}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4v2a4 4 0 0 0 5 4M16 6h4v2a4 4 0 0 1-5 4M12 13v4M8 21h8M9 17h6" /></svg>;
  if (name === "coin") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9 8h4a3 3 0 0 1 0 6H9M12 6v12" /></svg>;
  if (name === "upgrade") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 13 4-4 4 4M12 9v7" /></svg>;
  if (name === "replay") return <svg {...common}><path d="M4 11a8 8 0 1 1 2 6M4 11V5M4 11h6" /></svg>;
  return <svg {...common}><path d="M5 12h14m-5-5 5 5-5 5" /></svg>;
}

export const MINIGAME_ICONS = {
  waifu21: "cards",
  heartlock: "heart",
  crash: "crash",
  roulette: "roulette",
  mines: "mines",
  jackpot: "jackpot",
  coinflip: "coin",
  upgrader: "upgrade",
} as const satisfies Record<string, AppIconName>;
