"use client";

import { useMemo, useState } from "react";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import { formatYuan, yuanToFen } from "../economy";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import { hiloCall, hiloPayout } from "./odds";
import { YuanStake } from "./yuan-stake";

type Status = "idle" | "live" | "bust" | "cashed";
type Call = "higher" | "lower";

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

export function HiloTable({ catalog, valueFen, balanceFen, spend, credit, onPulse, playUiTap, playWin, playLoss }: Props) {
  const priced = useMemo(
    () => catalog.map((card) => ({ card, valueFen: valueFen(card.id, card.rarity) })).filter((row) => row.valueFen > 0),
    [catalog, valueFen],
  );
  const [stakeYuan, setStakeYuan] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [current, setCurrent] = useState<(typeof priced)[number] | null>(null);
  const [next, setNext] = useState<(typeof priced)[number] | null>(null);
  const [streak, setStreak] = useState(0);
  const [potFen, setPotFen] = useState(0);
  const stakeFen = yuanToFen(stakeYuan);

  const draw = (exclude = 0) => {
    const pool = priced.filter((row) => row.card.id !== exclude);
    return pool[Math.floor(secureRandom() * pool.length)] || priced[0] || null;
  };

  const start = () => {
    if (status !== "idle" || !priced.length || !spend(stakeFen)) return;
    void playUiTap();
    onPulse();
    const first = draw();
    setCurrent(first);
    setNext(null);
    setStreak(0);
    setPotFen(stakeFen);
    setStatus("live");
  };

  const call = (guess: Call) => {
    if (status !== "live" || !current) return;
    const upcoming = draw(current.card.id);
    if (!upcoming) return;
    setNext(upcoming);
    const result = hiloCall(current.valueFen, upcoming.valueFen);
    if (result === "push") {
      setCurrent(upcoming);
      setNext(null);
      return;
    }
    if (result !== guess) {
      setStatus("bust");
      void playLoss();
      return;
    }
    const nextStreak = streak + 1;
    const paid = hiloPayout(stakeFen, nextStreak);
    setStreak(nextStreak);
    setPotFen(paid);
    setCurrent(upcoming);
    setNext(null);
    void playWin(nextStreak);
  };

  const cash = () => {
    if (status !== "live" || streak < 1) return;
    credit(potFen);
    onPulse();
    setStatus("cashed");
    void playWin(Math.max(1, streak));
  };

  const reset = () => {
    void playUiTap();
    setStatus("idle");
    setCurrent(null);
    setNext(null);
    setStreak(0);
    setPotFen(0);
  };

  return (
    <GameFrame eyebrow="HOUSE · HI-LO" title={<>HI<i>-LO</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Rate, ob die nächste Karte mehr oder weniger wert ist. Gleichstand ist Push. Jeder Treffer steigert den Pot (1.92× · 2.88× · 3.84× · 5.76×). Cash out, bevor du liegst.</p></details>
      <YuanStake valueYuan={stakeYuan} onChange={setStakeYuan} balanceFen={balanceFen} disabled={status === "live"} />
      <div className={`hilo-board hilo-${status}`}>
        <article>
          <small>JETZT</small>
          {current ? <img src={cardAsset(current.card.image_path)} alt="" /> : <span>?</span>}
          <b>{current ? `${formatYuan(current.valueFen)} ¥` : "—"}</b>
        </article>
        <article>
          <small>NÄCHSTE</small>
          {next ? <img src={cardAsset(next.card.image_path)} alt="" /> : <span>?</span>}
          <b>{next ? `${formatYuan(next.valueFen)} ¥` : "??"}</b>
        </article>
        <p>Streak {streak} · Pot {formatYuan(potFen)} ¥</p>
      </div>
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={balanceFen < stakeFen || !priced.length} onClick={start}>PLAY {stakeYuan} ¥</button>}
        {status === "live" && (
          <>
            <button type="button" className="minigame-go" onClick={() => call("higher")}>HÖHER</button>
            <button type="button" className="minigame-go" onClick={() => call("lower")}>NIEDRIGER</button>
            {streak > 0 && <button type="button" className="minigame-go is-cash" onClick={cash}>CASH {formatYuan(potFen)} ¥</button>}
          </>
        )}
        {(status === "bust" || status === "cashed") && <button type="button" className="minigame-go" onClick={reset}>AGAIN</button>}
      </div>
    </GameFrame>
  );
}
