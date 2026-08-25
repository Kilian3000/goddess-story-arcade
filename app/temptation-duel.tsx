"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { secureRandom, type PackConfig } from "./gacha-engine";
import { heartlockPool } from "./heartlock-roster";
import type { WaifuMuse } from "./lucky-shrine";

type DuelStatus = "lobby" | "duel" | "feedback" | "win" | "loss";
type LockQuality = "perfect" | "hit" | "miss";

type DuelConfig = {
  cost: number;
  label: string;
  title: string;
  rounds: number;
  required: number;
  sweepMs: number;
  width: number;
  drift: number;
};

type TemptationDuelProps = {
  catalog: PackConfig[];
  ready: boolean;
  muses: WaifuMuse[];
  onClaim: (pack: PackConfig) => void;
  startMusic: () => Promise<void>;
  playLock: (quality: LockQuality, streak: number) => Promise<void>;
  playUiTap: () => Promise<void>;
  playStart: () => Promise<void>;
  playLoss: () => Promise<void>;
  playWin: (cost: number) => Promise<void>;
};

const LOCK_KEY = "hj:gacha:temptation-recovery:v1";
const PRIZE_KEY = "hj:gacha:temptation-prize:v1";
const configs: Record<number, DuelConfig> = {
  1: { cost: 1, label: "1 YUAN", title: "SHY FLUTTER", rounds: 3, required: 2, sweepMs: 1900, width: 38, drift: 0 },
  2: { cost: 2, label: "2 YUAN", title: "TEASING GLANCE", rounds: 4, required: 3, sweepMs: 1550, width: 29, drift: 2 },
  5: { cost: 5, label: "5 YUAN", title: "FEVER PITCH", rounds: 5, required: 4, sweepMs: 1250, width: 23, drift: 5 },
  10: { cost: 10, label: "10 YUAN", title: "QUEEN'S ORDER", rounds: 6, required: 5, sweepMs: 980, width: 17, drift: 8 },
  20: { cost: 20, label: "SUPREME", title: "NO MERCY", rounds: 7, required: 6, sweepMs: 790, width: 13, drift: 11 },
};
const costOrder = [1, 2, 5, 10, 20];

const hostessArt: Record<string, string> = {
  "Yor Forger": "/heartlock/cutouts/yor-forger.webp",
  "Tifa Lockhart": "/heartlock/cutouts/tifa-lockhart.webp",
  Shenhe: "/heartlock/cutouts/shenhe.webp",
  Nami: "/heartlock/cutouts/nami.webp",
  "Chun-Li": "/heartlock/cutouts/chun-li.webp",
  Yelan: "/heartlock/cutouts/yelan.webp",
  "Jolyne Kujo": "/heartlock/cutouts/jolyne-kujo.webp",
  Bayonetta: "/heartlock/cutouts/bayonetta.webp",
  "Yae Miko": "/heartlock/cutouts/yae-miko.webp",
  Makima: "/heartlock/cutouts/makima.webp",
  "Boa Hancock": "/heartlock/cutouts/boa-hancock.webp",
  "Raiden Shogun": "/heartlock/cutouts/raiden-shogun.webp",
};

const attitudeCopy = {
  timid: ["D-don't stare. Just catch the beat.", "I might let you win… if your timing is gentle.", "My heart is slow. You can do this.", "One little lock, then the booster is yours."],
  confident: ["Keep your eyes on me, not the flashing lights.", "One clean lock. Show me you can focus.", "The window moves. I don't.", "Win it clean and I'll hand over your prize."],
  dominant: ["Miss the window and you answer to me.", "You chose this table. Now keep up.", "I decide when that heart opens.", "Six clean locks—or leave my table empty-handed."],
} as const;

function lowerCost(cost: number) {
  const index = costOrder.indexOf(cost);
  return index > 0 ? costOrder[index - 1] : 1;
}

function choose<T>(items: readonly T[]) {
  return items[Math.floor(secureRandom() * items.length)];
}

function pickOpponent(muses: WaifuMuse[], cost: number) {
  const pool = heartlockPool(muses, cost);
  return pool.length ? choose(pool) : null;
}

