"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { secureRandom, type PackConfig } from "./gacha-engine";

type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
type Suit = "hearts" | "diamonds" | "clubs" | "spades";
type GameStatus = "ready" | "player" | "dealer" | "win" | "loss" | "push" | "prize";

export type WaifuMuse = {
  image: string;
  character: string;
  rarity: string;
  setName: string;
  attitude?: "timid" | "confident" | "dominant";
  duelTier?: 1 | 2 | 5 | 10;
};

type BlackjackCard = {
  id: string;
  rank: Rank;
  suit: Suit;
  muse: WaifuMuse | null;
};

type HandScore = {
  total: number;
  soft: boolean;
};

type LuckyShrineProps = {
  catalog: PackConfig[];
  ready: boolean;
  muses: WaifuMuse[];
  onClaim: (pack: PackConfig) => void;
  playDrop: (lane?: number) => Promise<void>;
  playBounce: (index: number) => Promise<void>;
  playWin: (cost: number) => Promise<void>;
};

const PRIZE_KEY = "hj:gacha:waifu21-prize:v1";
const LEGACY_PRIZE_KEY = "hj:gacha:lucky-shrine-prize:v1";
const LEGACY_EMBER_KEY = "hj:gacha:lucky-shrine-embers:v1";
const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const suitSymbols: Record<Suit, string> = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const rewardSteps = [
  { score: "≤18", cost: 1, label: "1 Yuan" },
  { score: "19", cost: 2, label: "2 Yuan" },
  { score: "20", cost: 5, label: "5 Yuan" },
  { score: "21", cost: 10, label: "10 Yuan" },
] as const;

