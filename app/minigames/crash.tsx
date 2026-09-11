"use client";

import { useEffect, useRef, useState } from "react";
import { formatYuan, yuanToFen } from "../economy";
import { crashPoint, payoutFen } from "./odds";
import { GameFrame } from "./game-frame";
import { YuanStake } from "./yuan-stake";
import { secureRandom } from "../gacha-engine";

type Status = "idle" | "running" | "cashed" | "crashed";

type Props = {
  balanceFen: number;
  spend: (fen: number) => boolean;
  credit: (fen: number) => boolean;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

const GROWTH = 0.11;

function multiplierAt(elapsedMs: number) {
  return Math.exp(GROWTH * (elapsedMs / 1000));
}

export function CrashTable({ balanceFen, spend, credit, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [stakeYuan, setStakeYuan] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [multiplier, setMultiplier] = useState(1);
  const [crashAt, setCrashAt] = useState(0);
  const [points, setPoints] = useState("0,200");
  const frame = useRef(0);
  const started = useRef(0);
  const bustAt = useRef(1);
  const settled = useRef(false);
  const stakeFen = yuanToFen(stakeYuan);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  const cashOut = (current: number) => {
    if (settled.current || status !== "running") return;
    settled.current = true;
    if (frame.current) cancelAnimationFrame(frame.current);
    const paid = payoutFen(stakeFen, current);
    onPulse();
    credit(paid);
    setStatus("cashed");
    setMultiplier(current);
    void playWin(Math.max(1, Math.round(current)));
  };

  const tick = (now: number) => {
    if (settled.current) return;
    const current = multiplierAt(now - started.current);
    const x = Math.min(400, current * 38);
    const y = Math.max(8, 200 - Math.log(current) * 70);
    setMultiplier(current);
    setPoints((path) => `${path} ${x.toFixed(1)},${y.toFixed(1)}`);
    if (current >= bustAt.current) {
      settled.current = true;
      setStatus("crashed");
      setMultiplier(bustAt.current);
      void playLoss();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  };

  const play = () => {
    if (status === "running" || !spend(stakeFen)) return;
    void playUiTap();
    onPulse();
    const point = crashPoint(secureRandom());
    bustAt.current = point;
    settled.current = false;
    setCrashAt(point);
    setMultiplier(1);
    setPoints("0,200");
    setStatus("running");
    frame.current = requestAnimationFrame((now) => {
      started.current = now;
      tick(now);
    });
  };

  const reset = () => {
    void playUiTap();
    setStatus("idle");
    setMultiplier(1);
    setCrashAt(0);
    setPoints("0,200");
  };

  return (
    <GameFrame eyebrow="HOUSE · YUAN CRASH" title={<>CR<i>ASH</i></>}>
      <p className="minigame-copy">Der Multiplikator steigt. Cash out, bevor die Kurve reißt. Einsatz ist sofort weg — Gewinn zahlt den vollen Multiplikator.</p>
      <YuanStake valueYuan={stakeYuan} onChange={setStakeYuan} balanceFen={balanceFen} disabled={status === "running"} />
      <div className={`crash-board crash-${status}`}>
        <b>{status === "crashed" ? `${crashAt.toFixed(2)}x` : `${multiplier.toFixed(2)}x`}</b>
        <svg viewBox="0 0 400 200" aria-hidden="true">
          <polyline points={points} />
        </svg>
        {status === "crashed" && <span>CRASHED</span>}
        {status === "cashed" && <span>CASHED {formatYuan(payoutFen(stakeFen, multiplier))} ¥</span>}
      </div>
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={balanceFen < stakeFen} onClick={play}>PLAY {stakeYuan} ¥</button>}
        {status === "running" && <button type="button" className="minigame-go is-cash" onClick={() => cashOut(multiplier)}>CASH OUT {multiplier.toFixed(2)}x</button>}
        {(status === "cashed" || status === "crashed") && <button type="button" className="minigame-go" onClick={reset}>AGAIN</button>}
      </div>
    </GameFrame>
  );
}
