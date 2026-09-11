"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import chill from "./music/positive-chill-hop.mp3?url";
import disco from "./music/disco.mp3?url";

export function BackgroundMusic() {
  const audio = useRef<HTMLAudioElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    let games = pathname === "/" && Boolean(new URLSearchParams(location.search).get("play"));
    const sync = () => {
      const track = games ? disco : chill;
      if (player.getAttribute("src") !== track) {
        player.src = track;
        player.dataset.track = games ? "disco" : "positive-chill-hop";
      }
      player.volume = .3;
      const enabled = localStorage.getItem("goddess-gacha-music-v1") !== "off" && localStorage.getItem("goddess-gacha-sound-v3") !== "muted";
      if (!enabled) player.pause();
      else if (player.paused) void player.play().catch(() => { /* Safari retries on the next interaction. */ });
    };
    const mode = (event: Event) => { games = (event as CustomEvent).detail === "games"; sync(); };
    window.addEventListener("goddess-music-mode", mode);
    window.addEventListener("goddess-music-sync", sync);
    window.addEventListener("storage", sync);
    document.addEventListener("pointerdown", sync, true);
    document.addEventListener("keydown", sync, true);
    sync();
    return () => {
      window.removeEventListener("goddess-music-mode", mode);
      window.removeEventListener("goddess-music-sync", sync);
      window.removeEventListener("storage", sync);
      document.removeEventListener("pointerdown", sync, true);
      document.removeEventListener("keydown", sync, true);
    };
  }, [pathname]);
  return <audio ref={audio} loop preload="metadata" aria-hidden="true" data-background-music="" />;
}