function shuffle<T>(items: readonly T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(secureRandom() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function buildDeck(muses: WaifuMuse[]) {
  const portraits = shuffle(muses.filter((muse) => Boolean(muse.image)));
  return shuffle(suits.flatMap((suit, suitIndex) => ranks.map((rank, rankIndex): BlackjackCard => {
    const portraitIndex = suitIndex * ranks.length + rankIndex;
    return {
      id: `${suit}-${rank}`,
      rank,
      suit,
      muse: portraits.length ? portraits[portraitIndex % portraits.length] : null,
    };
  })));
}

export function scoreHand(hand: readonly BlackjackCard[]): HandScore {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (card.rank === "J" || card.rank === "Q" || card.rank === "K") {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }

  let softenedAces = 0;
  while (total > 21 && softenedAces < aces) {
    total -= 10;
    softenedAces += 1;
  }
  return { total, soft: aces > softenedAces };
}

function rewardCost(score: number) {
  if (score >= 21) return 10;
  if (score === 20) return 5;
  if (score === 19) return 2;
  return 1;
}

function pickReward(catalog: PackConfig[], requestedCost: number) {
  const costs = [10, 5, 2, 1].filter((cost) => cost <= requestedCost);
  for (const cost of costs) {
    const pool = catalog.filter((pack) => pack.cost === cost);
    if (pool.length) return pool[Math.floor(secureRandom() * pool.length)];
  }
  return catalog[0] || null;
}

function delay(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

function BlackjackCardView({ card, hidden = false, delayIndex = 0 }: {
  card: BlackjackCard;
  hidden?: boolean;
  delayIndex?: number;
}) {
  if (hidden) {
    return (
      <span
        className="blackjack-card blackjack-card-hidden"
        style={{ "--deal-delay": `${delayIndex * 45}ms` } as CSSProperties}
        aria-label="Verdeckte Karte des Dealers"
      >
        <span className="blackjack-card-back-mark"><i>21</i><b>GODDESS STORY</b></span>
      </span>
    );
  }

  const red = card.suit === "hearts" || card.suit === "diamonds";
  const label = `${card.rank} ${suitSymbols[card.suit]}${card.muse ? `, ${card.muse.character}` : ""}`;
  return (
    <span
      className={`blackjack-card ${red ? "blackjack-card-red" : "blackjack-card-black"}`}
      style={{ "--deal-delay": `${delayIndex * 45}ms` } as CSSProperties}
      aria-label={label}
    >
      {card.muse ? <img src={card.muse.image} alt="" draggable={false} /> : <span className="blackjack-card-fallback">GODDESS</span>}
      <span className="blackjack-card-corner blackjack-card-corner-top"><b>{card.rank}</b><i>{suitSymbols[card.suit]}</i></span>
      <span className="blackjack-card-corner blackjack-card-corner-bottom"><b>{card.rank}</b><i>{suitSymbols[card.suit]}</i></span>
      {card.muse && <span className="blackjack-card-caption"><b>{card.muse.character}</b><small>{card.muse.setName} · {card.muse.rarity}</small></span>}
    </span>
  );
}

export function Waifu21({ catalog, ready, muses, onClaim, playDrop, playBounce, playWin }: LuckyShrineProps) {
  const [status, setStatus] = useState<GameStatus>("ready");
  const [deck, setDeck] = useState<BlackjackCard[]>([]);
  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [prize, setPrize] = useState<PackConfig | null>(null);
  const [dealerMuse, setDealerMuse] = useState<WaifuMuse | null>(muses[0] || null);
  const actionToken = useRef(0);
  const prizeTimer = useRef<number | null>(null);

  const playerScore = useMemo(() => scoreHand(playerHand), [playerHand]);
  const dealerScore = useMemo(() => scoreHand(dealerHand), [dealerHand]);
  const dealerVisible = status !== "player";

  useEffect(() => {
    window.localStorage.removeItem(LEGACY_PRIZE_KEY);
    window.localStorage.removeItem(LEGACY_EMBER_KEY);
    if (!catalog.length) return;
    const savedId = Number(window.localStorage.getItem(PRIZE_KEY) || 0);
    const savedPrize = savedId ? catalog.find((pack) => pack.id === savedId) : null;
    if (savedPrize) {
      const restorePrize = window.setTimeout(() => {
        setPrize(savedPrize);
        setStatus("prize");
      }, 0);
      return () => window.clearTimeout(restorePrize);
    } else if (savedId) {
      window.localStorage.removeItem(PRIZE_KEY);
    }
  }, [catalog]);

  useEffect(() => () => {
    actionToken.current += 1;
    if (prizeTimer.current !== null) window.clearTimeout(prizeTimer.current);
  }, []);

  const finishWin = useCallback((score: number) => {
    const cost = rewardCost(score);
    const wonPack = pickReward(catalog, cost);
    if (!wonPack) {
      setStatus("loss");
      return;
    }

    void playWin(wonPack.cost);
    setPrize(wonPack);
    setStatus("win");
    window.localStorage.setItem(PRIZE_KEY, String(wonPack.id));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prizeTimer.current !== null) window.clearTimeout(prizeTimer.current);
    prizeTimer.current = window.setTimeout(() => {
      setStatus("prize");
      prizeTimer.current = null;
    }, reduced ? 40 : 480);
  }, [catalog, playWin]);

  const deal = useCallback(() => {
    if (!ready || status === "dealer" || status === "win" || status === "prize") return;
    actionToken.current += 1;
    if (prizeTimer.current !== null) window.clearTimeout(prizeTimer.current);
    setPrize(null);
    const nextDeck = buildDeck(muses);
    const player = [nextDeck[0], nextDeck[2]].filter(Boolean);
    const dealer = [nextDeck[1], nextDeck[3]].filter(Boolean);
    void playDrop(0);
    setDeck(nextDeck.slice(4));
    setPlayerHand(player);
    setDealerHand(dealer);
    setDealerMuse(shuffle(muses.filter((muse) => Boolean(muse.image)))[0] || null);
    setStatus("player");
  }, [muses, playDrop, ready, status]);

  const hit = useCallback(() => {
    if (status !== "player" || playerScore.total >= 21 || !deck.length) return;
    const [card, ...remaining] = deck;
    const nextHand = [...playerHand, card];
    void playBounce(nextHand.length);
    setDeck(remaining);
    setPlayerHand(nextHand);
    if (scoreHand(nextHand).total > 21) setStatus("loss");
  }, [deck, playBounce, playerHand, playerScore.total, status]);

  const hold = useCallback(async () => {
    if (status !== "player") return;
    const token = ++actionToken.current;
    void playBounce(1);
    setStatus("dealer");
    let dealer = [...dealerHand];
    let remaining = [...deck];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    await delay(reduced ? 30 : 300);
    while (scoreHand(dealer).total < 17 && remaining.length) {
      if (actionToken.current !== token) return;
      const [card, ...nextDeck] = remaining;
      dealer = [...dealer, card];
      remaining = nextDeck;
      void playBounce(dealer.length);
      setDealerHand(dealer);
      setDeck(remaining);
      await delay(reduced ? 35 : 330);
    }
    if (actionToken.current !== token) return;

    const playerTotal = scoreHand(playerHand).total;
    const dealerTotal = scoreHand(dealer).total;
    if (dealerTotal > 21 || playerTotal > dealerTotal) finishWin(playerTotal);
    else if (playerTotal === dealerTotal) setStatus("push");
    else setStatus("loss");
  }, [dealerHand, deck, finishWin, playBounce, playerHand, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
      if (status === "player" && event.key.toLowerCase() === "h") hit();
      if (status === "player" && event.key.toLowerCase() === "s") void hold();
      if ((status === "ready" || status === "loss" || status === "push") && event.key === "Enter") deal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deal, hit, hold, status]);

  const statusCopy = status === "player"
    ? playerScore.total === 21 ? "Twenty-one. Hold to challenge the dealer." : "Your move: take a card or hold."
    : status === "dealer" ? "Dealer reveals and draws to 17."
      : status === "win" ? "You beat the dealer. Your booster is being dealt."
        : status === "loss" ? playerScore.total > 21 ? "Bust. You went over 21." : "The dealer takes this hand."
          : status === "push" ? "Push. Same score — deal again."
            : status === "prize" ? `${prize?.setName || "Your booster"} is yours to open.`
              : "Beat the dealer without going over 21.";

  return (
    <section className={`waifu21 blackjack-game waifu21-${status}`} aria-label="Waifu 21 blackjack booster game">
      <header className="waifu21-intro">
        <span className="waifu21-eyebrow">FREE PLAY · NO BETTING · STANDARD BLACKJACK</span>
        <h1>WAIFU <i>21</i></h1>
        <p>Get closer to 21 than the dealer. Aces count as 1 or 11; J, Q and K count as 10. The dealer draws until 17.</p>
        <div className="waifu21-rewards" aria-label="Booster rewards by winning score">
          {rewardSteps.map((step) => <span key={step.score} className={status === "prize" && prize?.cost === step.cost ? "is-won" : ""}><b>{step.score}</b><i>→</i><em>{step.label}</em></span>)}
        </div>
      </header>

      <div className="waifu21-table">
        <div className="waifu21-dealer-panel">
          <div className="waifu21-dealer-portrait">
            {dealerMuse ? <img src={dealerMuse.image} alt="" /> : <span>HOUSE<br />DEALER</span>}
            <div><small>HOUSE DEALER</small><b>{dealerMuse?.character || "The Goddess"}</b><em>{dealerMuse ? `${dealerMuse.setName} · ${dealerMuse.rarity}` : "Goddess Story"}</em></div>
          </div>
          <div className="waifu21-score waifu21-dealer-score"><span>DEALER</span><b>{dealerVisible && dealerHand.length ? dealerScore.total : "?"}</b><small>{dealerVisible && dealerScore.soft ? "soft" : ""}</small></div>
        </div>

        <div className="waifu21-hand waifu21-dealer-hand" aria-label="Karten des Dealers">
          {dealerHand.map((card, index) => <BlackjackCardView key={card.id} card={card} hidden={!dealerVisible && index === 1} delayIndex={status === "player" && dealerHand.length <= 2 ? index : 0} />)}
        </div>

        <div className="waifu21-divider"><span>{statusCopy}</span></div>

        <div className="waifu21-hand waifu21-player-hand" aria-label="Deine Karten">
          {playerHand.map((card, index) => <BlackjackCardView key={card.id} card={card} delayIndex={playerHand.length <= 2 ? index : 0} />)}
          {!playerHand.length && <div className="waifu21-empty-hand"><b>Ready for a hand?</b><span>One win awards one real virtual booster.</span></div>}
        </div>

        <div className="waifu21-player-panel">
          <div className="waifu21-score waifu21-player-score"><span>YOUR HAND</span><b>{playerHand.length ? playerScore.total : "—"}</b><small>{playerScore.soft ? "soft" : ""}</small></div>
          <div className="waifu21-actions">
            {(status === "ready" || status === "loss" || status === "push") && <button className="waifu21-action waifu21-deal" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); deal(); } }} onClick={(event) => { if (event.detail === 0) deal(); }} disabled={!ready}><span>{status === "ready" ? "DEAL HAND" : "DEAL AGAIN"}</span><i>↻</i></button>}
            {status === "player" && <>
              <button className="waifu21-action waifu21-hit" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); hit(); } }} onClick={(event) => { if (event.detail === 0) hit(); }} disabled={playerScore.total >= 21 || !deck.length}><span>HIT</span><small>H</small></button>
              <button className="waifu21-action waifu21-hold" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); void hold(); } }} onClick={(event) => { if (event.detail === 0) void hold(); }}><span>HOLD</span><small>S</small></button>
            </>}
            {status === "dealer" && <div className="waifu21-thinking"><i /><span>DEALER DRAWING…</span></div>}
            {status === "win" && <div className="waifu21-winning"><i>✦</i><span>HAND WON</span></div>}
            {status === "prize" && prize && <button className="waifu21-action waifu21-claim" onClick={() => { window.localStorage.removeItem(PRIZE_KEY); onClaim(prize); }}><span>OPEN {prize.setName}</span><i>↗</i></button>}
          </div>
        </div>
      </div>

      <div className="waifu21-help"><span><b>H</b> Hit</span><span><b>S</b> Hold</span><span><b>Enter</b> Deal</span><em>Card artwork is decorative; the large corner rank determines its blackjack value.</em></div>
      <div className="waifu21-live" aria-live="polite">{statusCopy}</div>
    </section>
  );
}

export const LuckyShrine = Waifu21;
