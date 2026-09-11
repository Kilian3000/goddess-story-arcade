"use client";

import { useMemo, useState } from "react";
import { formatYuan, yuanToFen } from "../economy";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import { MINES_TILES, minesMultiplier, payoutFen, placeMines } from "./odds";
import { YuanStake } from "./yuan-stake";

type Status = "idle" | "playing" | "cashed" | "bust";

type Props = {
  balanceFen: number;
  spend: (fen: number) => boolean;
  credit: (fen: number) => boolean;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

export function MinesTable({ balanceFen, spend, credit, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [stakeYuan, setStakeYuan] = useState(1);
  const [mineCount, setMineCount] = useState(3);
  const [status, setStatus] = useState<Status>("idle");
  const [mines, setMines] = useState<Set<number>>(() => new Set());
  const [revealed, setRevealed] = useState<number[]>([]);
  const stakeFen = yuanToFen(stakeYuan);
  const multiplier = minesMultiplier(mineCount, revealed.length);
  const tiles = useMemo(() => Array.from({ length: MINES_TILES }, (_, index) => index), []);

  const start = () => {
    if (status !== "idle" || !spend(stakeFen)) return;
    void playUiTap();
    onPulse();
    setMines(placeMines(mineCount, secureRandom));
    setRevealed([]);
    setStatus("playing");
  };

  const openTile = (index: number) => {
    if (status !== "playing" || revealed.includes(index)) return;
    void playUiTap();
    if (mines.has(index)) {
      setRevealed(tiles);
      setStatus("bust");
      void playLoss();
      return;
    }
    setRevealed((current) => [...current, index]);
  };

  const cashOut = () => {
    if (status !== "playing" || revealed.length < 1) return;
    const paid = payoutFen(stakeFen, multiplier);
    onPulse();
    credit(paid);
    setStatus("cashed");
    void playWin(Math.max(1, revealed.length));
  };

  const reset = () => {
    void playUiTap();
    setStatus("idle");
    setRevealed([]);
    setMines(new Set());
  };

  return (
    <GameFrame eyebrow="HOUSE · 5×5 FIELD" title={<>MIN<i>ES</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Decke sichere Felder auf. Eine Mine beendet die Runde. Cash out, bevor du daneben tippst.</p></details>
      <YuanStake valueYuan={stakeYuan} onChange={setStakeYuan} balanceFen={balanceFen} disabled={status !== "idle"} />
      <label className="mines-count">
        <span>MINEN {mineCount}</span>
        <input type="range" min={1} max={8} value={mineCount} disabled={status !== "idle"} onChange={(event) => setMineCount(Number(event.target.value))} />
      </label>
      <div className={`mines-grid mines-${status}`} role="grid" aria-label="Minenfeld">
        {tiles.map((index) => {
          const open = revealed.includes(index);
          const boom = open && mines.has(index);
          const safe = open && !mines.has(index);
          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              className={boom ? "is-mine" : safe ? "is-safe" : ""}
              disabled={status !== "playing" || open}
              onClick={() => openTile(index)}
            >
              {boom ? "×" : safe ? "◆" : ""}
            </button>
          );
        })}
      </div>
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={balanceFen < stakeFen} onClick={start}>OPEN FIELD {stakeYuan} ¥</button>}
        {status === "playing" && (
          <button type="button" className="minigame-go is-cash" disabled={revealed.length < 1} onClick={cashOut}>
            CASH OUT {revealed.length ? `${multiplier.toFixed(2)}x · ${formatYuan(payoutFen(stakeFen, multiplier))} ¥` : "DECKE EIN FELD AUF"}
          </button>
        )}
        {status === "cashed" && <button type="button" className="minigame-go" onClick={reset}>GEWONNEN {formatYuan(payoutFen(stakeFen, multiplier))} ¥ · AGAIN</button>}
        {status === "bust" && <button type="button" className="minigame-go" onClick={reset}>BUST · AGAIN</button>}
      </div>
    </GameFrame>
  );
}
