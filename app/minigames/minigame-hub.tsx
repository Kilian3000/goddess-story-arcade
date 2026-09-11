"use client";

import { useMemo } from "react";
import type { Card } from "../card-types";
import type { PackConfig } from "../gacha-engine";
import type { WaifuMuse } from "../lucky-shrine";
import { LuckyShrine } from "../lucky-shrine";
import { TemptationDuel } from "../temptation-duel";
import { useEconomy } from "../use-economy";
import { CoinflipTable } from "./coinflip";
import { CrashTable } from "./crash";
import { JackpotTable } from "./jackpot";
import { MinesTable } from "./mines";
import { MINIGAME_GROUPS, minigameById, type MinigameId } from "./registry";
import { RouletteTable } from "./roulette";
import { UpgraderTable } from "./upgrader";
import type { StakeCard } from "./card-stake-picker";

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
  const { state, valueFen, spend, credit, takeCards, grantCards } = useEconomy();
  const byId = useMemo(() => new Map(allCards.map((card) => [card.id, card])), [allCards]);
  const rows = useMemo<StakeCard[]>(() => (
    Object.entries(state.cards).flatMap(([id, count]) => {
      const card = byId.get(Number(id));
      if (!card) return [];
      return [{ card, count, valueFen: valueFen(card.id, card.rarity) }];
    }).sort((left, right) => right.valueFen - left.valueFen || left.card.set_name.localeCompare(right.card.set_name))
  ), [byId, state.cards, valueFen]);

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

  return (
    <div className="minigame-hub">
      <nav className="minigame-rail" aria-label="Minispiele">
        {MINIGAME_GROUPS.map((group) => (
          <div key={group.id} className={`minigame-rail-group kind-${group.id}`}>
            <small>{group.label}</small>
            {group.games.map((id) => {
              const game = minigameById(id);
              if (!game) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className={activeGame === id ? "is-active" : ""}
                  onClick={() => { void playUiTap(); onSelectGame(id); }}
                >
                  <b>{game.title}</b>
                  <span>{game.blurb}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="minigame-stage" role="region" aria-label={minigameById(activeGame)?.title || "Minigame"}>
        {activeGame === "waifu21" && (
          <LuckyShrine
            catalog={catalog}
            ready={ready}
            muses={muses}
            onClaim={(pack) => onClaim(pack, "waifu21")}
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
            startMusic={startMusic}
            playLock={playLock}
            playUiTap={playUiTap}
            playStart={playStart}
            playWin={playWin}
            playLoss={playLoss}
          />
        )}
        {activeGame === "crash" && <CrashTable {...house} />}
        {activeGame === "roulette" && <RouletteTable {...house} />}
        {activeGame === "mines" && <MinesTable {...house} />}
        {activeGame === "jackpot" && <JackpotTable {...cards} />}
        {activeGame === "coinflip" && <CoinflipTable {...cards} />}
        {activeGame === "upgrader" && <UpgraderTable {...cards} />}
      </div>
    </div>
  );
}
