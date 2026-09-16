"use client";

import { useMemo, useState } from "react";
import { cardAsset } from "../arcade-config";
import { formatYuan, yuanToFen } from "../economy";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";
import { speedPayout } from "./odds";
import { YuanStake } from "./yuan-stake";
import type { StakeCard } from "./card-stake-picker";

type Status = "idle" | "live" | "bust" | "cashed";

type Props = {
  rows: StakeCard[];
  balanceFen: number;
  spend: (fen: number) => boolean;
  credit: (fen: number) => boolean;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

export function SpeedTable({ rows, balanceFen, spend, credit, onPulse, playUiTap, playWin, playLoss }: Props) {
  const arts = useMemo(() => rows.map((row) => row.card), [rows]);
  const [stakeYuan, setStakeYuan] = useState(1);
  const [left, setLeft] = useState<(typeof arts)[number] | null>(null);
  const [right, setRight] = useState<(typeof arts)[number] | null>(null);
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [paidFen, setPaidFen] = useState(0);
  const stakeFen = yuanToFen(stakeYuan);
  const match = Boolean(left && right && left.character === right.character);

  const flip = () => {
    if (arts.length < 2) return;
    setLeft(arts[Math.floor(secureRandom() * arts.length)]);
    setRight(arts[Math.floor(secureRandom() * arts.length)]);
  };

  const start = () => {
    if (!spend(stakeFen)) return;
    void playUiTap();
    onPulse();
    setStreak(0);
    setPaidFen(0);
    setStatus("live");
    flip();
  };

  const snap = () => {
    if (status !== "live" || !left || !right) return;
    if (!match) {
      setStatus("bust");
      void playLoss();
      return;
    }
    const next = streak + 1;
    setStreak(next);
    void playWin(next);
    flip();
  };

  const pass = () => {
    if (status !== "live") return;
    if (match) {
      setStatus("bust");
      void playLoss();
      return;
    }
    void playUiTap();
    flip();
  };

  const cash = () => {
    if (status !== "live" || streak < 1) return;
    const paid = speedPayout(stakeFen, streak);
    credit(paid);
    onPulse();
    setPaidFen(paid);
    setStatus("cashed");
    void playWin(Math.max(1, streak));
  };

  return (
    <GameFrame eyebrow="SKILL · SNAP" title={<>SN<i>AP</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Zwei eigene Arts. Gleicher Charakter: SNAP. Unterschiedlich: WEITER. Falscher Knopf verbrennt den Einsatz. Cash-out zahlt House 0,96 auf den Streak. Kein Pack.</p></details>
      <YuanStake valueYuan={stakeYuan} onChange={setStakeYuan} balanceFen={balanceFen} disabled={status === "live"} />
      <div className="game-cards cols-2">
        <article>
          <small>LINKS</small>
          {left ? <img src={cardAsset(left.image_path)} alt="" /> : <span className="face-down">?</span>}
          <b>{left?.character || "—"}</b>
        </article>
        <article>
          <small>RECHTS</small>
          {right ? <img src={cardAsset(right.image_path)} alt="" /> : <span className="face-down">?</span>}
          <b>{right?.character || "—"}</b>
        </article>
      </div>
      {status === "live" && <p className="game-hint">{match ? "Gleicher Charakter — SNAP" : "Kein Match — WEITER"} · Streak {streak} · Cash {formatYuan(speedPayout(stakeFen, Math.max(1, streak)))} ¥</p>}
      {status === "bust" && left && right && (
        <GameResult
          tone="loss"
          title="Falscher Knopf — Einsatz weg"
          detail={match ? `${left.character} war ein Match. Du hättest SNAP drücken müssen.` : `${left.character} vs ${right.character}. Das war kein Match.`}
        />
      )}
      {status === "cashed" && (
        <GameResult tone="win" title={`Ausgezahlt ${formatYuan(paidFen)} ¥`} detail={`Streak ${streak} · House 0,96. Kein Pack.`} />
      )}
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={balanceFen < stakeFen || arts.length < 2} onClick={start}>PLAY {stakeYuan} ¥</button>}
        {status === "live" && (
          <>
            <button type="button" className="minigame-go" onClick={snap}>SNAP</button>
            <button type="button" className="minigame-go" onClick={pass}>WEITER</button>
            {streak > 0 && <button type="button" className="minigame-go is-cash" onClick={cash}>CASH {formatYuan(speedPayout(stakeFen, streak))} ¥</button>}
          </>
        )}
        {(status === "bust" || status === "cashed") && <button type="button" className="minigame-go" onClick={() => { setStatus("idle"); setLeft(null); setRight(null); }}>AGAIN</button>}
        {arts.length < 2 && <span className="game-hint">Mindestens zwei eigene Karten nötig.</span>}
      </div>
    </GameFrame>
  );
}
