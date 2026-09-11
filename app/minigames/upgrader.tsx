"use client";

import { useState } from "react";
import { cardAsset } from "../arcade-config";
import { rarityColor } from "../arcade-ui";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { secureRandom } from "../gacha-engine";
import { CardStakePicker, type StakeCard } from "./card-stake-picker";
import { GameFrame } from "./game-frame";
import { rankUpgradeTargets, rollChance, upgraderTargetFen } from "./odds";

type Status = "idle" | "rolling" | "win" | "loss";

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

type TargetRow = {
  id: number;
  valueFen: number;
  chance: number;
  delta: number;
  card: Card;
};

const ROW_SIZE = 8;
const SEARCH_ROW_SIZE = 16;

function cardMatchesQuery(card: Card, needle: string) {
  if (!needle) return true;
  return [card.character, card.title, card.set_name, card.rarity].some((value) => value?.toLowerCase().includes(needle));
}

function buildUpgradeTargets(
  catalog: Card[],
  valueFen: (cardId: number, rarity: string) => number,
  stakeValue: number,
  desiredChance: number,
  query: string,
) {
  if (stakeValue <= 0) return [] as TargetRow[];
  const needle = query.trim().toLowerCase();
  const pool = catalog.flatMap((card) => (
    cardMatchesQuery(card, needle)
      ? [{ id: card.id, valueFen: valueFen(card.id, card.rarity) }]
      : []
  ));
  return rankUpgradeTargets(pool, stakeValue, desiredChance, needle ? SEARCH_ROW_SIZE : ROW_SIZE).flatMap((row) => {
    const card = catalog.find((item) => item.id === row.id);
    return card ? [{ ...row, card }] : [];
  });
}

export function UpgraderTable({ rows, catalog, valueFen, takeCards, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [pickEpoch, setPickEpoch] = useState("");
  const [query, setQuery] = useState("");
  const [desiredPct, setDesiredPct] = useState(40);
  const [status, setStatus] = useState<Status>("idle");
  const stake = rows.find((row) => row.card.id === selected[0]) || null;
  const stakeFen = stake ? stake.valueFen : 0;
  const desired = desiredPct / 100;
  const idealFen = upgraderTargetFen(stakeFen, desired);
  const epoch = `${desiredPct}|${query}|${stakeFen}`;

  const targets = buildUpgradeTargets(catalog, valueFen, stakeFen, desired, query);

  const target = (
    pickEpoch === epoch && pickedId != null
      ? targets.find((row) => row.id === pickedId)
      : null
  ) || targets[0] || null;
  const chance = target && target.valueFen > stakeFen ? target.chance : 0;

  const chooseTarget = (id: number) => {
    setPickedId(id);
    setPickEpoch(epoch);
  };

  const roll = () => {
    if (!stake || !target || !chance || status !== "idle") return;
    if (!takeCards([stake.card.id])) return;
    void playUiTap();
    onPulse();
    setStatus("rolling");
    const won = rollChance(chance, secureRandom);
    window.setTimeout(() => {
      if (won) {
        grantCards([target.card.id]);
        setStatus("win");
        void playWin(5);
      } else {
        setStatus("loss");
        void playLoss();
      }
      onPulse();
      setSelected([]);
      setPickedId(null);
      setPickEpoch("");
    }, 700);
  };

  const reset = () => {
    void playUiTap();
    setStatus("idle");
    setPickedId(null);
    setPickEpoch("");
  };

  return (
    <GameFrame eyebrow="CARDS · RISK UP" title={<>UPGRAD<i>ER</i></>}>
      <p className="minigame-copy">
        Setze eine Karte, stelle die Wunschchance ein und nimm ein Ziel aus der passenden Reihe. Über die Suche findest du ein konkretes Upgrade nach Charakter, Titel oder Set.
      </p>
      <CardStakePicker rows={rows} selected={status === "idle" ? selected : []} onChange={setSelected} max={1} disabled={status !== "idle"} />
      {stake && (
        <div className="upgrade-target">
          <label className="upgrade-chance">
            <span>WUNSCHCHANCE · {desiredPct}%</span>
            <input
              type="range"
              min={5}
              max={90}
              step={1}
              value={desiredPct}
              disabled={status !== "idle"}
              onChange={(event) => setDesiredPct(Number(event.target.value))}
            />
            <small>Beste Treffer um {formatYuan(idealFen)} ¥</small>
          </label>
          <label>
            <span>SUCHE · Charakter, Anime-Titel, Set</span>
            <input
              className="stake-search"
              type="search"
              placeholder="z. B. Makima, Genshin, NS-05…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={status !== "idle"}
            />
          </label>
          {target && (
            <p className="stake-summary">
              Ziel {target.card.character} · {formatYuan(target.valueFen)} ¥ · {Math.round(chance * 100)}%
            </p>
          )}
          {targets.length === 0 ? (
            <p className="stake-empty">{query ? "Kein teureres Upgrade zu dieser Suche." : "Kein teureres Ziel in der Nähe dieser Chance."}</p>
          ) : (
            <ul className="upgrade-row" aria-label="Passende Upgrade-Ziele">
              {targets.map((row) => (
                <li key={row.id}>
                  <button type="button" className={target?.id === row.id ? "is-active" : ""} disabled={status !== "idle"} onClick={() => chooseTarget(row.id)}>
                    <img src={cardAsset(row.card.image_path)} alt="" />
                    <b style={{ color: rarityColor(row.card.rarity) }}>{row.card.rarity}</b>
                    <strong>{row.card.character}</strong>
                    <small>{row.card.title || row.card.set_name}</small>
                    <em>{formatYuan(row.valueFen)} ¥ · {Math.round(row.chance * 100)}%</em>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={!stake || !target || !chance} onClick={roll}>ROLL {chance ? `${Math.round(chance * 100)}%` : ""}</button>}
        {status === "rolling" && <span className="minigame-wait">ROLLING…</span>}
        {status === "win" && <button type="button" className="minigame-go" onClick={reset}>UPGRADED · AGAIN</button>}
        {status === "loss" && <button type="button" className="minigame-go" onClick={reset}>BURNED · AGAIN</button>}
      </div>
    </GameFrame>
  );
}