function randomZone(width: number) {
  const edge = width / 2 + 5;
  return edge + secureRandom() * (100 - edge * 2);
}

export function TemptationDuel({ catalog, ready, muses, onClaim, startMusic, playLock, playUiTap, playStart, playLoss, playWin }: TemptationDuelProps) {
  const [status, setStatus] = useState<DuelStatus>("lobby");
  const [selectedCost, setSelectedCost] = useState(1);
  const [selectedPackId, setSelectedPackId] = useState(0);
  const [recoveryCost, setRecoveryCost] = useState<number | null>(null);
  const [opponent, setOpponent] = useState<WaifuMuse | null>(() => pickOpponent(muses, 1));
  const [round, setRound] = useState(1);
  const [hits, setHits] = useState(0);
  const [streak, setStreak] = useState(0);
  const [zoneBase, setZoneBase] = useState(50);
  const [feedback, setFeedback] = useState<LockQuality | null>(null);
  const [prize, setPrize] = useState<PackConfig | null>(null);
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  const targetRef = useRef<HTMLSpanElement | null>(null);
  const cursorValue = useRef(0);
  const targetValue = useRef(50);
  const frame = useRef<number | null>(null);
  const roundTimer = useRef<number | null>(null);

  const activeCost = recoveryCost || selectedCost;
  const config = configs[activeCost] || configs[1];
  const packsAtCost = useMemo(() => catalog.filter((pack) => pack.cost === activeCost), [activeCost, catalog]);
  const selectedPack = packsAtCost.find((pack) => pack.id === selectedPackId) || packsAtCost[0] || null;
  const attitude = activeCost <= 1 ? "timid" : activeCost <= 2 ? "confident" : "dominant";
  const line = attitudeCopy[attitude][round % attitudeCopy[attitude].length];
  const opponentCutout = opponent ? hostessArt[opponent.character] : null;

  useEffect(() => {
    const savedRecovery = Number(window.localStorage.getItem(LOCK_KEY) || 0);
    const savedPrizeId = Number(window.localStorage.getItem(PRIZE_KEY) || 0);
    const savedPrize = savedPrizeId ? catalog.find((pack) => pack.id === savedPrizeId) : null;
    const restore = window.setTimeout(() => {
      if (costOrder.includes(savedRecovery)) {
        setRecoveryCost(savedRecovery);
        setSelectedCost(savedRecovery);
        setOpponent(pickOpponent(muses, savedRecovery));
      }
      if (savedPrize) {
        setPrize(savedPrize);
        setSelectedCost(savedPrize.cost);
        setSelectedPackId(savedPrize.id);
        setStatus("win");
      } else if (savedPrizeId) {
        window.localStorage.removeItem(PRIZE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, [catalog, muses]);

  useEffect(() => () => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    if (roundTimer.current !== null) window.clearTimeout(roundTimer.current);
  }, []);

  useEffect(() => {
    if (status !== "duel") return;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      const phase = (elapsed % config.sweepMs) / config.sweepMs;
      const cursor = phase < .5 ? phase * 200 : 200 - phase * 200;
      const drift = config.drift ? Math.sin(elapsed / (config.sweepMs * .31)) * config.drift : 0;
      const edge = config.width / 2 + 2;
      const target = Math.max(edge, Math.min(100 - edge, zoneBase + drift));
      cursorValue.current = cursor;
      targetValue.current = target;
      if (cursorRef.current) cursorRef.current.style.left = `${cursor}%`;
      if (targetRef.current) targetRef.current.style.left = `${target}%`;
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [config, round, status, zoneBase]);

  const startDuel = useCallback(() => {
    if (!ready || !selectedPack || !muses.length) return;
    const nextOpponent = pickOpponent(muses, activeCost);
    if (!nextOpponent) return;
    void playStart();
    void startMusic();
    setOpponent(nextOpponent);
    setRound(1);
    setHits(0);
    setStreak(0);
    setFeedback(null);
    setPrize(null);
    setZoneBase(randomZone(config.width));
    setStatus("duel");
  }, [activeCost, config.width, muses, playStart, ready, selectedPack, startMusic]);

  const finish = useCallback((won: boolean, finalHits: number) => {
    if (won && selectedPack) {
      void playWin(selectedPack.cost);
      setPrize(selectedPack);
      setStatus("win");
      window.localStorage.setItem(PRIZE_KEY, String(selectedPack.id));
      if (recoveryCost) {
        setRecoveryCost(null);
        window.localStorage.removeItem(LOCK_KEY);
      }
      return;
    }
    void playLoss();
    setHits(finalHits);
    setStatus("loss");
    if (activeCost > 1) {
      const recovery = lowerCost(activeCost);
      setRecoveryCost(recovery);
      window.localStorage.setItem(LOCK_KEY, String(recovery));
    }
  }, [activeCost, playLoss, playWin, recoveryCost, selectedPack]);

  const lockPulse = useCallback(() => {
    if (status !== "duel") return;
    const distance = Math.abs(cursorValue.current - targetValue.current);
    const quality: LockQuality = distance <= config.width * .12 ? "perfect" : distance <= config.width / 2 ? "hit" : "miss";
    const landed = quality !== "miss";
    const nextHits = hits + (landed ? 1 : 0);
    const nextStreak = landed ? streak + 1 : 0;
    void playLock(quality, nextStreak);
    setHits(nextHits);
    setStreak(nextStreak);
    setFeedback(quality);
    setStatus("feedback");
    if (roundTimer.current !== null) window.clearTimeout(roundTimer.current);
    roundTimer.current = window.setTimeout(() => {
      roundTimer.current = null;
      if (round >= config.rounds) {
        finish(nextHits >= config.required, nextHits);
      } else {
        setRound((value) => value + 1);
        setZoneBase(randomZone(config.width));
        setFeedback(null);
        setStatus("duel");
      }
    }, 260);
  }, [config, finish, hits, playLock, round, status, streak]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
      if (status === "duel" && (event.code === "Space" || event.key === "Enter")) {
        event.preventDefault();
        lockPulse();
      }
      if (status === "lobby" && event.key === "Enter") startDuel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lockPulse, startDuel, status]);

  const chooseCost = (cost: number) => {
    if (recoveryCost && cost !== recoveryCost) return;
    void playUiTap();
    setSelectedCost(cost);
    const firstPack = catalog.find((pack) => pack.cost === cost);
    setSelectedPackId(firstPack?.id || 0);
    setOpponent(pickOpponent(muses, cost));
  };

  const resetAfterLoss = () => {
    void playUiTap();
    const cost = recoveryCost || activeCost;
    setSelectedCost(cost);
    setSelectedPackId(catalog.find((pack) => pack.cost === cost)?.id || 0);
    setOpponent(pickOpponent(muses, cost));
    setStatus("lobby");
  };

  return (
    <section className={`temptation-duel temptation-${status} temptation-cost-${activeCost}`} aria-label="Temptation Duel booster challenge">
      <aside className="temptation-opponent">
        {opponent && <div key={opponent.character} className="temptation-opponent-figure" aria-hidden="true">
          <span
            className="temptation-opponent-cutout"
            style={{ backgroundImage: `url("${opponentCutout || opponent.image}")` } as CSSProperties}
          />
        </div>}
        <div className="temptation-opponent-card">
          <small>{attitude === "timid" ? "SOFT-SPOKEN CHALLENGER" : attitude === "dominant" ? "DOMINANT CHALLENGER" : "CONFIDENT CHALLENGER"}</small>
          <h2>{opponent?.character || "Mystery Goddess"}</h2>
          <span>{opponent?.setName} · {opponent?.rarity}</span>
          <p>“{line}”</p>
        </div>
      </aside>

      <div className="temptation-console">
        <header className="temptation-head">
          <div><small>ARCADE CHALLENGE // 12 HOSTESSES</small><h1>HEART<i>LOCK</i></h1></div>
          <p>Stop the pulse inside her moving heart window. Win the set you chose. Miss the duel and the next table down becomes your recovery match.</p>
        </header>

        {status === "lobby" && <div className="temptation-lobby">
          {recoveryCost && <div className="temptation-recovery"><b>RECOVERY MATCH</b><span>Win a {recoveryCost} Yuan duel to reopen the higher tables.</span></div>}
          <div className="temptation-costs" aria-label="Difficulty and booster value">
            {costOrder.map((cost) => {
              const item = configs[cost];
              const disabled = Boolean(recoveryCost && recoveryCost !== cost) || !catalog.some((pack) => pack.cost === cost);
              return <button key={cost} className={activeCost === cost ? "is-active" : ""} disabled={disabled} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); chooseCost(cost); } }} onClick={(event) => { if (event.detail === 0) chooseCost(cost); }}><small>{item.label}</small><b>{item.title}</b><span>{item.required}/{item.rounds} locks</span></button>;
            })}
          </div>
          <div className="temptation-pack-choice">
            <label htmlFor="heartlock-pack">YOUR PRIZE BOOSTER</label>
            <select id="heartlock-pack" value={selectedPack?.id || ""} onChange={(event) => { void playUiTap(); setSelectedPackId(Number(event.target.value)); }}>
              {packsAtCost.map((pack) => <option key={pack.id} value={pack.id}>{pack.setName} · {pack.odds.cardsPerPack} cards</option>)}
            </select>
            <div><b>{selectedPack?.setName || "NO PACK"}</b><span>{config.label} · {config.rounds} rounds · need {config.required}</span></div>
          </div>
          <button className="temptation-start" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); startDuel(); } }} onClick={(event) => { if (event.detail === 0) startDuel(); }} disabled={!ready || !selectedPack || !opponent}><span>FACE {opponent?.character || "THE CHALLENGER"}</span><i>♥</i></button>
        </div>}

        {(status === "duel" || status === "feedback") && <div className="temptation-arena">
          <div className="temptation-scoreboard"><span>ROUND <b>{round}/{config.rounds}</b></span><span>LOCKS <b>{hits}/{config.required}</b></span><span>STREAK <b>{streak}</b></span></div>
          <div className="temptation-versus"><small>{config.label}</small><b>{config.title}</b><span>{selectedPack?.setName}</span></div>
          <div className={`temptation-track ${feedback ? `is-${feedback}` : ""}`} style={{ "--window-width": `${config.width}%` } as CSSProperties}>
            <span ref={targetRef} className="temptation-window"><i>♥</i></span>
            <span ref={cursorRef} className="temptation-cursor"><i /></span>
            <b className="temptation-track-label">LOCK INSIDE THE HEART WINDOW</b>
            {feedback && <strong>{feedback === "perfect" ? "PERFECT LOCK" : feedback === "hit" ? "LOCKED" : "REJECTED"}</strong>}
          </div>
          <button className="temptation-lock" onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); lockPulse(); } }} onClick={(event) => { if (event.detail === 0) lockPulse(); }} disabled={status !== "duel"}><span>LOCK HEART</span><small>SPACE / ENTER</small></button>
        </div>}

        {status === "win" && prize && <div className="temptation-result temptation-result-win">
          <small>HEART CAPTURED</small><h2>YOU WIN</h2><p>{opponent?.character} gives up the <b>{prize.setName}</b> booster.</p>
          <button onClick={() => { void playUiTap(); window.localStorage.removeItem(PRIZE_KEY); onClaim(prize); }}>RIP YOUR {prize.setName}<span>↗</span></button>
        </div>}

        {status === "loss" && <div className="temptation-result temptation-result-loss">
          <small>{activeCost === 1 ? "NO PENALTY" : "TABLE LOCKED"}</small><h2>HEARTBROKEN</h2><p>{activeCost === 1 ? "The 1 Yuan table stays open. Read her rhythm and try again." : `${opponent?.character} sends you down to the ${recoveryCost} Yuan recovery table.`}</p>
          <button onClick={resetAfterLoss}>{activeCost === 1 ? "TRY AGAIN" : `PLAY ${recoveryCost} YUAN RECOVERY`}<span>↺</span></button>
        </div>}
      </div>
      <div className="temptation-live" aria-live="polite">{status === "feedback" ? feedback : status}</div>
    </section>
  );
}
