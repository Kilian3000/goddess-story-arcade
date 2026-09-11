"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { cardAsset } from "../arcade-config";
import { rarityColor } from "../arcade-ui";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { secureRandom } from "../gacha-engine";
import { CardStakePicker, stakeValueFen, type StakeCard } from "./card-stake-picker";
import { GameFrame } from "./game-frame";
import { coinflipChance, dealClassStake, jackpotTierById, rollChance, type JackpotTierId } from "./odds";
import { TableTiers } from "./table-tiers";

type Status = "idle" | "flipping" | "win" | "loss";

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

function CardStrip({ cards, empty }: { cards: Card[]; empty: string }) {
  if (!cards.length) return <p className="stake-empty">{empty}</p>;
  return (
    <ul className="pot-strip">
      {cards.map((card, index) => (
        <li key={`${card.id}-${index}`} style={{ "--card-color": rarityColor(card.rarity) } as CSSProperties}>
          <img src={cardAsset(card.image_path)} alt="" />
          <span>{card.character}</span>
        </li>
      ))}
    </ul>
  );
}

export function CoinflipTable({ rows, catalog, valueFen, takeCards, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [tierId, setTierId] = useState<JackpotTierId>("lounge");
  const [generation, setGeneration] = useState(0);
  const [botDeal, setBotDeal] = useState<{ key: string; ids: number[] } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [heads, setHeads] = useState(true);
  const candidates = useMemo(
    () => catalog.map((card) => ({ id: card.id, valueFen: valueFen(card.id, card.rarity) })),
    [catalog, valueFen],
  );
  const byId = useMemo(() => new Map(catalog.map((card) => [card.id, card])), [catalog]);
  const rowById = useMemo(() => new Map(rows.map((row) => [row.card.id, row.card])), [rows]);
  const tier = jackpotTierById(tierId);
  const catalogReady = candidates.length > 0;
  const dealKey = `${tierId}:${catalogReady ? "ready" : "empty"}:${generation}`;
  if (catalogReady && botDeal?.key !== dealKey) {
    setBotDeal({
      key: dealKey,
      ids: dealClassStake(candidates, tier, secureRandom).ids,
    });
  }
  const botIds = botDeal?.key === dealKey ? botDeal.ids : [];
  const stakeFen = stakeValueFen(rows, selected);
  const playerCards = selected.map((id) => rowById.get(id) || byId.get(id)).filter(Boolean) as Card[];
  const botCards = botIds.map((id) => byId.get(id)).filter(Boolean) as Card[];
  const botFen = botCards.reduce((sum, card) => sum + valueFen(card.id, card.rarity), 0);
  const chance = coinflipChance(stakeFen, botFen);
  const closeMatch = botFen > 0 && Math.abs(stakeFen - botFen) / botFen <= 0.12;

  const flip = () => {
    if (!selected.length || !botIds.length || status !== "idle") return;
    const lockedBot = botIds;
    const lockedChance = chance;
    if (!takeCards(selected)) return;
    void playUiTap();
    onPulse();
    setStatus("flipping");
    const won = rollChance(lockedChance, secureRandom);
    window.setTimeout(() => {
      setHeads(won);
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
      setGeneration((current) => current + 1);
    }, 900);
  };

  const reset = () => {
    void playUiTap();
    setStatus("idle");
    if (!botIds.length) setGeneration((current) => current + 1);
  };

  return (
    <GameFrame eyebrow="CARDS · CLASS CALL" title={<>COIN<i>FLIP</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>
        Ein Bot spielt immer dagegen. Die Klasse bestimmt seinen Einsatz der nächsten Runde — du siehst die Karten schon, bevor du matchst. Mehrere Karten sind erlaubt; die Chance folgt den Beträgen.
      </p></details>
      <TableTiers value={tierId} onChange={setTierId} disabled={status === "flipping"} playUiTap={playUiTap} label="Coinflip-Klasse" />
      <aside className={`coin-bot${closeMatch ? " is-match" : ""}`} aria-live="polite">
        <div className="coin-duel">
          <section>
            <small>YOU · EINSATZ</small>
            <b>{stakeFen ? `${formatYuan(stakeFen)} ¥` : "—"}</b>
            <CardStrip cards={playerCards} empty="Setze eine oder mehrere Karten." />
          </section>
          <div className={`coin-stage coin-${status}${heads ? " is-heads" : " is-tails"}`} aria-hidden="true">
            <i />
          </div>
          <section>
            <small>BOT · {tier.title} · NÄCHSTE RUNDE</small>
            <b>{botFen ? `${formatYuan(botFen)} ¥` : "—"}</b>
            <CardStrip cards={botCards} empty="Bot zieht noch…" />
          </section>
        </div>
        {stakeFen > 0 && botFen > 0 && (
          <p>
            Deine Chance {Math.round(chance * 100)}% · {formatYuan(stakeFen)} ¥ vs {formatYuan(botFen)} ¥
            {closeMatch ? " · nah am Match" : ""}
          </p>
        )}
      </aside>
      <CardStakePicker rows={rows} selected={status === "idle" ? selected : []} onChange={setSelected} disabled={status !== "idle"} />
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={!selected.length || !botIds.length} onClick={flip}>FLIP {stakeFen ? `${Math.round(chance * 100)}%` : ""}</button>}
        {status === "flipping" && <span className="minigame-wait">CALLING…</span>}
        {status === "win" && <button type="button" className="minigame-go" onClick={reset}>YOU TAKE THE POT · AGAIN</button>}
        {status === "loss" && <button type="button" className="minigame-go" onClick={reset}>BOT TAKES IT · AGAIN</button>}
      </div>
    </GameFrame>
  );
}
