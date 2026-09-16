"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { cardAsset } from "../arcade-config";
import { rarityColor } from "../arcade-ui";
import type { Card } from "../card-types";
import { formatYuan, yuanToFen } from "../economy";
import { compilePackRecipe, type PackConfig } from "../gacha-engine";
import { drawThrowawayPacks, poolForRarity } from "../pack-draw";
import { useArcadeMeta } from "../use-arcade-meta";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";

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

export function LastPackTable({ packs, allCards, valueFen, balanceFen, spend, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const arcade = useArcadeMeta();
  const [packId, setPackId] = useState(packs[0]?.id ?? 0);
  const [boards, setBoards] = useState<Card[][]>([]);
  const [hidden, setHidden] = useState(false);
  const [struck, setStruck] = useState<number[]>([]);
  const [kept, setKept] = useState<number | null>(null);
  const [broke, setBroke] = useState(false);
  const selected = packs.find((pack) => pack.id === packId) || packs[0] || null;
  const costFen = selected ? yuanToFen(selected.cost) : 0;
  const recipe = useMemo(() => {
    if (!selected) return null;
    const rarities = new Set(allCards.filter((card) => card.set_name === selected.setName).map((card) => card.rarity));
    return rarities.size ? compilePackRecipe(selected, rarities) : null;
  }, [allCards, selected]);

  const deal = () => {
    if (!selected || !recipe) return;
    void playUiTap();
    const next = Array.from({ length: 5 }, () => {
      const drawn = drawThrowawayPacks({
        config: selected,
        recipe,
        getPool: (rarity) => poolForRarity(allCards, packs, selected, rarity),
        count: 1,
      });
      return drawn.ok ? drawn.packs[0] : [];
    });
    setBoards(next);
    setHidden(false);
    setStruck([]);
    setKept(null);
    setBroke(false);
  };

  const hide = () => {
    void playUiTap();
    setHidden(true);
  };

  const strike = (index: number) => {
    if (kept != null || struck.includes(index) || !hidden) return;
    const next = [...struck, index];
    if (next.length < 4) {
      setStruck(next);
      return;
    }
    const last = [0, 1, 2, 3, 4].find((slot) => !next.includes(slot));
    if (last == null || !selected) return;
    if (balanceFen < costFen || !spend(costFen)) {
      setBroke(true);
      void playLoss();
      return;
    }
    const keptCards = boards[last];
    grantCards(keptCards.map((card) => card.id));
    arcade.recordPulls([{
      setName: selected.setName,
      costYuan: selected.cost,
      cardIds: keptCards.map((card) => card.id),
      openedAt: Date.now(),
      bestFen: keptCards.reduce((best, card) => Math.max(best, valueFen(card.id, card.rarity)), 0),
      source: "lastpack",
    }], {});
    onPulse();
    setStruck(next);
    setKept(last);
    void playWin(selected.cost);
  };

  const keptCards = kept != null ? boards[kept] : [];
  const keptFen = keptCards.reduce((sum, card) => sum + valueFen(card.id, card.rarity), 0);
  const need = 4 - struck.length;

  return (
    <GameFrame eyebrow="RIPS · LAST PACK" title={<>LAST <i>PACK</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Fünf Throwaway-Hüllen, nicht deine Box. Kurz ansehen, zudecken, vier streichen. Du zahlst erst das letzte Pack — die fünf Karten gehören dir.</p></details>
      <label className="battle-controls">
        <span>Set</span>
        <select value={packId} onChange={(event) => setPackId(Number(event.target.value))} disabled={boards.length > 0 && kept == null}>
          {packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.setName} · {pack.cost} ¥</option>)}
        </select>
      </label>
      {boards.length > 0 && kept == null && (
        <p className="game-hint">{hidden ? `Streiche noch ${need} Hülle${need === 1 ? "" : "n"}. Die letzte kostet ${selected?.cost ?? 0} ¥.` : "Rarities merken, dann zudecken."}</p>
      )}
      <div className="last-pack-grid">
        {boards.map((board, index) => (
          <button key={index} type="button" className={`${struck.includes(index) ? "is-out" : ""}${kept === index ? " is-kept" : ""}`} onClick={() => strike(index)} disabled={kept != null || !hidden || struck.includes(index)}>
            <b>HÜLLE {index + 1}</b>
            <ul>
              {board.map((card, slot) => (
                <li key={`${card.id}-${slot}`} style={{ "--card-color": rarityColor(card.rarity) } as CSSProperties}>
                  {hidden && kept !== index && !struck.includes(index) ? <span className="face-down">?</span> : <img src={cardAsset(card.image_path)} alt="" />}
                  {!hidden && <small>{card.rarity}</small>}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      {kept != null && keptCards[0] && (
        <GameResult
          tone="win"
          title={`Dein Pack · ${formatYuan(keptFen)} ¥`}
          detail={`${keptCards.length} Karten aus ${selected?.setName} für ${selected?.cost} ¥. Beste: ${keptCards.reduce((best, card) => valueFen(card.id, card.rarity) > valueFen(best.id, best.rarity) ? card : best).rarity} ${keptCards.reduce((best, card) => valueFen(card.id, card.rarity) > valueFen(best.id, best.rarity) ? card : best).character}.`}
        />
      )}
      {broke && <GameResult tone="loss" title="Nicht genug Yuan" detail="Die letzte Hülle bleibt liegen. Streichen hat nichts gekostet — du zahlst erst beim Rip." />}
      <div className="minigame-actions">
        {boards.length === 0 && <button type="button" className="minigame-go" onClick={deal} disabled={!selected}>FÜNF HÜLLEN</button>}
        {boards.length > 0 && !hidden && <button type="button" className="minigame-go" onClick={hide}>ZUDECKEN</button>}
        {kept != null && <button type="button" className="minigame-go" onClick={() => { setBoards([]); setKept(null); setStruck([]); setBroke(false); }}>AGAIN</button>}
        {broke && <button type="button" className="minigame-go" onClick={() => { setBoards([]); setStruck([]); setBroke(false); }}>ABBRECHEN</button>}
      </div>
    </GameFrame>
  );
}
