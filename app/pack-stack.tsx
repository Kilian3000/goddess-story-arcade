"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import { rarityTier } from "./gacha-engine";
import { swipeIntent } from "./pack-gestures";

type StackCard = { id: number; image: string; character: string; rarity: string; color: string };
type Props = {
  cards: StackCard[];
  activeIndex: number;
  locked: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onInspect: () => void;
  onPeek: () => void;
};

export function PackStack({ cards, activeIndex, locked, onNext, onPrevious, onInspect, onPeek }: Props) {
  const deck = useRef<HTMLDivElement>(null);
  const peekButton = useRef<HTMLButtonElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = useRef<{ x: number; y: number; time: number; width: number; peek: boolean; pointerId: number } | null>(null);
  const consumeClick = useRef(false);

  function clearHold() {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }
  function hidePeek() {
    deck.current?.classList.remove("is-peeking");
    peekButton.current?.setAttribute("aria-pressed", "false");
  }
  function showPeek() {
    deck.current?.style.setProperty("--peek-y", "27deg");
    deck.current?.style.setProperty("--peek-x", "5deg");
    deck.current?.classList.add("is-peeking");
    peekButton.current?.setAttribute("aria-pressed", "true");
    onPeek();
  }
  useEffect(() => {
    const element = deck.current;
    const button = peekButton.current;
    return () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
      gesture.current = null;
      element?.classList.remove("is-peeking");
      button?.setAttribute("aria-pressed", "false");
    };
  }, [activeIndex]);

  function down(event: PointerEvent<HTMLButtonElement>) {
    if (locked || !event.isPrimary || event.button !== 0) return;
    clearHold();
    consumeClick.current = false;
    gesture.current = { x: event.clientX, y: event.clientY, time: event.timeStamp, width: event.currentTarget.offsetWidth, peek: deck.current?.classList.contains("is-peeking") || false, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (gesture.current.peek) return;
    const target = event.currentTarget;
    holdTimer.current = setTimeout(() => {
      if (!gesture.current) return;
      gesture.current.peek = true;
      consumeClick.current = true;
      target.classList.remove("is-dragging");
      showPeek();
    }, 200);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 8) { clearHold(); consumeClick.current = true; }
    if (current.peek) {
      deck.current?.style.setProperty("--peek-y", `${Math.max(-38, Math.min(48, 27 + dx / current.width * 65))}deg`);
      deck.current?.style.setProperty("--peek-x", `${Math.max(-10, Math.min(10, 5 - dy / current.width * 15))}deg`);
      return;
    }
    if (Math.abs(dy) > Math.abs(dx) * 1.25) return;
    event.currentTarget.classList.add("is-dragging");
    event.currentTarget.style.setProperty("--drag-x", `${Math.max(-220, Math.min(220, dx))}px`);
    event.currentTarget.style.setProperty("--drag-rot", `${dx / 35}deg`);
    event.currentTarget.style.setProperty("--drag-tilt", `${Math.max(-24, Math.min(24, dx / current.width * 40))}deg`);
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = gesture.current;
    if (current && current.pointerId !== event.pointerId) return;
    clearHold();
    gesture.current = null;
    hidePeek();
    event.currentTarget.classList.remove("is-dragging");
    if (current) {
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      consumeClick.current ||= cancelled || current.peek || Math.max(Math.abs(dx), Math.abs(dy)) > 8;
      const intent = cancelled || current.peek ? 0 : swipeIntent(dx, dy, event.timeStamp - current.time, current.width);
      if (intent === 1) onNext();
      if (intent === -1) onPrevious();
    }
    for (const name of ["--drag-x", "--drag-rot", "--drag-tilt"]) event.currentTarget.style.removeProperty(name);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <>
    <div className="card-deck tactile-stack" ref={deck}>
      <div className="stack-turntable">
        {cards.map((card, index) => {
          const depth = index - activeIndex;
          if (depth < -1) return null;
          const current = depth === 0;
          return <button key={`${card.id}-${index}`} className={`card-plane ${current ? "is-current" : depth < 0 ? "is-before" : "is-after"} rarity-${card.rarity.toLowerCase()}`}
            style={{ "--depth": depth, "--edge-color": rarityTier(card.rarity) >= 2 ? card.color : "#e3dbe7", "--rarity-color": card.color } as CSSProperties}
            tabIndex={current ? 0 : -1} aria-hidden={!current} aria-label={current ? `${card.rarity} ${card.character}. Tap for details; hold to peek at the stack.` : undefined}
            onDragStart={event => event.preventDefault()}
            onContextMenu={event => event.preventDefault()}
            onPointerDown={current ? down : undefined} onPointerMove={current ? move : undefined}
            onPointerUp={current ? event => finish(event) : undefined} onPointerCancel={event => finish(event, true)}
            onLostPointerCapture={event => { if (gesture.current) finish(event, true); }}
            onClick={() => { if (!current) return; if (consumeClick.current) { consumeClick.current = false; return; } onInspect(); }}>
            <span className="card-body">
              {depth <= 0 ? <img src={card.image} draggable={false} alt={current ? `${card.rarity} ${card.character}` : ""} /> : <span className="stack-hidden-face" />}
              {current && rarityTier(card.rarity) >= 2 && <span className="card-holo" />}
              {current && rarityTier(card.rarity) >= 3 && <span className="card-spark"><i /><i /><i /></span>}
            </span>
            {depth >= 0 && <span className="card-stock-edge" aria-hidden="true" />}
          </button>;
        })}
      </div>
    </div>
    <button ref={peekButton} className="stack-peek-control" aria-pressed="false" disabled={locked}
      onClick={() => { clearHold(); if (deck.current?.classList.contains("is-peeking")) hidePeek(); else showPeek(); }}>
      <span aria-hidden="true">▱</span> PEEK
    </button>
    <p className="stack-gesture-tip">Hold to peek · Swipe to reveal</p>
  </>;
}
