"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatYuan } from "../economy";
import { rainFen, skillConsolationFen } from "../arcade-meta";
import type { Card } from "../card-types";
import type { PackConfig } from "../gacha-engine";
import type { WaifuMuse } from "../lucky-shrine";
import { LuckyShrine } from "../lucky-shrine";
import { TemptationDuel } from "../temptation-duel";
import { useArcadeMeta } from "../use-arcade-meta";
import { useEconomy } from "../use-economy";
import { AppIcon, MINIGAME_ICONS } from "../ui-icons";
import { CaboTable } from "./cabo";
import { CoinflipTable } from "./coinflip";
import { CrashTable } from "./crash";
import { DuelTable } from "./duel";
import { GachaponTable } from "./gachapon";
import { HiloTable } from "./hilo";
import { JackpotTable } from "./jackpot";
import { KoiKoiTable } from "./koi-koi";
import { LastPackTable } from "./last-pack";
import { LoveLetterTable } from "./love-letter";
import { MemoryTable } from "./memory";
import { MindTable } from "./mind";
import { MinesTable } from "./mines";
import { MonteTable } from "./monte";
import { PackBattleTable } from "./pack-battle";
import { MINIGAME_GROUPS, minigameById, type MinigameId, type MinigameKind } from "./registry";
import { RouletteTable } from "./roulette";
import { ScopaTable } from "./scopa";
import { SisterRipTable } from "./sister-rip";
import { SpeedTable } from "./speed";
import { UfoTable } from "./ufo";
import { UpgraderTable } from "./upgrader";
import { WarTable } from "./war";
import type { StakeCard } from "./card-stake-picker";

const STAMP_ORDER: MinigameKind[] = ["skill", "house", "cards", "rips", "gesen"];

type Props = {
  catalog: PackConfig[];
  ready: boolean;
  muses: WaifuMuse[];
  allCards: Card[];
  activeGame: MinigameId;
  onSelectGame: (id: MinigameId) => void;
  onClaim: (pack: PackConfig, source: MinigameId) => void;
  onPulse: () => void;
  startMusic: () => Promise<void>;
  playDrop: (lane?: number) => Promise<void>;
  playBounce: (index: number) => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLock: (quality: "perfect" | "hit" | "miss", streak: number) => Promise<void>;
  playUiTap: () => Promise<void>;
  playStart: () => Promise<void>;
  playLoss: () => Promise<void>;
};

