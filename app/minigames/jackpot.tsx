"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { secureRandom } from "../gacha-engine";
import { CardStakePicker, stakeValueFen, type StakeCard } from "./card-stake-picker";
import { GameFrame } from "./game-frame";
import {
  jackpotBotCount,
  jackpotBotTargetFen,
  jackpotChance,
  jackpotTierById,
  jackpotWeights,
  pickCardsForValue,
  pickWeightedIndex,
  type JackpotTierId,
} from "./odds";
import { TableTiers } from "./table-tiers";

type Status = "idle" | "joining" | "spinning" | "win" | "loss";

type Entry = {
  id: string;
  name: string;
  color: string;
  cardIds: number[];
  valueFen: number;
  you?: boolean;
};

type Props = {
  rows: StakeCard[];
  catalog: Card[];
  valueFen: (cardId: number, rarity: string) => number;
  takeCards: (ids: number[]) => boolean;
  grantCards: (ids: number[]) => void;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

const BOT_NAMES = ["MAKIMA", "YELAN", "2B", "TIFA", "SHENHE", "NAMI", "ESDEATH"];
const BOT_COLORS = ["#ff2e9a", "#00ecff", "#f7ff4a", "#ff8dc9", "#7df0b3", "#ac88ff", "#ff955e"];

export function JackpotTable({ rows, catalog, valueFen, takeCards, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [tierId, setTierId] = useState<JackpotTierId>("lounge");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [winnerId, setWinnerId] = useState("");
  const [rotation, setRotation] = useState(0);
  const timers = useRef<number[]>([]);
  const byId = useMemo(() => new Map(catalog.map((card) => [card.id, card])), [catalog]);
  const candidates = useMemo(
    () => catalog.map((card) => ({ id: card.id, valueFen: valueFen(card.id, card.rarity) })),
    [catalog, valueFen],
  );
  const tier = jackpotTierById(tierId);
  const potFen = entries.reduce((sum, entry) => sum + entry.valueFen, 0);
  const you = entries.find((entry) => entry.you);
  const chance = you ? jackpotChance(you.valueFen, potFen) : 0;
  const tablePool = useMemo(
    () => candidates.filter((card) => card.valueFen <= tier.botMaxFen * 1.15),
    [candidates, tier.botMaxFen],
  );

  useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer);
  }, []);

  const finish = (lobby: Entry[], winner: Entry) => {
    const botCards = lobby.filter((entry) => !entry.you).flatMap((entry) => entry.cardIds);
    if (winner.you) {
      grantCards([...winner.cardIds, ...botCards]);
      setStatus("win");
      void playWin(10);
    } else {
      setStatus("loss");
      void playLoss();
    }
    onPulse();
    setSelected([]);
  };

  const join = () => {
    if (!selected.length || status !== "idle") return;
    const stakeFen = stakeValueFen(rows, selected);
    if (!takeCards(selected)) return;
    void playUiTap();
    onPulse();
    const youEntry: Entry = {
      id: "you",
      name: "YOU",
      color: "#f7ff4a",
      cardIds: selected,
      valueFen: stakeFen,
      you: true,
    };
    const botCount = jackpotBotCount(tier, secureRandom);
    const pool = tablePool.length ? tablePool : candidates;
    let lobby = [youEntry];
    setEntries(lobby);
    setStatus("joining");

    for (let index = 0; index < botCount; index += 1) {
      const timer = window.setTimeout(() => {
        const target = jackpotBotTargetFen(tier, secureRandom);
        const cardIds = pickCardsForValue(pool, target, secureRandom, tier.id === "street" ? 3 : 5);
        const value = cardIds.reduce((sum, id) => sum + (candidates.find((card) => card.id === id)?.valueFen || 0), 0);
        const bot: Entry = {
          id: `bot-${index}`,
          name: BOT_NAMES[index % BOT_NAMES.length],
          color: BOT_COLORS[index % BOT_COLORS.length],
          cardIds,
          valueFen: value || target,
        };
        lobby = [...lobby, bot];
        setEntries(lobby);
        if (index === botCount - 1) {
          const spinTimer = window.setTimeout(() => {
            const weights = jackpotWeights(lobby.map((entry) => entry.valueFen), lobby.findIndex((entry) => entry.you));
            const winner = lobby[pickWeightedIndex(weights, secureRandom)];
            const start = lobby.slice(0, lobby.findIndex((entry) => entry.id === winner.id)).reduce((sum, entry) => sum + entry.valueFen, 0);
            const mid = start + winner.valueFen / 2;
            const deg = 360 - (mid / Math.max(1, lobby.reduce((sum, entry) => sum + entry.valueFen, 0))) * 360;
            setWinnerId(winner.id);
            setRotation(360 * 6 + deg);
            setStatus("spinning");
            const settle = window.setTimeout(() => finish(lobby, winner), 2600);
            timers.current.push(settle);
          }, 700);
          timers.current.push(spinTimer);
        }
      }, 450 + index * 420);
      timers.current.push(timer);
    }
  };

  const reset = () => {
    void playUiTap();
    setStatus("idle");
    setEntries([]);
    setWinnerId("");
    setRotation(0);
  };

  const gradient = entries.length
    ? entries.reduce((css, entry, index, list) => {
      const start = list.slice(0, index).reduce((sum, item) => sum + item.valueFen, 0) / potFen * 100;
      const end = start + (entry.valueFen / potFen) * 100;
      return `${css}${css ? "," : ""} ${entry.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    }, "")
    : "#221018 0 100%";

  return (
    <GameFrame eyebrow="CARDS · WINNER TAKES ALL" title={<>JACK<i>POT</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Wähle die Tischklasse — sie begrenzt, wie hoch die Bots setzen. Dein eigener Einsatz darf darüber oder darunter liegen.</p></details>
      <TableTiers value={tierId} onChange={setTierId} disabled={status !== "idle"} playUiTap={playUiTap} />
      <CardStakePicker rows={rows} selected={status === "idle" ? selected : []} onChange={setSelected} disabled={status !== "idle"} />
      <div className="jackpot-wheel-wrap">
        <div
          className={`jackpot-wheel${status === "spinning" ? " is-spinning" : ""}`}
          style={{ background: `conic-gradient(${gradient})`, transform: `rotate(${rotation}deg)` }}
          aria-hidden="true"
        />
        <i />
        <b>{status === "idle" ? tier.title.replace(" CLASS", "") : `${Math.round(chance * 100)}%`}</b>
      </div>
      <ul className="jackpot-lobby">
        {entries.map((entry) => (
          <li key={entry.id} className={winnerId === entry.id ? "is-winner" : ""} style={{ "--entry": entry.color } as CSSProperties}>
            <strong>{entry.name}</strong>
            <span>{entry.cardIds.length} cards · {formatYuan(entry.valueFen)} ¥</span>
            <div>
              {entry.cardIds.slice(0, 4).map((id) => {
                const card = byId.get(id);
                return card ? <img key={`${entry.id}-${id}`} src={cardAsset(card.image_path)} alt="" /> : null;
              })}
            </div>
          </li>
        ))}
      </ul>
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={!selected.length} onClick={join}>JOIN POT {formatYuan(stakeValueFen(rows, selected))} ¥</button>}
        {status === "joining" && <span className="minigame-wait">LOBBY FILLING…</span>}
        {status === "spinning" && <span className="minigame-wait">SPINNING THE POT…</span>}
        {status === "win" && <button type="button" className="minigame-go" onClick={reset}>YOU HIT THE POT · AGAIN</button>}
        {status === "loss" && <button type="button" className="minigame-go" onClick={reset}>HOUSE KEEPS IT · AGAIN</button>}
      </div>
    </GameFrame>
  );
}
