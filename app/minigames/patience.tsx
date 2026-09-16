"use client";

import { useMemo, useState } from "react";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import type { WaifuMuse } from "../lucky-shrine";
import { useArcadeMeta } from "../use-arcade-meta";
import { formatYuan } from "../economy";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";
import { patiencePair } from "./odds";
import type { StakeCard } from "./card-stake-picker";

type Tile = { key: string; card: { character: string; rarity: string; image: string } };

type Props = {
  rows: StakeCard[];
  catalog: Card[];
  muses: WaifuMuse[];
  credit: (fen: number) => boolean;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
};

export function PatienceTable({ rows, catalog, muses, credit, onPulse, playUiTap, playWin }: Props) {
  const arcade = useArcadeMeta();
  const pool = useMemo(() => {
    const owned = rows.map((row) => ({ character: row.card.character, rarity: row.card.rarity, image: cardAsset(row.card.image_path) }));
    const fallback = muses.map((muse) => ({ character: muse.character, rarity: muse.rarity, image: muse.image }));
    const extra = catalog.slice(0, 12).map((card) => ({ character: card.character, rarity: card.rarity, image: cardAsset(card.image_path) }));
    return [...owned, ...fallback, ...extra].slice(0, 16);
  }, [catalog, muses, rows]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [free, setFree] = useState(0);
  const [status, setStatus] = useState<"idle" | "live" | "win">("idle");
  const [prize, setPrize] = useState("");

  const deal = () => {
    void playUiTap();
    const dealt = pool.slice(0, 12).map((card, index) => ({ key: `${index}-${card.character}`, card }));
    for (let i = dealt.length - 1; i > 0; i -= 1) {
      const other = Math.floor(secureRandom() * (i + 1));
      [dealt[i], dealt[other]] = [dealt[other], dealt[i]];
    }
    setTiles(dealt);
    setPicked([]);
    setFree(0);
    setPrize("");
    setStatus("live");
  };

  const choose = (index: number) => {
    if (status !== "live" || picked.includes(index)) return;
    const next = [...picked, index];
    if (next.length < 2) {
      setPicked(next);
      return;
    }
    const [a, b] = next;
    if (patiencePair(tiles[a].card, tiles[b].card)) {
      const left = tiles.filter((_, slot) => slot !== a && slot !== b);
      setTiles(left);
      setFree((value) => value + 1);
      setPicked([]);
      if (left.length === 0) {
        setStatus("win");
        void playWin(1);
        if (!arcade.hasSkillClaim("patience")) {
          arcade.markSkillClaim("patience");
          credit(10);
          onPulse();
          setPrize(`Daily Perfect · +${formatYuan(10)} ¥`);
        } else setPrize("Clear. Daily schon geholt — nur Übung.");
      }
    } else if (free > 0) {
      setFree((value) => value - 1);
      setPicked([]);
    } else setPicked([]);
  };

  return (
    <GameFrame eyebrow="BINDER · PATIENCE" title={<>KABU<i>FUDA</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Decke zwei Karten auf. Gleiche Figur oder gleiche Rarity ist ein Paar und fliegt raus. Jedes Paar gibt eine freie Fehlversuche-Zelle. Alles weg: erster Daily gibt 0,10 ¥.</p></details>
      <p className="game-hint">Frei {free}{arcade.hasSkillClaim("patience") ? " · Daily schon geholt" : " · erster Clear gibt Daily"}</p>
      <div className="game-cards cols-4">
        {tiles.map((tile, index) => (
          <button key={tile.key} type="button" className={picked.includes(index) ? "is-picked" : ""} onClick={() => choose(index)}>
            {picked.includes(index) ? <img src={tile.card.image} alt="" /> : <span className="face-down">?</span>}
            {picked.includes(index) && <small>{tile.card.character} · {tile.card.rarity}</small>}
          </button>
        ))}
      </div>
      {status === "win" && <GameResult tone="win" title="Blatt leer" detail={prize} />}
      <div className="minigame-actions">
        <button type="button" className="minigame-go" onClick={deal}>{tiles.length || status === "win" ? "NEUES BLATT" : "DEAL"}</button>
      </div>
    </GameFrame>
  );
}
