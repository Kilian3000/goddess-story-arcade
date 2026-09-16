"use client";

import { useState } from "react";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { CardStakePicker, type StakeCard } from "./card-stake-picker";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";
import { closestValueCard, koiYaku } from "./odds";
import { secureRandom } from "../gacha-engine";

type Props = {
  rows: StakeCard[];
  catalog: Card[];
  valueFen: (cardId: number, rarity: string) => number;
  takeCards: (ids: number[]) => boolean;
  grantCards: (ids: number[]) => void;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

export function KoiKoiTable({ rows, catalog, valueFen, takeCards, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const [field, setField] = useState<Card[]>([]);
  const [captured, setCaptured] = useState<Card[]>([]);
  const [status, setStatus] = useState<"idle" | "live" | "win" | "loss">("idle");
  const [prize, setPrize] = useState<Card | null>(null);
  const you = rows.find((row) => row.card.id === selected[0]) || null;
  const points = koiYaku(captured);

  const deal = (exclude: number[]) => {
    const pool = catalog.filter((card) => !exclude.includes(card.id));
    return Array.from({ length: 6 }, () => pool[Math.floor(secureRandom() * pool.length)]).filter(Boolean);
  };

  const award = () => {
    if (!you) return;
    const pick = closestValueCard(catalog.map((item) => ({ id: item.id, valueFen: valueFen(item.id, item.rarity) })), you.valueFen, [you.card.id]);
    const card = pick ? catalog.find((item) => item.id === pick.id) || null : null;
    grantCards([you.card.id, ...(card ? [card.id] : [])]);
    setPrize(card);
    setStatus("win");
    onPulse();
    void playWin(2);
  };

  const start = () => {
    if (!you || !takeCards([you.card.id])) return;
    void playUiTap();
    onPulse();
    const dealt = deal([you.card.id]);
    setHand(dealt.slice(0, 3));
    setField(dealt.slice(3));
    setCaptured([]);
    setPrize(null);
    setStatus("live");
  };

  const play = (index: number) => {
    if (status !== "live") return;
    const card = hand[index];
    const match = field.find((row) => row.character === card.character || row.set_name === card.set_name);
    const nextHand = hand.filter((_, slot) => slot !== index);
    const nextCaptured = match ? [...captured, card, match] : captured;
    if (match) setField(field.filter((row) => row.id !== match.id));
    else setField([...field, card]);
    setCaptured(nextCaptured);
    setHand(nextHand);
    if (!nextHand.length) {
      const yaku = koiYaku(nextCaptured);
      if (yaku >= 3) award();
      else {
        setStatus("loss");
        void playLoss();
      }
    }
  };

  return (
    <GameFrame eyebrow="CARDS · KOI-KOI" title={<>KOI-<i>KOI</i></>} stake={<CardStakePicker rows={rows} selected={selected} onChange={(ids) => setSelected(ids.slice(-1))} max={1} disabled={status === "live"} />} stakeLabel="Eine Karte einsetzen">
      <details className="game-rules"><summary>Spielregeln</summary><p>Lite: gleiche Figur oder gleiches Set fängt. 3 Yaku-Punkte (Dreier einer Figur oder 5+ Fänge) — dann Shōbu oder zu Ende spielen. Sieg holt Einsatz plus eine Ghost-Kopie ähnlichen Werts.</p></details>
      <p className="game-hint">Yaku {points} / 3{you ? ` · Einsatz ${you.card.character} · ${formatYuan(you.valueFen)} ¥` : ""}</p>
      <p className="game-hint">Feld</p>
      <div className="game-cards cols-3">
        {field.map((card, index) => (
          <article key={`${card.id}-${index}`}>
            <img src={cardAsset(card.image_path)} alt="" />
            <small>{card.character}</small>
          </article>
        ))}
      </div>
      <p className="game-hint">Hand</p>
      <div className="game-cards cols-3">
        {hand.map((card, index) => (
          <button key={`${card.id}-${index}`} type="button" onClick={() => play(index)} disabled={status !== "live"}>
            <img src={cardAsset(card.image_path)} alt="" />
            <small>{card.character}</small>
          </button>
        ))}
      </div>
      {captured.length > 0 && <p className="game-hint">Gefangen: {captured.map((card) => card.character).join(" · ")}</p>}
      {status === "win" && (
        <GameResult
          tone="win"
          title={prize ? `Shōbu · ${prize.character} gehört dir` : "Shōbu · Einsatz zurück"}
          detail={`${points} Yaku. Einsatz zurück${prize ? ` plus Ghost-Kopie (${prize.rarity}, ${formatYuan(valueFen(prize.id, prize.rarity))} ¥)` : ""}.`}
        />
      )}
      {status === "loss" && (
        <GameResult tone="loss" title="Unter 3 Yaku — Einsatz weg" detail={`Nur ${points} Punkte. 3 braucht ein Dreier derselben Figur oder fünf Fänge.`} />
      )}
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={!you} onClick={start}>KOI</button>}
        {status === "live" && points >= 3 && <button type="button" className="minigame-go" onClick={award}>SHŌBU</button>}
        {(status === "win" || status === "loss") && <button type="button" className="minigame-go" onClick={() => { setStatus("idle"); setSelected([]); setPrize(null); }}>AGAIN</button>}
      </div>
    </GameFrame>
  );
}
