"use client";

import { useEffect, useRef, useState } from "react";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import { secureRandom } from "../gacha-engine";
import { CardStakePicker, type StakeCard } from "./card-stake-picker";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";

type Props = {
  rows: StakeCard[];
  catalog: Card[];
  chaseCardIds: number[];
  takeCards: (ids: number[]) => boolean;
  grantCards: (ids: number[]) => void;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

export function MonteTable({ rows, catalog, chaseCardIds, takeCards, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const junk = rows.filter((row) => row.card.rarity === "R" && row.count > 1);
  const [selected, setSelected] = useState<number[]>([]);
  const [table, setTable] = useState<Card[]>([]);
  const [target, setTarget] = useState<Card | null>(null);
  const [phase, setPhase] = useState<"idle" | "peek" | "hidden" | "done">("idle");
  const [picked, setPicked] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const deal = () => {
    const stake = junk.find((row) => row.card.id === selected[0]);
    if (!stake || !takeCards([stake.card.id])) return;
    void playUiTap();
    onPulse();
    const pinned = catalog.find((card) => chaseCardIds.includes(card.id));
    const chase = pinned || [...catalog].sort((left, right) => right.id - left.id)[0] || null;
    const decoys = catalog.filter((card) => card.id !== chase?.id);
    const mix = [chase, decoys[Math.floor(secureRandom() * decoys.length)], decoys[Math.floor(secureRandom() * decoys.length)]].filter(Boolean) as Card[];
    for (let i = mix.length - 1; i > 0; i -= 1) {
      const other = Math.floor(secureRandom() * (i + 1));
      [mix[i], mix[other]] = [mix[other], mix[i]];
    }
    setTable(mix);
    setTarget(chase);
    setPicked(null);
    setWon(false);
    setPhase("peek");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPhase("hidden"), 1600);
  };

  const choose = (index: number) => {
    if (phase !== "hidden" || !table[index] || !target) return;
    const hit = table[index].id === target.id;
    setPicked(index);
    setWon(hit);
    setPhase("done");
    if (hit) {
      grantCards([table[index].id]);
      onPulse();
      void playWin(1);
    } else void playLoss();
  };

  const reset = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setTable([]);
    setTarget(null);
    setPicked(null);
    setWon(false);
    setSelected([]);
    setPhase("idle");
  };

  return (
    <GameFrame eyebrow="CARDS · MONTE" title={<>FIND THE <i>CHASE</i></>} stake={<CardStakePicker rows={junk} selected={selected} onChange={(ids) => setSelected(ids.slice(-1))} max={1} disabled={phase !== "idle"} />} stakeLabel="Eine Excess-R einsetzen">
      <details className="game-rules"><summary>Spielregeln</summary><p>Du setzt eine doppelte R. Drei Karten werden kurz gezeigt, dann zugedeckt. Finde die Chase — oder die teuerste Lockvogel-Karte. Richtig: die Karte kommt in den Binder. Falsch: der Einsatz ist weg.</p></details>
      {phase === "peek" && <p className="game-hint">Merken, dann zugedeckt…</p>}
      {phase === "hidden" && <p className="game-hint">Welche war die Chase?</p>}
      <div className="game-cards cols-3">
        {table.map((card, index) => {
          const open = phase === "peek" || phase === "done";
          return (
            <button key={`${card.id}-${index}`} type="button" className={picked === index ? "is-picked" : ""} onClick={() => choose(index)} disabled={phase !== "hidden"}>
              {open ? <img src={cardAsset(card.image_path)} alt="" /> : <span className="face-down">?</span>}
              {open && <small>{card.character}</small>}
            </button>
          );
        })}
      </div>
      {phase === "done" && target && (
        <GameResult
          tone={won ? "win" : "loss"}
          title={won ? `${target.character} gehört dir` : "Daneben — Excess-R weg"}
          detail={won ? "Die gezeigte Karte liegt jetzt im Binder." : `Die Chase war ${target.character}.`}
        />
      )}
      <div className="minigame-actions">
        {phase === "idle" && <button type="button" className="minigame-go" disabled={!selected.length} onClick={deal}>MISCHEN</button>}
        {phase === "done" && <button type="button" className="minigame-go" onClick={reset}>AGAIN</button>}
        {phase === "idle" && !junk.length && <span className="game-hint">Du brauchst eine R mit mindestens 2 Kopien.</span>}
      </div>
    </GameFrame>
  );
}
