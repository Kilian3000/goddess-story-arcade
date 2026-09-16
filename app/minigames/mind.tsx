"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { useArcadeMeta } from "../use-arcade-meta";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";
import type { StakeCard } from "./card-stake-picker";

type Seat = { id: number; valueFen: number; art: Card };

type Props = {
  rows: StakeCard[];
  catalog: Card[];
  grantCards: (ids: number[]) => void;
  credit: (fen: number) => boolean;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

export function MindTable({ rows, catalog, grantCards, credit, onPulse, playUiTap, playWin, playLoss }: Props) {
  const arcade = useArcadeMeta();
  const deck = useMemo<Seat[]>(() => {
    const owned = rows.map((row) => ({ id: row.card.id, valueFen: row.valueFen, art: row.card }));
    const fallback = catalog.slice(0, 24).map((card) => ({ id: card.id, valueFen: 20, art: card }));
    return (owned.length >= 8 ? owned : fallback).slice(0, 8).sort((a, b) => a.valueFen - b.valueFen || a.id - b.id);
  }, [catalog, rows]);
  const byId = useMemo(() => new Map(deck.map((card) => [card.id, card])), [deck]);
  const [yours, setYours] = useState<number[]>([]);
  const [hers, setHers] = useState<number[]>([]);
  const [played, setPlayed] = useState<number[]>([]);
  const [lives, setLives] = useState(2);
  const [status, setStatus] = useState<"idle" | "live" | "win" | "loss">("idle");
  const [note, setNote] = useState("");
  const [prizeLine, setPrizeLine] = useState("");
  const ghost = useRef<number | null>(null);

  useEffect(() => () => { if (ghost.current) window.clearTimeout(ghost.current); }, []);

  const remaining = (you: number[], her: number[], done: number[]) => (
    [...you, ...her]
      .map((id) => byId.get(id)!)
      .filter((card) => card && !done.includes(card.id))
      .sort((a, b) => a.valueFen - b.valueFen || a.id - b.id)
  );

  const deal = () => {
    void playUiTap();
    if (ghost.current) window.clearTimeout(ghost.current);
    const ids = deck.map((card) => card.id);
    setYours(ids.filter((_, index) => index % 2 === 0));
    setHers(ids.filter((_, index) => index % 2 === 1));
    setPlayed([]);
    setLives(2);
    setNote("Spiele die nächste niedrigste Karte. Die Schwester hält vier verdeckte.");
    setPrizeLine("");
    setStatus("live");
  };

  const finishWin = () => {
    setStatus("win");
    void playWin(1);
    if (arcade.hasSkillClaim("mind")) {
      setPrizeLine("Daily schon geholt — diesmal nur Übung.");
      return;
    }
    arcade.markSkillClaim("mind");
    const prize = rows.find((row) => row.card.rarity === "R") || catalog.find((card) => card.rarity === "R");
    if (prize && "card" in prize) {
      grantCards([prize.card.id]);
      setPrizeLine(`Daily: ${prize.card.character} · R liegt im Binder.`);
    } else if (prize && "id" in prize) {
      grantCards([prize.id]);
      setPrizeLine(`Daily: ${prize.character} · R liegt im Binder.`);
    } else {
      credit(10);
      setPrizeLine("Daily: +0,10 ¥.");
    }
    onPulse();
  };

  const sisterPlays = (you: number[], her: number[], done: number[]) => {
    const next = remaining(you, her, done)[0];
    if (!next || !her.includes(next.id)) return { you, her, done };
    const after = [...done, next.id];
    const herLeft = her.filter((id) => id !== next.id);
    setPlayed(after);
    setHers(herLeft);
    setNote(`Schwester legt ${formatYuan(next.valueFen)} ¥.`);
    return { you, her: herLeft, done: after };
  };

  const playCard = (id: number) => {
    if (status !== "live" || !yours.includes(id)) return;
    if (ghost.current) window.clearTimeout(ghost.current);
    const expected = remaining(yours, hers, played)[0];
    const card = byId.get(id);
    if (!expected || !card) return;
    if (card.id !== expected.id) {
      const left = lives - 1;
      setLives(left);
      setNote(`Zu früh. Nächste war ${formatYuan(expected.valueFen)} ¥ (${expected.art.character}).`);
      if (left <= 0) {
        setStatus("loss");
        void playLoss();
      }
      return;
    }
    const youLeft = yours.filter((item) => item !== id);
    const afterYou = [...played, id];
    setYours(youLeft);
    setPlayed(afterYou);
    setNote(`Du legst ${formatYuan(card.valueFen)} ¥.`);
    if (!youLeft.length && !hers.length) {
      finishWin();
      return;
    }
    ghost.current = window.setTimeout(() => {
      let state = { you: youLeft, her: hers, done: afterYou };
      state = sisterPlays(state.you, state.her, state.done);
      state = sisterPlays(state.you, state.her, state.done);
      if (!state.you.length && !state.her.length) finishWin();
    }, 700);
  };

  return (
    <GameFrame eyebrow="SKILL · THE MIND" title={<>THE <i>MIND</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Ihr spielt still aufsteigend nach Wert. Du siehst nur deine vier Karten. Tippe, wenn du glaubst, die nächste niedrigste zu halten. Zwei Leben. Erster Daily-Clear: R-Kopie oder 0,10 ¥.</p></details>
      <p className="game-hint">Leben {lives} · gelegt {played.length}/8{arcade.hasSkillClaim("mind") ? " · Daily schon geholt" : " · erster Clear gibt Daily"}</p>
      {note && <p className="game-hint">{note}</p>}
      <div className="mind-split">
        <section>
          <small>DEINE HAND</small>
          <div className="game-cards cols-4">
            {yours.map((id) => {
              const card = byId.get(id);
              if (!card) return null;
              return (
                <button key={id} type="button" onClick={() => playCard(id)} disabled={status !== "live"}>
                  <img src={cardAsset(card.art.image_path)} alt="" />
                  <b>{formatYuan(card.valueFen)} ¥</b>
                </button>
              );
            })}
          </div>
        </section>
        <section>
          <small>GHOST</small>
          <div className="game-cards cols-4">
            {hers.map((id) => <article key={id}><span className="face-down">?</span></article>)}
          </div>
        </section>
      </div>
      {played.length > 0 && (
        <p className="game-hint">Zuletzt: {played.map((id) => formatYuan(byId.get(id)?.valueFen || 0)).join(" → ")} ¥</p>
      )}
      {status === "win" && <GameResult tone="win" title="Clear — ihr habt die Reihe gehalten" detail={prizeLine} />}
      {status === "loss" && <GameResult tone="loss" title="Kette gerissen" detail="Zwei falsche Legen. Kein Daily." />}
      <div className="minigame-actions">
        {status !== "live" && <button type="button" className="minigame-go" onClick={deal}>{status === "idle" ? "DEAL" : "AGAIN"}</button>}
      </div>
    </GameFrame>
  );
}
