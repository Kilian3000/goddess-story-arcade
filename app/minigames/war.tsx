"use client";

import { useMemo, useState } from "react";
import { cardAsset } from "../arcade-config";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { CardStakePicker, type StakeCard } from "./card-stake-picker";
import { GameFrame } from "./game-frame";
import { closestValueCard, jackpotTierById, type JackpotTierId } from "./odds";
import { TableTiers } from "./table-tiers";

type Status = "idle" | "win" | "loss" | "push";

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

export function WarTable({ rows, catalog, valueFen, takeCards, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [tierId, setTierId] = useState<JackpotTierId>("lounge");
  const [status, setStatus] = useState<Status>("idle");
  const [bot, setBot] = useState<Card | null>(null);
  const you = rows.find((row) => row.card.id === selected[0]) || null;
  const candidates = useMemo(
    () => catalog.map((card) => ({ id: card.id, valueFen: valueFen(card.id, card.rarity) })),
    [catalog, valueFen],
  );
  const byId = useMemo(() => new Map(catalog.map((card) => [card.id, card])), [catalog]);

  const play = () => {
    if (!you || status !== "idle") return;
    const tier = jackpotTierById(tierId);
    const target = Math.max(tier.botMinFen, Math.min(you.valueFen, tier.botMaxFen));
    const match = closestValueCard(candidates, target, [you.card.id]);
    const foe = match ? byId.get(match.id) : null;
    if (!foe || !takeCards([you.card.id])) return;
    void playUiTap();
    onPulse();
    setBot(foe);
    const botFen = valueFen(foe.id, foe.rarity);
    if (you.valueFen > botFen) {
      grantCards([you.card.id, foe.id]);
      setStatus("win");
      void playWin(2);
    } else if (you.valueFen < botFen) {
      setStatus("loss");
      void playLoss();
    } else {
      grantCards([you.card.id]);
      setStatus("push");
      void playWin(1);
    }
    setSelected([]);
  };

  return (
    <GameFrame
      eyebrow="CARDS · WAR"
      title={<>W<i>AR</i></>}
      table={(
        <div className="war-arena">
          <article>
            <small>YOU</small>
            {you ? <img src={cardAsset(you.card.image_path)} alt="" /> : <span>Stake</span>}
            <b>{you ? `${formatYuan(you.valueFen)} ¥` : "—"}</b>
          </article>
          <article>
            <small>BOT</small>
            {bot ? <img src={cardAsset(bot.image_path)} alt="" /> : <span>?</span>}
            <b>{bot ? `${formatYuan(valueFen(bot.id, bot.rarity))} ¥` : "—"}</b>
          </article>
          {status !== "idle" && <p className={`war-result is-${status}`}>{status === "win" ? "Du nimmst beide." : status === "loss" ? "Einsatz verloren." : "Gleichstand — deine Karte bleibt."}</p>}
        </div>
      )}
      stake={<CardStakePicker rows={rows} selected={selected} onChange={(ids) => setSelected(ids.slice(-1))} max={1} disabled={status !== "idle"} />}
    >
      <details className="game-rules"><summary>Spielregeln</summary><p>Eine Karte gegen einen Bot derselben Klasse. Höherer Wert nimmt beide. Gleichstand: du behältst deine Karte.</p></details>
      <TableTiers value={tierId} onChange={setTierId} disabled={status !== "idle"} playUiTap={playUiTap} />
      <div className="minigame-actions">
        {status === "idle"
          ? <button type="button" className="minigame-go" disabled={!you} onClick={play}>WAR</button>
          : <button type="button" className="minigame-go" onClick={() => { setStatus("idle"); setBot(null); }}>AGAIN</button>}
      </div>
    </GameFrame>
  );
}
