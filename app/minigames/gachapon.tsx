"use client";

import { useState } from "react";
import { GACHAPON_CAP } from "../arcade-flavor";
import { cardAsset } from "../arcade-config";
import { skillClaimCount } from "../arcade-meta";
import { useArcadeMeta } from "../use-arcade-meta";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";
import type { StakeCard } from "./card-stake-picker";

const STAKES = [20, 35, 50] as const;

type Props = {
  rows: StakeCard[];
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

export function GachaponTable({ rows, catalog, balanceFen, spend, grantCards, credit, onPulse, playUiTap, playWin }: Props) {
  const arcade = useArcadeMeta();
  const [stake, setStake] = useState<(typeof STAKES)[number]>(20);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<Card | null>(null);
  const [consolation, setConsolation] = useState(0);
  const used = skillClaimCount(arcade.meta, "gachapon");

  const twist = () => {
    if (used >= GACHAPON_CAP || spinning || !spend(stake)) return;
    void playUiTap();
    arcade.bumpSkillClaim("gachapon");
    setSpinning(true);
    setPrize(null);
    setConsolation(0);
    window.setTimeout(() => {
      const ownedSets = new Set(rows.map((row) => row.card.set_name));
      const pool = catalog.filter((card) => card.rarity === "R" && ownedSets.has(card.set_name));
      const pick = pool[Math.floor(secureRandom() * pool.length)] || null;
      if (pick) {
        grantCards([pick.id]);
        setPrize(pick);
      } else {
        credit(10);
        setConsolation(10);
      }
      onPulse();
      void playWin(1);
      setSpinning(false);
    }, 700);
  };

  return (
    <GameFrame eyebrow="GESEN · GACHAPON" title={<>GACHA<i>PON</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Drei Drehs am Kalendertag. Einsatz 0,20–0,50 ¥. Kommt eine R aus einem Set, das du schon besitzt, liegt sie im Binder. Sonst 0,10 ¥ Trost.</p></details>
      <p className="game-hint">Heute {used}/{GACHAPON_CAP}</p>
      <div className="yuan-stake" role="group">
        {STAKES.map((fen) => (
          <button key={fen} type="button" className={stake === fen ? "is-active" : ""} disabled={spinning} onClick={() => setStake(fen)}>{formatYuan(fen)} ¥</button>
        ))}
      </div>
      <div className={`gacha-capsule${spinning ? " is-spin" : ""}`}>
        {prize ? <img src={cardAsset(prize.image_path)} alt="" /> : <b>{spinning ? "…" : consolation ? formatYuan(consolation) + " ¥" : "KAPSEL"}</b>}
      </div>
      {prize && <GameResult tone="win" title={`${prize.character} · R`} detail={`${prize.set_name} liegt im Binder.`} />}
      {consolation > 0 && !prize && <GameResult tone="info" title={`${formatYuan(consolation)} ¥ Trost`} detail="Keine R aus einem besessenen Set im Pool." />}
      <div className="minigame-actions">
        <button type="button" className="minigame-go" disabled={used >= GACHAPON_CAP || balanceFen < stake || spinning} onClick={twist}>DREHEN {formatYuan(stake)} ¥</button>
        {used >= GACHAPON_CAP && <span className="game-hint">Morgen wieder drei Drehs.</span>}
      </div>
    </GameFrame>
  );
}
