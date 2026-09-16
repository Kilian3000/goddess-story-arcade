"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { cardAsset } from "../arcade-config";
import { rarityColor } from "../arcade-ui";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { WONDER_CAP, wonderBoards } from "../arcade-meta";
import { useArcadeMeta } from "../use-arcade-meta";
import { useEconomy } from "../use-economy";
import { CardStakePicker } from "./card-stake-picker";
import { GameFrame } from "./game-frame";

type Props = {
  catalog: Card[];
  grantCards: (ids: number[]) => void;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

export function SisterRipTable({ catalog, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const arcade = useArcadeMeta();
  const { state, takeCards, valueFen } = useEconomy();
  const byId = useMemo(() => new Map(catalog.map((card) => [card.id, card])), [catalog]);
  const boards = wonderBoards(arcade.meta, 5);
  const [tab, setTab] = useState<"rip" | "lay">("rip");
  const [activeId, setActiveId] = useState(boards[0]?.id || "");
  const [hidden, setHidden] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [laid, setLaid] = useState<number[]>([]);
  const active = boards.find((board) => board.id === activeId) || boards[0] || null;
  const cards = (active?.cardIds || []).slice(0, 5).map((id) => byId.get(id)).filter(Boolean) as Card[];
  const line = laid[0] ? byId.get(laid[0])?.set_name : null;
  const extras = Object.entries(state.cards).flatMap(([id, count]) => {
    const card = byId.get(Number(id));
    if (!card || count < 2 || (line && card.set_name !== line)) return [];
    return [{ card, count: count - 1, valueFen: valueFen(card.id, card.rarity) }];
  });

  const choose = (index: number) => {
    if (!active || picked != null) return;
    if (!hidden) {
      void playUiTap();
      setHidden(true);
      return;
    }
    const card = cards[index];
    const spent = arcade.spendWonder(active.id);
    if (!spent.ok || !card) {
      void playLoss();
      return;
    }
    grantCards([card.id]);
    onPulse();
    setPicked(index);
    void playWin(1);
  };

  const lay = () => {
    if (laid.length < 5) return;
    const setName = byId.get(laid[0])?.set_name || "REVERSE";
    if (!takeCards(laid)) return;
    const placed = arcade.placeReverseBoard(laid, setName);
    if (!placed.ok) {
      grantCards(laid);
      return;
    }
    onPulse();
    setLaid([]);
    void playWin(1);
  };

  return (
    <GameFrame eyebrow="RIPS · SISTER RIP" title={<>SISTER<i> RIP</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Kopiere eine Karte aus einem alten Pack. Oder lege fünf Excess für dein zukünftiges Ich — bereit in 12 Stunden.</p></details>
      <div className="binder-toolbar">
        <button type="button" className={tab === "rip" ? "is-active" : ""} onClick={() => setTab("rip")}>Rip</button>
        <button type="button" className={tab === "lay" ? "is-active" : ""} onClick={() => setTab("lay")}>Lege Board</button>
      </div>
      <p className="sister-charges">Ladungen {arcade.meta.wonderCharges}/{WONDER_CAP}</p>
      {tab === "rip" && (
        <>
          {!boards.length && <p className="stake-empty">Noch keine ripbaren Packs. Öffne zuerst Booster am Altar.</p>}
          {boards.length > 0 && (
            <div className="sister-boards">
              {boards.slice(0, 8).map((board) => (
                <button key={board.id} type="button" className={board.id === active?.id ? "is-active" : ""} onClick={() => { setActiveId(board.id); setHidden(false); setPicked(null); }}>
                  <b>{board.setName}</b>
                  <small>{formatYuan(board.bestFen)} ¥</small>
                </button>
              ))}
            </div>
          )}
          <div className={`sister-hand${hidden ? " is-hidden" : ""}`}>
            {cards.map((card, index) => (
              <button key={`${card.id}-${index}`} type="button" className={picked === index ? "is-picked" : ""} style={{ "--card-color": rarityColor(card.rarity) } as CSSProperties} onClick={() => choose(index)} disabled={arcade.meta.wonderCharges < 1 && picked == null}>
                {hidden && picked !== index ? <span>?</span> : <img src={cardAsset(card.image_path)} alt="" />}
                {!hidden && <small>{card.rarity}</small>}
              </button>
            ))}
          </div>
          <div className="minigame-actions">
            {active && !hidden && <button type="button" className="minigame-go" onClick={() => { void playUiTap(); setHidden(true); }}>UMDREHEN</button>}
            {picked != null && <span>Kopie liegt im Binder.</span>}
          </div>
        </>
      )}
      {tab === "lay" && (
        <>
          <p>Wähle 5 Excess derselben Collection. Masse: Doubles, Rarity, Wert, Set.</p>
          <CardStakePicker
            rows={extras}
            selected={laid}
            onChange={(ids) => {
              if (!ids.length) {
                setLaid([]);
                return;
              }
              const tallies = new Map<string, number>();
              for (const id of ids) {
                const setName = byId.get(id)?.set_name;
                if (setName) tallies.set(setName, (tallies.get(setName) || 0) + 1);
              }
              const setName = [...tallies.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
              setLaid(ids.filter((id) => byId.get(id)?.set_name === setName).slice(0, 5));
            }}
            max={5}
            emptyHint="Keine Excess-Karten für ein Reverse-Board."
          />
          <div className="minigame-actions">
            <button type="button" className="minigame-go" disabled={laid.length < 5} onClick={lay}>LEGEN {laid.length}/5</button>
          </div>
        </>
      )}
    </GameFrame>
  );
}
