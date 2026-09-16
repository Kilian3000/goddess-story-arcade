"use client";

import { useState } from "react";
import { scopaRank } from "../arcade-flavor";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import { formatYuan, yuanToFen } from "../economy";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";
import { scopaCaptures } from "./odds";
import { YuanStake } from "./yuan-stake";

type Seat = { card: Card; rank: number };

type Props = {
  catalog: Card[];
  valueFen: (cardId: number, rarity: string) => number;
  balanceFen: number;
  spend: (fen: number) => boolean;
  credit: (fen: number) => boolean;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

function deal(catalog: Card[], valueFen: Props["valueFen"], count: number): Seat[] {
  return Array.from({ length: count }, () => {
    const card = catalog[Math.floor(secureRandom() * catalog.length)];
    return { card, rank: scopaRank(valueFen(card.id, card.rarity)) };
  });
}

export function ScopaTable({ catalog, valueFen, balanceFen, spend, credit, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [stakeYuan, setStakeYuan] = useState(1);
  const [hand, setHand] = useState<Seat[]>([]);
  const [table, setTable] = useState<Seat[]>([]);
  const [score, setScore] = useState(0);
  const [lastCatch, setLastCatch] = useState("");
  const [status, setStatus] = useState<"idle" | "live" | "done">("idle");
  const [paidFen, setPaidFen] = useState(0);
  const stakeFen = yuanToFen(stakeYuan);

  const start = () => {
    if (!spend(stakeFen) || catalog.length < 12) return;
    void playUiTap();
    onPulse();
    setHand(deal(catalog, valueFen, 4));
    setTable(deal(catalog, valueFen, 4));
    setScore(0);
    setLastCatch("");
    setPaidFen(0);
    setStatus("live");
  };

  const play = (index: number) => {
    if (status !== "live") return;
    const card = hand[index];
    const caught = scopaCaptures(card.rank, table.map((row) => row.rank));
    let nextTable = table;
    let nextScore = score;
    if (caught.length) {
      const need = [...caught];
      nextTable = table.filter((row) => {
        const at = need.indexOf(row.rank);
        if (at < 0) return true;
        need.splice(at, 1);
        return false;
      });
      const sweep = nextTable.length === 0 ? 1 : 0;
      nextScore += 1 + sweep;
      setLastCatch(sweep ? `Scopa! ${card.rank} räumt den Tisch.` : `${card.rank} fängt ${caught.join(" + ")}.`);
    } else {
      nextTable = [...table, card];
      setLastCatch(`${card.rank} bleibt liegen — kein Fang.`);
    }
    const nextHand = hand.filter((_, slot) => slot !== index);
    setTable(nextTable);
    setHand(nextHand);
    setScore(nextScore);
    if (!nextHand.length) {
      const paid = nextScore >= 2 ? stakeFen + nextScore * 10 : 0;
      setPaidFen(paid);
      setStatus("done");
      if (paid) {
        credit(paid);
        void playWin(1);
      } else void playLoss();
      onPulse();
    }
  };

  return (
    <GameFrame eyebrow="CARDS · SCOPA" title={<>SCO<i>PA</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Kartenwert auf 1–10. Fange eine gleiche Zahl oder zwei Karten, die zusammen deine Zahl ergeben. Eine Hand, vier Karten. Ab 2 Fängen: Einsatz zurück plus 0,10 ¥ je Fang. Tisch leeren gibt +1 extra.</p></details>
      <YuanStake valueYuan={stakeYuan} onChange={setStakeYuan} balanceFen={balanceFen} disabled={status === "live"} />
      <p className="game-hint">Feld · Fänge {score}{lastCatch ? ` · ${lastCatch}` : ""}</p>
      <div className="game-cards cols-4">
        {table.map((row, index) => (
          <article key={`${row.card.id}-${index}`}>
            <img src={cardAsset(row.card.image_path)} alt="" />
            <b>{row.rank}</b>
          </article>
        ))}
      </div>
      <p className="game-hint">Deine Hand</p>
      <div className="game-cards cols-4">
        {hand.map((row, index) => {
          const can = scopaCaptures(row.rank, table.map((item) => item.rank)).length > 0;
          return (
            <button key={`${row.card.id}-${index}`} type="button" className={can ? "is-hot" : ""} onClick={() => play(index)} disabled={status !== "live"}>
              <img src={cardAsset(row.card.image_path)} alt="" />
              <small>{row.rank}{can ? " · fängt" : " · legt"}</small>
            </button>
          );
        })}
      </div>
      {status === "done" && (
        <GameResult
          tone={paidFen ? "win" : "loss"}
          title={paidFen ? `+${formatYuan(paidFen)} ¥` : "Unter 2 Fängen — Einsatz weg"}
          detail={paidFen ? `${score} Fänge: Einsatz zurück plus 0,10 ¥ je Fang.` : `Nur ${score} Fang. Du brauchst mindestens 2.`}
        />
      )}
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={balanceFen < stakeFen} onClick={start}>DEAL {stakeYuan} ¥</button>}
        {status === "done" && <button type="button" className="minigame-go" onClick={() => setStatus("idle")}>AGAIN</button>}
      </div>
    </GameFrame>
  );
}