export function MinigameHub({
  catalog,
  ready,
  muses,
  allCards,
  activeGame,
  onSelectGame,
  onClaim,
  onPulse,
  startMusic,
  playDrop,
  playBounce,
  playWin,
  playLock,
  playUiTap,
  playStart,
  playLoss,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const activeGameRef = useRef<HTMLButtonElement | null>(null);
  const { state, valueFen, spend, credit, takeCards, grantCards } = useEconomy();
  const arcade = useArcadeMeta();
  const [stamps, setStamps] = useState<string[]>(() => arcade.sessionStamps());
  const [ghost, setGhost] = useState(() => arcade.ghostOn());
  const byId = useMemo(() => new Map(allCards.map((card) => [card.id, card])), [allCards]);
  const rows = useMemo<StakeCard[]>(() => (
    Object.entries(state.cards).flatMap(([id, count]) => {
      const card = byId.get(Number(id));
      if (!card) return [];
      return [{ card, count, valueFen: valueFen(card.id, card.rarity) }];
    }).sort((left, right) => right.valueFen - left.valueFen || left.card.set_name.localeCompare(right.card.set_name))
  ), [byId, state.cards, valueFen]);
  const cheapCards = useMemo(() => {
    const cheapSets = new Set(catalog.filter((pack) => pack.cost === 1).map((pack) => pack.setName));
    const pool = allCards.filter((card) => cheapSets.has(card.set_name));
    return pool.length ? pool : allCards;
  }, [allCards, catalog]);

  const house = {
    balanceFen: state.balanceFen,
    spend,
    credit,
    onPulse,
    playUiTap,
    playWin,
    playLoss,
  };
  const cards = { rows, catalog: allCards, valueFen, takeCards, grantCards, onPulse, playUiTap, playWin, playLoss };

  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 });
    const rail = railRef.current;
    const active = activeGameRef.current;
    if (!rail || !active || !window.matchMedia("(max-width: 700px)").matches) return;
    const frame = window.requestAnimationFrame(() => {
      const left = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
      rail.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeGame]);

  const skillClaimed = (id: MinigameId) => arcade.hasSkillClaim(id);
  const pickGame = (id: MinigameId) => {
    void playUiTap();
    const game = minigameById(id);
    if (game) {
      const stamped = arcade.stampGroup(game.kind);
      setStamps(stamped.stamps);
      if (stamped.filled) {
        const fen = rainFen();
        if (credit(fen)) onPulse();
      }
    }
    onSelectGame(id);
  };

  return (
    <div className="minigame-hub">
      <nav ref={railRef} className="minigame-rail" aria-label="Minispiele">
        <div className="hub-meta">
          <span className="stamp-card" aria-label="Session-Stempel">
            {STAMP_ORDER.map((group) => (
              <i key={group} className={stamps.includes(group) ? "is-on" : ""} title={group} />
            ))}
          </span>
          <button type="button" className={ghost ? "is-active" : ""} aria-pressed={ghost} onClick={() => { const next = !ghost; arcade.setGhost(next); setGhost(next); }}>
            GHOST {ghost ? "ON" : "OFF"}
          </button>
        </div>
        {MINIGAME_GROUPS.map((group) => (
          <div key={group.id} className={`minigame-rail-group kind-${group.id}`}>
            <small>{group.label}</small>
            {group.games.map((id) => {
              const game = minigameById(id);
              if (!game) return null;
              return (
                <button
                  key={id}
                  ref={activeGame === id ? activeGameRef : undefined}
                  type="button"
                  className={activeGame === id ? "is-active" : ""}
                  aria-current={activeGame === id ? "page" : undefined}
                  onClick={() => pickGame(id)}
                >
                  <i><AppIcon name={MINIGAME_ICONS[game.id]} /></i>
                  <b>{game.title}</b>
                  <span>{game.blurb}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div ref={stageRef} className="minigame-stage" role="region" aria-label={minigameById(activeGame)?.title || "Minigame"}>
        {activeGame === "waifu21" && (
          <LuckyShrine
            catalog={catalog}
            ready={ready}
            muses={muses}
            onClaim={(pack) => onClaim(pack, "waifu21")}
            claimLabel={skillClaimed("waifu21") ? `HEUTE ${formatYuan(skillConsolationFen(1))}–${formatYuan(skillConsolationFen(10))} ¥` : undefined}
            playDrop={playDrop}
            playBounce={playBounce}
            playWin={playWin}
          />
        )}
        {activeGame === "heartlock" && (
          <TemptationDuel
            catalog={catalog}
            ready={ready}
            muses={muses}
            onClaim={(pack) => onClaim(pack, "heartlock")}
            claimLabel={skillClaimed("heartlock") ? `HEUTE ${formatYuan(skillConsolationFen(1))}–${formatYuan(skillConsolationFen(10))} ¥` : undefined}
            startMusic={startMusic}
            playLock={playLock}
            playUiTap={playUiTap}
            playStart={playStart}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "memory" && (
          <MemoryTable
            rows={rows}
            catalog={allCards}
            muses={muses}
            grantCards={grantCards}
            credit={credit}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "duel" && <DuelTable {...cards} />}
        {activeGame === "mind" && (
          <MindTable
            rows={rows}
            catalog={allCards}
            grantCards={grantCards}
            credit={credit}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "speed" && (
          <SpeedTable
            rows={rows}
            balanceFen={state.balanceFen}
            spend={spend}
            credit={credit}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "crash" && <CrashTable {...house} />}
        {activeGame === "roulette" && <RouletteTable {...house} />}
        {activeGame === "mines" && <MinesTable {...house} />}
        {activeGame === "hilo" && <HiloTable {...house} catalog={allCards} valueFen={valueFen} />}
        {activeGame === "jackpot" && <JackpotTable {...cards} />}
        {activeGame === "coinflip" && <CoinflipTable {...cards} />}
        {activeGame === "upgrader" && <UpgraderTable {...cards} />}
        {activeGame === "war" && <WarTable {...cards} />}
        {activeGame === "monte" && (
          <MonteTable
            rows={rows}
            catalog={allCards}
            chaseCardIds={arcade.chaseCardIds}
            takeCards={takeCards}
            grantCards={grantCards}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "cabo" && (
          <CaboTable
            catalog={allCards}
            valueFen={valueFen}
            balanceFen={state.balanceFen}
            spend={spend}
            credit={credit}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "scopa" && (
          <ScopaTable
            catalog={allCards}
            valueFen={valueFen}
            balanceFen={state.balanceFen}
            spend={spend}
            credit={credit}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "loveletter" && (
          <LoveLetterTable
            muses={muses}
            balanceFen={state.balanceFen}
            spend={spend}
            credit={credit}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "koikoi" && (
          <KoiKoiTable
            rows={rows}
            catalog={allCards}
            valueFen={valueFen}
            takeCards={takeCards}
            grantCards={grantCards}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "packbattle" && (
          <PackBattleTable
            packs={catalog}
            allCards={allCards}
            valueFen={valueFen}
            balanceFen={state.balanceFen}
            spend={spend}
            grantCards={grantCards}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "sisterrip" && (
          <SisterRipTable
            catalog={allCards}
            grantCards={grantCards}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "lastpack" && (
          <LastPackTable
            packs={catalog}
            allCards={allCards}
            valueFen={valueFen}
            balanceFen={state.balanceFen}
            spend={spend}
            grantCards={grantCards}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "gachapon" && (
          <GachaponTable
            rows={rows}
            catalog={allCards}
            balanceFen={state.balanceFen}
            spend={spend}
            grantCards={grantCards}
            credit={credit}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "ufo" && (
          <UfoTable
            catalog={cheapCards}
            balanceFen={state.balanceFen}
            spend={spend}
            grantCards={grantCards}
            credit={credit}
            onPulse={onPulse}
            playUiTap={playUiTap}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
      </div>
    </div>
  );
}
