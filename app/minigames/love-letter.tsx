"use client";

import { useMemo, useState } from "react";
import type { WaifuMuse } from "../lucky-shrine";
import { formatYuan } from "../economy";
import { secureRandom } from "../gacha-engine";
import { GameFrame } from "./game-frame";
import { GameResult } from "./game-result";
import { LOVE_RANKS, loveMustCountess } from "./odds";

const NAMES = ["Guard", "Priest", "Baron", "Handmaid", "Prince", "King", "Countess", "Princess"] as const;
const BLURB = [
  "Rate den Rang der Muse (2–8).",
  "Sieh den Rang der Muse.",
  "Höherer offener Rang gewinnt die Runde.",
  "Die Muse ist eine Runde immun.",
  "Muse wirft und zieht neu.",
  "Tauscht die offenen Ränge.",
  "Muss fallen, wenn Prince oder King in der Hand ist.",
  "Spielen verliert die Runde.",
];

type Props = {
  muses: WaifuMuse[];
  balanceFen: number;
  spend: (fen: number) => boolean;
  credit: (fen: number) => boolean;
  onPulse: () => void;
  playUiTap: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
  playLoss: () => Promise<void>;
};

function drawRank() {
  return LOVE_RANKS[Math.floor(secureRandom() * LOVE_RANKS.length)];
}

