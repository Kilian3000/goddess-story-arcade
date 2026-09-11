"use client";

import { useMemo, useState } from "react";
import { formatYuan, yuanToFen } from "../economy";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import {
  ROULETTE_ORDER,
  payoutFen,
  rouletteColor,
  rouletteMultiplier,
  type RouletteBet,
} from "./odds";
import { YuanStake } from "./yuan-stake";

type Status = "idle" | "spinning" | "settled";

type Props = {
  balanceFen: number;
  spend: (fen: number) => boolean;
  credit: (fen: number) => boolean;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

const STRIP = Array.from({ length: 8 }, () => ROULETTE_ORDER).flat();

export function RouletteTable({ balanceFen, spend, credit, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [stakeYuan, setStakeYuan] = useState(1);
  const [bet, setBet] = useState<RouletteBet>("red");
  const [status, setStatus] = useState<Status>("idle");
  const [pocket, setPocket] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const stakeFen = yuanToFen(stakeYuan);
  const multiplier = pocket === null ? 0 : rouletteMultiplier(bet, pocket);
  const tiles = useMemo(() => STRIP.map((value, index) => ({ value, index, color: rouletteColor(value) })), []);

  const spin = () => {
    if (status !== "idle" || !spend(stakeFen)) return;
    void playUiTap();
    onPulse();
    const result = Math.floor(secureRandom() * 15);
    const loop = ROULETTE_ORDER.length;
    const base = loop * 5;
    const slot = ROULETTE_ORDER.indexOf(result as typeof ROULETTE_ORDER[number]);
    const target = base + slot;
    setPocket(result);
    setStatus("spinning");
    setOffset(target * 58 + 8);
    window.setTimeout(() => {
      const paid = payoutFen(stakeFen, rouletteMultiplier(bet, result));
      if (paid > 0) {
        onPulse();
        credit(paid);
        void playWin(result === 0 ? 10 : 2);
      } else {
        void playLoss();
      }
      setStatus("settled");
    }, 2400);
  };

  const reset = () => {
    void playUiTap();
    setStatus("idle");
    setPocket(null);
    setOffset(0);
  };

  return (
    <GameFrame eyebrow="HOUSE · CSGO 0–14" title={<>ROULE<i>TTE</i></>}>
      <p className="minigame-copy">Grün 0 zahlt 14x. Rot 1–7 und Schwarz 8–14 zahlen 2x. Eine Wette pro Spin.</p>
      <YuanStake valueYuan={stakeYuan} onChange={setStakeYuan} balanceFen={balanceFen} disabled={status !== "idle"} />
      <div className="roulette-bets" role="group" aria-label="Wette">
        <button type="button" className={`is-red${bet === "red" ? " is-active" : ""}`} disabled={status !== "idle"} onClick={() => setBet("red")}>RED 2x</button>
        <button type="button" className={`is-black${bet === "black" ? " is-active" : ""}`} disabled={status !== "idle"} onClick={() => setBet("black")}>BLACK 2x</button>
        <button type="button" className={`is-green${bet === "green" ? " is-active" : ""}`} disabled={status !== "idle"} onClick={() => setBet("green")}>GREEN 14x</button>
        <label>
          <span>ZAHL</span>
          <select value={typeof bet === "number" ? bet : ""} disabled={status !== "idle"} onChange={(event) => setBet(Number(event.target.value))}>
            <option value="">—</option>
            {ROULETTE_ORDER.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <div className="roulette-window" aria-hidden="true">
        <i />
        <div className="roulette-strip" style={{ transform: `translateX(calc(50% - ${offset}px))`, transition: status === "spinning" ? "transform 2.3s cubic-bezier(.12,.7,.12,1)" : "none" }}>
          {tiles.map((tile) => (
            <b key={`${tile.index}-${tile.value}`} className={`is-${tile.color}`}>{tile.value}</b>
          ))}
        </div>
      </div>
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={balanceFen < stakeFen} onClick={spin}>SPIN {stakeYuan} ¥</button>}
        {status === "spinning" && <span className="minigame-wait">SPINNING…</span>}
        {status === "settled" && pocket !== null && (
          <button type="button" className="minigame-go" onClick={reset}>
            {multiplier > 0 ? `HIT ${pocket} · +${formatYuan(payoutFen(stakeFen, multiplier))} ¥` : `MISS ${pocket} · AGAIN`}
          </button>
        )}
      </div>
    </GameFrame>
  );
}
