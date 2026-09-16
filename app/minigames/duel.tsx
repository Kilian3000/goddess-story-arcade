"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";
import { rarityTier } from "../gacha-engine";
import { CardStakePicker, type StakeCard } from "./card-stake-picker";
import { GameFrame } from "./game-frame";
import { closestValueCard, duelAtk, jackpotTierById, type JackpotTierId } from "./odds";
import { TableTiers } from "./table-tiers";

type Status = "idle" | "timing" | "win" | "loss";

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

export function DuelTable({ rows, catalog, valueFen, takeCards, grantCards, onPulse, playUiTap, playWin, playLoss }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [tierId, setTierId] = useState<JackpotTierId>("lounge");
  const [status, setStatus] = useState<Status>("idle");
  const [youScore, setYouScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [round, setRound] = useState(1);
  const [cursor, setCursor] = useState(8);
  const [foe, setFoe] = useState<Card | null>(null);
  const you = rows.find((row) => row.card.id === selected[0]) || null;
  const frame = useRef(0);
  const byId = useMemo(() => new Map(catalog.map((card) => [card.id, card])), [catalog]);
  const candidates = useMemo(
    () => catalog.map((card) => ({ id: card.id, valueFen: valueFen(card.id, card.rarity) })),
    [catalog, valueFen],
  );

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  const start = () => {
    if (!you || status !== "idle") return;
    const tier = jackpotTierById(tierId);
    const inClass = candidates.filter((card) => card.valueFen >= tier.botMinFen && card.valueFen <= tier.botMaxFen);
    const match = closestValueCard(inClass.length ? inClass : candidates, you.valueFen, [you.card.id]);
    const bot = match ? byId.get(match.id) : null;
    if (!bot) return;
    void playUiTap();
    setFoe(bot);
    setYouScore(0);
    setBotScore(0);
    setRound(1);
    setStatus("timing");
    swing();
  };

  const swing = () => {
    const started = performance.now();
    const tick = (now: number) => {
      const t = ((now - started) / 900) % 2;
      setCursor(t < 1 ? t * 100 : (2 - t) * 100);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const lock = () => {
    if (status !== "timing" || !you || !foe) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    const perfect = cursor >= 38 && cursor <= 62;
    const youAtk = Math.round(duelAtk(rarityTier(you.card.rarity), you.valueFen) * (perfect ? 1.1 : 1));
    const botAtk = duelAtk(rarityTier(foe.rarity), valueFen(foe.id, foe.rarity));
    const nextYou = youScore + (youAtk >= botAtk ? 1 : 0);
    const nextBot = botScore + (youAtk < botAtk ? 1 : 0);
    setYouScore(nextYou);
    setBotScore(nextBot);
    if (nextYou >= 2 || nextBot >= 2 || round >= 3) {
      finish(nextYou > nextBot);
      return;
    }
    setRound((value) => value + 1);
    swing();
  };

  const finish = (won: boolean) => {
    if (!you || !foe) return;
    if (!takeCards([you.card.id])) return;
    onPulse();
    if (won) {
      grantCards([you.card.id, foe.id]);
      setStatus("win");
      void playWin(2);
    } else {
      setStatus("loss");
      void playLoss();
    }
    setSelected([]);
  };

  return (
    <GameFrame
      eyebrow="SKILL · DUEL"
      title={<>DU<i>EL</i></>}
      table={(
        <div className="duel-arena">
          <p>Best of 3 · Runde {round} · {youScore}:{botScore}</p>
          <div className={`duel-track${status === "timing" ? " is-live" : ""}`} style={{ "--cursor": `${cursor}%` } as CSSProperties}>
            <i className="duel-window" />
            <b />
          </div>
          {foe && <small>Bot {foe.character} · {formatYuan(valueFen(foe.id, foe.rarity))} ¥</small>}
          {status === "win" && <p>Sieg — Bot-Karte gehört dir.</p>}
          {status === "loss" && <p>Niederlage — Einsatz weg.</p>}
        </div>
      )}
      stake={<CardStakePicker rows={rows} selected={selected} onChange={(ids) => setSelected(ids.slice(-1))} max={1} disabled={status === "timing"} />}
    >
      <details className="game-rules"><summary>Spielregeln</summary><p>ATK aus Rarity und Wert. Triff das Fenster für +10%. Best of 3. Sieg holt eine Bot-Karte ähnlichen Werts, Niederlage kostet den Einsatz.</p></details>
      <TableTiers value={tierId} onChange={setTierId} disabled={status === "timing"} playUiTap={playUiTap} />
      <div className="minigame-actions">
        {status === "idle" && <button type="button" className="minigame-go" disabled={!you} onClick={start}>DUELL</button>}
        {status === "timing" && <button type="button" className="minigame-go" onClick={lock}>LOCK</button>}
        {(status === "win" || status === "loss") && <button type="button" className="minigame-go" onClick={() => { setStatus("idle"); setFoe(null); }}>AGAIN</button>}
      </div>
    </GameFrame>
  );
}
