"use client";

import { useState } from "react";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import { formatYuan, yuanToFen } from "../economy";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";
import { caboScore } from "./odds";
import { YuanStake } from "./yuan-stake";

type Slot = { card: Card; valueFen: number; peeked: boolean };

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

export function CaboTable({ catalog, valueFen, balanceFen, spend, credit, onPulse, playUiTap, playWin, playLoss }: Props) {
  const priced = catalog.filter((card) => valueFen(card.id, card.rarity) > 0);
  const [stakeYuan, setStakeYuan] = useState(1);
  const [hand, setHand] = useState<Slot[]>([]);
  const [bot, setBot] = useState<Slot[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "live" | "done">("idle");
  const [won, setWon] = useState(false);
  const stakeFen = yuanToFen(stakeYuan);

  const drawFour = () => Array.from({ length: 4 }, () => {
    const card = priced[Math.floor(secureRandom() * priced.length)];
    return { card, valueFen: valueFen(card.id, card.rarity), peeked: false };
  });

  const start = () => {
    if (!spend(stakeFen) || priced.length < 8) return;
    void playUiTap();
    onPulse();
    const yours = drawFour();
    yours[0].peeked = true;
    yours[1].peeked = true;
    setHand(yours);
    setBot(drawFour());
    setFocus(null);
    setWon(false);
    setStatus("live");
  };

  const peek = () => {
    if (status !== "live" || focus == null) return;
    setHand((current) => current.map((row, slot) => slot === focus ? { ...row, peeked: true } : row));
  };

  const swap = () => {
    if (status !== "live" || focus == null) return;
    const card = priced[Math.floor(secureRandom() * priced.length)];
    setHand((current) => current.map((row, slot) => (
      slot === focus ? { card, valueFen: valueFen(card.id, card.rarity), peeked: true } : row
    )));
  };

  const knock = () => {
    if (status !== "live") return;
    const you = caboScore(hand.map((row) => row.valueFen));
    const them = caboScore(bot.map((row) => row.valueFen));
    const hit = you <= them;
    setWon(hit);
    setStatus("done");
    setHand((current) => current.map((row) => ({ ...row, peeked: true })));
    if (hit) {
      credit(stakeFen * 2);
      onPulse();
      void playWin(1);
    } else void playLoss();
  };

  const youTotal = caboScore(hand.map((row) => row.valueFen));
  const botTotal = caboScore(bot.map((row) => row.valueFen));

  return (
    <GameFrame eyebrow="CARDS · CABO" title={<>CA<i>BO</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Vier Katalogkarten. Zwei darfst du sofort sehen. Wähle eine Karte, dann PEEK oder TAUSCH. Klopfen vergleicht die Summe. Niedrigerer Wertfen gewinnt den Einsatz ×2. Bei Gleichstand gewinnst du.</p></details>
      <YuanStake valueYuan={stakeYuan} onChange={setStakeYuan} balanceFen={balanceFen} disabled={status === "live"} />
      <p className="game-hint">{status === "live" ? "Bot-Summe bleibt verdeckt, bis du klopfst." : status === "done" ? `Du ${formatYuan(youTotal)} ¥ · Bot ${formatYuan(botTotal)} ¥` : "Deal, dann niedrig halten."}</p>
      <div className="game-cards cols-4">
        {hand.map((row, index) => (
          <button key={`${row.card.id}-${index}`} type="button" className={focus === index ? "is-picked" : ""} onClick={() => setFocus(index)} disabled={status !== "live"}>
            {row.peeked ? <img src={cardAsset(row.card.image_path)} alt="" /> : <span className="face-down">?</span>}
            <small>{row.peeked ? `${formatYuan(row.valueFen)} ¥` : "verdeckt"}</small>
          </button>
        ))}
      </div>
      {status === "done" && (
        <div className="game-cards cols-4">
          {bot.map((row, index) => (
            <article key={`${row.card.id}-${index}`}>
              <small>BOT</small>
              <img src={cardAsset(row.card.image_path)} alt="" />
              <b>{formatYuan(row.valueFen)} ¥</b>
            </article>
          ))}
        </div>
      )}
      {status === "done" && (
        <GameResult
          tone={won ? "win" : "loss"}
          title={won ? `Niedriger · +${formatYuan(stakeFen * 2)} ¥` : "Bot niedriger — Einsatz weg"}
          detail={`Deine Summe ${formatYuan(youTotal)} ¥ gegen Bot ${formatYuan(botTotal)} ¥. Niedrigerer Wert gewinnt.`}
        />
      )}
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={balanceFen < stakeFen} onClick={start}>DEAL {stakeYuan} ¥</button>}
        {status === "live" && (
          <>
            <button type="button" className="minigame-go" disabled={focus == null || hand[focus]?.peeked} onClick={peek}>PEEK</button>
            <button type="button" className="minigame-go" disabled={focus == null} onClick={swap}>TAUSCH</button>
            <button type="button" className="minigame-go" onClick={knock}>KLOPFEN</button>
          </>
        )}
        {status === "done" && <button type="button" className="minigame-go" onClick={() => { setStatus("idle"); setHand([]); setBot([]); }}>AGAIN</button>}
      </div>
    </GameFrame>
  );
}
