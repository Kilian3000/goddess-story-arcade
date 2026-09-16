"use client";

import { useMemo, useState } from "react";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import type { WaifuMuse } from "../lucky-shrine";
import { useArcadeMeta } from "../use-arcade-meta";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import type { StakeCard } from "./card-stake-picker";

type Tile = { key: string; art: string; pair: string };
type Props = {
  rows: StakeCard[];
  catalog: Card[];
  muses: WaifuMuse[];
  grantCards: (ids: number[]) => void;
  credit: (fen: number) => boolean;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

function shuffle<T>(list: T[]) {
  const next = [...list];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const other = Math.floor(secureRandom() * (index + 1));
    [next[index], next[other]] = [next[other], next[index]];
  }
  return next;
}

export function MemoryTable({ rows, catalog, muses, grantCards, credit, onPulse, playUiTap, playWin, playLoss }: Props) {
  const arcade = useArcadeMeta();
  const arts = useMemo(() => {
    const owned = rows.map((row) => cardAsset(row.card.image_path)).filter(Boolean);
    const fallback = muses.map((muse) => muse.image);
    return [...new Set([...owned, ...fallback])].slice(0, 8);
  }, [muses, rows]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);

  const deal = () => {
    void playUiTap();
    const pairs = arts.slice(0, 8);
    const dealt = shuffle(pairs.flatMap((art, index) => [
      { key: `${index}-a`, art, pair: String(index) },
      { key: `${index}-b`, art, pair: String(index) },
    ]));
    setTiles(dealt);
    setOpen([]);
    setMatched([]);
    setMoves(0);
    setDone(false);
  };

  const flip = (index: number) => {
    if (done || open.includes(index) || matched.includes(tiles[index]?.pair) || open.length === 2) return;
    const next = [...open, index];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((value) => value + 1);
    const [left, right] = next;
    if (tiles[left].pair === tiles[right].pair) {
      const pairs = [...matched, tiles[left].pair];
      setMatched(pairs);
      setOpen([]);
      if (pairs.length === tiles.length / 2) {
        const pairCount = tiles.length / 2;
        const perfect = moves + 1 === pairCount;
        setDone(true);
        void playWin(1);
        if (perfect && !arcade.hasSkillClaim("memory")) {
          arcade.markSkillClaim("memory");
          const commons = rows.filter((row) => row.card.rarity === "R");
          const pool = commons.length ? commons : catalog.filter((card) => card.rarity === "R");
          const prize = pool[Math.floor(secureRandom() * pool.length)];
          if (prize && "card" in prize) grantCards([prize.card.id]);
          else if (prize && "id" in prize) grantCards([prize.id]);
          else credit(10);
          onPulse();
        }
      }
    } else {
      window.setTimeout(() => setOpen([]), 700);
      void playLoss();
    }
  };

  return (
    <GameFrame eyebrow="SKILL · MEMORY" title={<>MEM<i>ORY</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Finde die acht Paare. Der erste Perfect des Tages gibt eine R-Kopie oder 0,10 ¥. Danach nur noch Übung.</p></details>
      <p className="memory-meta">Züge {moves}{arcade.hasSkillClaim("memory") ? " · Daily schon geholt" : " · erster Perfect gibt Daily"}</p>
      <div className="memory-grid">
        {tiles.map((tile, index) => {
          const shown = open.includes(index) || matched.includes(tile.pair);
          return (
            <button key={tile.key} type="button" className={shown ? "is-open" : ""} onClick={() => flip(index)} disabled={!tiles.length || done}>
              {shown ? <img src={tile.art} alt="" /> : <span>?</span>}
            </button>
          );
        })}
      </div>
      <div className="minigame-actions">
        <button type="button" className="minigame-go" onClick={deal}>{tiles.length ? "NEUES BRETT" : "DEAL"}</button>
        {done && <span>{arcade.hasSkillClaim("memory") ? `Fertig in ${moves} Zügen` : moves === tiles.length / 2 ? `Daily · ${formatYuan(10)} ¥ oder R` : "Kein Perfect — Daily bleibt offen"}</span>}
      </div>
    </GameFrame>
  );
}
