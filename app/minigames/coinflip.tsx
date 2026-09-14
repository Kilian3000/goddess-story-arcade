"use client";

import { useMemo, useState } from "react";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { secureRandom } from "../gacha-engine";
import { CardStakePicker, StakeStrip, stakeValueFen, type StakeCard } from "./card-stake-picker";
import { GameFrame } from "./game-frame";
import { coinflipChance, matchCoinflipStake, rollChance } from "./odds";

type Status = "idle" | "flipping" | "win" | "loss";

type LockedCall = {
  ids: number[];
  playerIds: number[];
  playerFen: number;
  chance: number;
  even: boolean;
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

export function CoinflipTable({ rows, catalog, valueFen, takeCards, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [heads, setHeads] = useState(true);
  const [lockedCall, setLockedCall] = useState<LockedCall | null>(null);
  const candidates = useMemo(
    () => catalog.map((card) => ({ id: card.id, valueFen: valueFen(card.id, card.rarity) })),
    [catalog, valueFen],
  );
  const byId = useMemo(() => new Map(catalog.map((card) => [card.id, card])), [catalog]);
  const rowById = useMemo(() => new Map(rows.map((row) => [row.card.id, row.card])), [rows]);
  const stakeFen = stakeValueFen(rows, selected);
  const liveMatch = useMemo(() => {
    if (stakeFen <= 0) return null;
    const taken = new Set(selected);
    return matchCoinflipStake(candidates.filter((card) => !taken.has(card.id)), stakeFen);
  }, [candidates, selected, stakeFen]);
  const botIds = lockedCall?.ids ?? liveMatch?.ids ?? [];
  const shownPlayerIds = lockedCall?.playerIds ?? selected;
  const shownStakeFen = lockedCall?.playerFen ?? stakeFen;
  const playerCards = shownPlayerIds.map((id) => rowById.get(id) || byId.get(id)).filter(Boolean) as Card[];
  const botCards = botIds.map((id) => byId.get(id)).filter(Boolean) as Card[];
  const botFen = botCards.reduce((sum, card) => sum + valueFen(card.id, card.rarity), 0);
  const chance = lockedCall?.chance ?? coinflipChance(stakeFen, botFen);
  const even = lockedCall?.even ?? Boolean(liveMatch?.even);

  const flip = () => {
    if (!selected.length || !botIds.length || status !== "idle") return;
    const lockedBot = botIds;
    const lockedChance = chance;
    if (!takeCards(selected)) return;
    void playUiTap();
    onPulse();
    setLockedCall({ ids: lockedBot, playerIds: selected, playerFen: stakeFen, chance: lockedChance, even });
    const won = rollChance(lockedChance, secureRandom);
    setHeads(won);
    setStatus("flipping");
    window.setTimeout(() => {
      if (won) {
        grantCards([...selected, ...lockedBot]);
        setStatus("win");
        void playWin(2);
      } else {
        setStatus("loss");
        void playLoss();
      }
      onPulse();
      setSelected([]);
    }, 900);
  };

  const reset = () => {
    void playUiTap();
    setStatus("idle");
    setLockedCall(null);
  };

  return (
    <GameFrame
      eyebrow="CARDS · EVEN CALL"
      title={<>COIN<i>FLIP</i></>}
      stakeLabel="Deine Karten"
      table={(
        <aside className={`coin-bot${even ? " is-match" : ""}`} aria-live="polite">
          <div className="coin-duel">
            <section className="coin-you">
              <small>YOU · EINSATZ</small>
              <b>{shownStakeFen ? `${formatYuan(shownStakeFen)} ¥` : "—"}</b>
              <StakeStrip cards={playerCards} empty="Unten Karten setzen." />
            </section>
            <div className="coin-call">
              <div className={`coin-stage coin-${status}${heads ? " is-heads" : " is-tails"}`} aria-hidden="true">
                <div className="coin-disc">
                  <i>YOU</i>
                  <b>BOT</b>
                </div>
              </div>
              {status === "idle" && <button type="button" className="minigame-go" disabled={!selected.length || !botIds.length} onClick={flip}>FLIP {shownStakeFen && botFen ? `${Math.round(chance * 100)}%` : ""}</button>}
              {status === "flipping" && <span className="minigame-wait">CALLING…</span>}
              {status === "win" && <button type="button" className="minigame-go" onClick={reset}>YOU WIN · AGAIN</button>}
              {status === "loss" && <button type="button" className="minigame-go" onClick={reset}>BOT WINS · AGAIN</button>}
            </div>
            <section className="coin-vs">
              <small>BOT · {botCards.length <= 1 ? "1 KARTE" : `${botCards.length} KARTEN`}</small>
              <b>{botFen ? `${formatYuan(botFen)} ¥` : "—"}</b>
              <StakeStrip cards={botCards} empty={stakeFen ? "Kein nahes Match im Katalog." : "Antwortet nach deinem Einsatz."} />
            </section>
          </div>
          <p>
            {!shownStakeFen
              ? "Setze unten. Der Bot legt danach 1–2 Karten möglichst nah an deinen Wert."
              : !botFen
                ? "Kein Gegeneinsatz in der Nähe — ändere die Karten."
                : even
                  ? `Echter Flip · 50/50 · ${formatYuan(shownStakeFen)} ¥ vs ${formatYuan(botFen)} ¥`
                  : `Knappes Match ${Math.round(chance * 100)}% · ${formatYuan(shownStakeFen)} ¥ vs ${formatYuan(botFen)} ¥`}
          </p>
        </aside>
      )}
      stake={<CardStakePicker rows={rows} selected={status === "idle" ? selected : []} onChange={setSelected} disabled={status !== "idle"} />}
    >
      <details className="game-rules"><summary>Spielregeln</summary><p>
        Du setzt zuerst. Der Bot versucht danach, mit einer oder zwei Karten denselben Wert zu treffen. Liegt er nah genug, ist es ein echter 50/50-Flip. Viele kleine Karten können so gegen eine hochwertige stehen. Gewinnst du, nimmst du seine Karten; verlierst du, sind deine weg.
      </p></details>
    </GameFrame>
  );
}
