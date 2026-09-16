"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { UFO_CHARGE_AFTER, UFO_CHARGE_PUSH, UFO_GRIP_FEN, ufoPush } from "../arcade-flavor";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";

type Zone = "left" | "center" | "right";

type Props = {
  catalog: Card[];
  balanceFen: number;
  spend: (fen: number) => boolean;
  grantCards: (ids: number[]) => void;
  credit: (fen: number) => boolean;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

export function UfoTable({ catalog, balanceFen, spend, grantCards, credit, onPulse, playUiTap, playWin }: Props) {
  const prize = useMemo(() => catalog.find((card) => card.rarity === "R") || catalog[0] || null, [catalog]);
  const [zone, setZone] = useState<Zone>("center");
  const [progress, setProgress] = useState(0);
  const [grips, setGrips] = useState(0);
  const [shove, setShove] = useState(0);
  const [won, setWon] = useState<Card | null>(null);
  const [consolation, setConsolation] = useState(0);
  const charged = grips >= UFO_CHARGE_AFTER && !won;

  const grab = () => {
    if (won || consolation || !spend(UFO_GRIP_FEN)) return;
    void playUiTap();
    onPulse();
    const nextGrips = grips + 1;
    const push = (nextGrips >= UFO_CHARGE_AFTER ? UFO_CHARGE_PUSH : 0) + ufoPush(zone, secureRandom);
    const next = Math.min(100, progress + push);
    setGrips(nextGrips);
    setShove(push);
    setProgress(next);
    if (next < 100) return;
    const commons = catalog.filter((card) => card.rarity === "R" && card.set_name === prize?.set_name);
    const pick = (commons.length ? commons : catalog.filter((card) => card.rarity === "R"))[Math.floor(secureRandom() * Math.max(1, commons.length || 1))] || null;
    if (pick) {
      grantCards([pick.id]);
      setWon(pick);
    } else {
      credit(10);
      setConsolation(10);
    }
    void playWin(1);
  };

  const reset = () => {
    setProgress(0);
    setGrips(0);
    setShove(0);
    setWon(null);
    setConsolation(0);
  };

  return (
    <GameFrame eyebrow="GESEN · UFO CATCHER" title={<>UFO <i>CATCHER</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Keine Physik-Kralle. Jeder Griff kostet {formatYuan(UFO_GRIP_FEN)} ¥ und schiebt die Kiste 8–22 (Mitte +4). Nach {UFO_CHARGE_AFTER} Griffen lädt die Klaue sichtbar (+{UFO_CHARGE_PUSH}). Bei 100 fällt eine R des 1¥-Sets.</p></details>
      <div className="ufo-cabinet">
        {prize && <img src={cardAsset(prize.image_path)} alt="" />}
        <div className="ufo-bar" style={{ "--p": `${progress}%` } as CSSProperties}><i /></div>
        <p>{progress}/100 · Griffe {grips}{charged ? " · KLAUE LÄDT +25" : ""}{shove ? ` · letzter Schub +${shove}` : ""}</p>
      </div>
      <div className="yuan-stake" role="group">
        {(["left", "center", "right"] as const).map((item) => (
          <button key={item} type="button" className={zone === item ? "is-active" : ""} disabled={Boolean(won || consolation)} onClick={() => setZone(item)}>{item === "left" ? "LINKS" : item === "right" ? "RECHTS" : "MITTE +4"}</button>
        ))}
      </div>
      {won && <GameResult tone="win" title={`${won.character} · R`} detail={`${won.set_name} liegt im Binder. ${grips} Griffe à ${formatYuan(UFO_GRIP_FEN)} ¥.`} />}
      {consolation > 0 && <GameResult tone="info" title={`${formatYuan(consolation)} ¥`} detail="Keine R im Pool — Trost statt Karte." />}
      <div className="minigame-actions">
        {won || consolation
          ? <button type="button" className="minigame-go" onClick={reset}>AGAIN</button>
          : <button type="button" className="minigame-go" disabled={balanceFen < UFO_GRIP_FEN} onClick={grab}>GRIFF {formatYuan(UFO_GRIP_FEN)} ¥</button>}
      </div>
    </GameFrame>
  );
}