export function LoveLetterTable({ muses, balanceFen, spend, credit, onPulse, playUiTap, playWin, playLoss }: Props) {
  const muse = muses[0];
  const [you, setYou] = useState(0);
  const [bot, setBot] = useState(0);
  const [hand, setHand] = useState<number[]>([]);
  const [youScore, setYouScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [log, setLog] = useState("");
  const [phase, setPhase] = useState<"idle" | "play" | "guess" | "reveal" | "match">("idle");
  const [guessing, setGuessing] = useState(false);
  const stakeFen = 20;
  const winFen = 40;
  const labels = useMemo(() => NAMES, []);

  const start = () => {
    if (!spend(stakeFen)) return;
    void playUiTap();
    onPulse();
    setYouScore(0);
    setBotScore(0);
    dealRound();
  };

  const dealRound = () => {
    setYou(drawRank());
    setBot(drawRank());
    setHand([drawRank()]);
    setGuessing(false);
    setLog("Zwei Karten. Spiele eine.");
    setPhase("play");
  };

  const closeRound = (won: boolean, note: string, nextYou = you, nextBot = bot) => {
    const ys = youScore + (won ? 1 : 0);
    const bs = botScore + (won ? 0 : 1);
    setYou(nextYou);
    setBot(nextBot);
    setYouScore(ys);
    setBotScore(bs);
    setHand([]);
    setLog(note);
    if (ys >= 2 || bs >= 2) {
      setPhase("match");
      if (ys > bs) {
        credit(winFen);
        onPulse();
        void playWin(1);
      } else void playLoss();
      return;
    }
    setPhase("reveal");
  };

  const resolve = (rank: number, guess = 0) => {
    if (phase !== "play" && phase !== "guess") return;
    let nextYou = you;
    let nextBot = bot;
    if (loveMustCountess([you, ...hand]) && rank !== 7) {
      setLog("Countess muss fallen — Prince oder King sitzt in der Hand.");
      return;
    }
    if (rank === 8) {
      closeRound(false, "Princess gespielt. Die Muse gewinnt die Runde.", you, bot);
      return;
    }
    if (rank === 1) {
      if (!guess) {
        setGuessing(true);
        setPhase("guess");
        setLog("Guard: rate den Rang der Muse.");
        return;
      }
      if (nextBot !== 4 && guess === nextBot) {
        closeRound(true, `Guard trifft — Muse war ${labels[nextBot - 1]}.`);
        return;
      }
      closeRound(nextYou > nextBot, nextBot === 4 ? "Handmaid schützt die Muse." : `Guard daneben. Muse war ${labels[nextBot - 1]}. Ende nach Rang: du ${labels[nextYou - 1]} vs ${labels[nextBot - 1]}.`);
      return;
    }
    if (rank === 2) {
      closeRound(nextYou > nextBot, `Priest sieht ${labels[nextBot - 1]}. Höherer Rang gewinnt die Runde.`);
      return;
    }
    if (rank === 3) {
      if (nextBot === 4) {
        closeRound(false, "Handmaid blockt den Baron.");
        return;
      }
      if (nextYou === nextBot) {
        closeRound(false, "Baron-Gleichstand — Muse nimmt die Runde.");
        return;
      }
      closeRound(nextYou > nextBot, `Baron: du ${labels[nextYou - 1]} (${nextYou}) vs ${labels[nextBot - 1]} (${nextBot}).`);
      return;
    }
    if (rank === 5 && nextBot !== 4) nextBot = drawRank();
    if (rank === 6 && nextBot !== 4) {
      const swap = nextYou;
      nextYou = nextBot;
      nextBot = swap;
    }
    if (rank === you) nextYou = hand[0] || drawRank();
    closeRound(nextYou > nextBot, `${labels[rank - 1]}. Ende: du ${labels[nextYou - 1]} vs ${labels[nextBot - 1]}.`, nextYou, nextBot);
  };

  const cards = [you, ...hand].filter(Boolean);
  const matchOver = phase === "match";
  const youWon = youScore > botScore;

  return (
    <GameFrame eyebrow="CARDS · LOVE LETTER" title={<>LOVE <i>LETTER</i></>}>
      <details className="game-rules"><summary>Spielregeln</summary><p>Best of 3 gegen die Muse. Einsatz {formatYuan(stakeFen)} ¥, Match-Sieg {formatYuan(winFen)} ¥. Guard rät einen Rang. Baron vergleicht. Princess spielen verliert die Runde. Kein Pack.</p></details>
      {muse && <p className="game-hint">{muse.character} ist die Muse · Stand {youScore}:{botScore}</p>}
      <div className="game-cards cols-2">
        <article>
          <small>DU</small>
          <b>{you ? `${you} · ${labels[you - 1]}` : "—"}</b>
        </article>
        <article>
          <small>MUSE</small>
          <b>{phase === "reveal" || matchOver ? `${bot} · ${labels[bot - 1]}` : "verdeckt"}</b>
        </article>
      </div>
      {phase === "play" && (
        <div className="game-cards cols-2">
          {cards.map((rank, index) => (
            <button key={`${rank}-${index}`} type="button" onClick={() => resolve(rank)}>
              <b>{labels[rank - 1]}</b>
              <small>{BLURB[rank - 1]}</small>
            </button>
          ))}
        </div>
      )}
      {guessing && phase === "guess" && (
        <div className="minigame-actions">
          {NAMES.slice(1).map((name, index) => (
            <button key={name} type="button" className="minigame-go" onClick={() => resolve(1, index + 2)}>{name}</button>
          ))}
        </div>
      )}
      {log && <p className="game-hint">{log}</p>}
      {phase === "reveal" && (
        <GameResult tone="info" title={`Runde ${youScore}:${botScore}`} detail={`${log} Nächste Runde, wenn du bereit bist.`} />
      )}
      {matchOver && (
        <GameResult
          tone={youWon ? "win" : "loss"}
          title={youWon ? `Match ${youScore}:${botScore} · +${formatYuan(winFen)} ¥` : `Muse ${botScore}:${youScore} — Einsatz weg`}
          detail={youWon ? "Best of 3 gewonnen. Kein Pack, nur Yuan." : "Best of 3 verloren."}
        />
      )}
      <div className="minigame-actions">
        {phase === "idle" && <button type="button" className="minigame-go" disabled={balanceFen < stakeFen} onClick={start}>BRIEF {formatYuan(stakeFen)} ¥</button>}
        {phase === "reveal" && <button type="button" className="minigame-go" onClick={dealRound}>NÄCHSTE RUNDE</button>}
        {matchOver && <button type="button" className="minigame-go" onClick={() => { setPhase("idle"); setLog(""); setYou(0); setBot(0); }}>AGAIN</button>}
      </div>
    </GameFrame>
  );
}
