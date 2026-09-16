"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { cardAsset } from "../arcade-config";
import { rarityColor } from "../arcade-ui";
import type { Card } from "../card-types";
import { yuanToFen } from "../economy";
import { compilePackRecipe, type PackConfig } from "../gacha-engine";
import { drawThrowawayPacks, poolForRarity } from "../pack-draw";
import { useArcadeMeta } from "../use-arcade-meta";
import { GameFrame } from "./game-frame";
import { packBattleRanks } from "./odds";

const BOT_NAMES = ["MAKIMA", "2B", "YELAN", "TIFA"];

type Seat = {
  id: string;
  name: string;
  you?: boolean;
  cards: Card[];
};

type Props = {
  packs: PackConfig[];
  allCards: Card[];
  valueFen: (cardId: number, rarity: string) => number;
  balanceFen: number;
  spend: (fen: number) => boolean;
  grantCards: (ids: number[]) => void;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

export function PackBattleTable({ packs, allCards, valueFen, balanceFen, spend, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const arcade = useArcadeMeta();
  const [packId, setPackId] = useState(packs[0]?.id ?? 0);
  const [seats, setSeats] = useState(3);
  const [lobby, setLobby] = useState<Seat[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = packs.find((pack) => pack.id === packId) || packs[0] || null;
  const costFen = selected ? yuanToFen(selected.cost) : 0;
  const recipe = useMemo(() => {
    if (!selected) return null;
    const rarities = new Set(allCards.filter((card) => card.set_name === selected.setName).map((card) => card.rarity));
    return rarities.size ? compilePackRecipe(selected, rarities) : null;
  }, [allCards, selected]);

  const rip = () => {
    if (!selected || !recipe || busy) return;
    if (!spend(costFen)) return;
    void playUiTap();
    onPulse();
    setBusy(true);
    const names = ["YOU", ...BOT_NAMES.slice(0, seats - 1)];
    const next: Seat[] = names.map((name, index) => {
      const drawn = drawThrowawayPacks({
        config: selected,
        recipe,
        getPool: (rarity) => poolForRarity(allCards, packs, selected, rarity),
        count: 1,
      });
      return {
        id: index === 0 ? "you" : `bot-${index}`,
        name,
        you: index === 0,
        cards: drawn.ok ? drawn.packs[0] : [],
      };
    });
    const ranks = packBattleRanks(next.map((seat) => ({
      id: seat.id,
      values: seat.cards.map((card) => valueFen(card.id, card.rarity)),
    })));
    setLobby(next);
    setWinnerId(ranks.winnerId);
    const pot = next.flatMap((seat) => seat.cards.map((card) => card.id));
    if (ranks.winnerId === "you") {
      grantCards(pot);
      arcade.unlockAchievement("pack-battle-win");
      void playWin(selected.cost);
    } else if (ranks.tied) {
      const yours = next.find((seat) => seat.you)?.cards.map((card) => card.id) || [];
      if (yours.length) grantCards(yours);
      void playWin(1);
    } else {
      void playLoss();
    }
    setBusy(false);
  };

  return (
    <GameFrame eyebrow="RIPS · PACK BATTLE" title={<>PACK <i>BATTLE</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Jeder Sitz zahlt denselben Booster. Bots ziehen aus einer wegwerfbaren Box. Höchster Kartenwert gewinnt alle Karten, bei Gleichstand die zweithöchste.</p></details>
      <div className="battle-controls">
        <label>
          <span>Set</span>
          <select value={packId} disabled={busy} onChange={(event) => setPackId(Number(event.target.value))}>
            {packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.setName} · {pack.cost} ¥</option>)}
          </select>
        </label>
        <label>
          <span>Sitze</span>
          <select value={seats} disabled={busy} onChange={(event) => setSeats(Number(event.target.value))}>
            {[2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      </div>
      <div className="battle-grid">
        {(lobby.length ? lobby : Array.from({ length: seats }, (_, index) => ({ id: String(index), name: index === 0 ? "YOU" : BOT_NAMES[index - 1], cards: [] as Card[], you: index === 0 }))).map((seat) => (
          <article key={seat.id} className={`${seat.you ? "is-you" : ""}${winnerId === seat.id ? " is-winner" : ""}`}>
            <header><b>{seat.name}</b>{winnerId === seat.id ? <span>WINS</span> : null}</header>
            <ul>
              {seat.cards.map((card) => (
                <li key={`${seat.id}-${card.id}`} style={{ "--card-color": rarityColor(card.rarity) } as CSSProperties}>
                  <img src={cardAsset(card.image_path)} alt="" />
                  <small>{card.rarity}</small>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className="minigame-actions">
        <button type="button" className="minigame-go" disabled={!selected || busy || balanceFen < costFen} onClick={rip}>
          RIP {selected ? `${selected.cost} ¥` : ""}
        </button>
        {(winnerId || lobby.length > 0) && (
          <span>{winnerId === "you" ? "Pot gehört dir." : winnerId ? "Der Bot nimmt alles." : "Gleichstand — dein Pack bleibt."}</span>
        )}
      </div>
    </GameFrame>
  );
}
