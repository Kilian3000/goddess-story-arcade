"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import { rarityTier } from "./gacha-engine";
import { swipeIntent, cardDragTransform, gestureMode, peekAmount, type GestureMode } from "./pack-gestures";

type StackCard = { id: number; image: string; character: string; rarity: string; color: string };
type Props = {
  cards: StackCard[];
  activeIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onInspect: () => void;
  onPeek: () => void;
};
type Gesture = {
  x: number; y: number; time: number; lastX: number; lastTime: number; velocity: number;
  width: number; height: number; pointerId: number; mode: GestureMode; sounded: boolean; offset: number;
};

export function PackStack({ cards, activeIndex, onNext, onPrevious, onInspect, onPeek }: Props) {
  const deck = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const peekButton = useRef<HTMLButtonElement>(null);
  const elements = useRef(new Map<number, HTMLSpanElement>());
  const animations = useRef(new Map<number, Animation>());
  const previousIndex = useRef(activeIndex);
  const gesture = useRef<Gesture | null>(null);
  const consumeClick = useRef(false);
  const pinnedPeek = useRef(false);
  const tier = rarityTier(cards[activeIndex].rarity);

  function setPeek(amount: number, lean = 0) {
    scene.current?.style.setProperty("--peek", String(amount));
    scene.current?.style.setProperty("--peek-lean", `${lean}deg`);
    deck.current?.toggleAttribute("data-peeking", amount > .02);
    peekButton.current?.setAttribute("aria-pressed", String(amount > .02));
  }

  function animateCard(index: number, frames: Keyframe[], options: KeyframeAnimationOptions) {
    const element = elements.current.get(index);
    if (!element) return;
    animations.current.get(index)?.cancel();
    const animation = element.animate(frames, options);
    animations.current.set(index, animation);
    animation.onfinish = () => {
      if (animations.current.get(index) === animation) animations.current.delete(index);
    };
  }

  useLayoutEffect(() => {
    const previous = previousIndex.current;
    previousIndex.current = activeIndex;
    gesture.current = null;
    pinnedPeek.current = false;
    setPeek(0);
    deck.current?.removeAttribute("data-look-back");
    deck.current?.removeAttribute("data-touching");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const incoming = elements.current.get(activeIndex);
    if (incoming) incoming.style.transform = "";
    // The input pad never moves. These animations can be interrupted immediately.
    animateCard(activeIndex, reduced ? [] : [
      { transform: "translate3d(0,10px,0) scale(.955)", filter: "brightness(1.13)" },
      { transform: "translate3d(0,-3px,0) scale(1.014)", filter: "brightness(1.04)", offset: .62 },
      { transform: "none", filter: "brightness(1)" },
    ], { duration: reduced ? 0 : 360, easing: "cubic-bezier(.16,.75,.25,1)" });
    if (previous === activeIndex) return;
    consumeClick.current = true;
    const outgoing = elements.current.get(previous);
    if (!outgoing) return;
    const from = getComputedStyle(outgoing).transform;
    outgoing.style.transform = "";
    const sign = activeIndex > previous ? -1 : 1;
    const travel = Math.max(outgoing.offsetWidth * 1.4, window.innerWidth / 2 + outgoing.offsetWidth / 2 + 24);
    animateCard(previous, [
      { transform: from, opacity: 1, visibility: "visible", zIndex: 5 },
      { transform: `translate3d(${sign * travel * .65}px,-30px,0) rotate(${sign * 11}deg)`, opacity: 1, visibility: "visible", zIndex: 5, offset: .65 },
      { transform: `translate3d(${sign * travel}px,-48px,0) rotate(${sign * 17}deg)`, opacity: 0, visibility: "visible", zIndex: 5 },
    ], { duration: reduced ? 0 : 310, easing: "cubic-bezier(.2,.65,.3,1)" });
  }, [activeIndex]);

  useEffect(() => {
    const running = animations.current;
    return () => { running.forEach(animation => animation.cancel()); };
  }, []);

  function down(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const card = elements.current.get(activeIndex);
    const position = new DOMMatrixReadOnly(card ? getComputedStyle(card).transform : undefined);
    animations.current.get(activeIndex)?.cancel();
    if (card) card.style.transform = cardDragTransform(position.m41, 0, event.currentTarget.offsetWidth);
    consumeClick.current = false;
    gesture.current = {
      x: event.clientX, y: event.clientY, time: event.timeStamp, lastX: event.clientX,
      lastTime: event.timeStamp, velocity: 0, width: event.currentTarget.offsetWidth,
      height: event.currentTarget.offsetHeight, pointerId: event.pointerId, mode: "pending", sounded: false, offset: position.m41,
    };
    deck.current?.setAttribute("data-touching", "");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    current.velocity = (event.clientX - current.lastX) / Math.max(1, event.timeStamp - current.lastTime);
    current.lastX = event.clientX;
    current.lastTime = event.timeStamp;
    current.mode = gestureMode(dx, dy, current.mode);
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 8) consumeClick.current = true;
    const card = elements.current.get(activeIndex);
    if (current.mode === "peek") {
      const amount = peekAmount(dy, current.height);
      setPeek(amount, Math.max(-6, Math.min(6, dx / current.width * 12)));
      if (amount > .15 && !current.sounded) { current.sounded = true; onPeek(); }
    } else if (current.mode === "swipe") {
      pinnedPeek.current = false;
      setPeek(0);
      deck.current?.toggleAttribute("data-look-back", dx > 0 && activeIndex > 0);
      const resisted = dx > 0 && activeIndex === 0 ? dx * .22 : dx;
      if (card) card.style.transform = cardDragTransform(resisted + current.offset, dy, current.width);
    }
    scene.current?.style.setProperty("--shine-x", `${50 + Math.max(-40, Math.min(40, dx / current.width * 100))}%`);
  }

  function finish(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    deck.current?.removeAttribute("data-touching");
    if (cancelled) pinnedPeek.current = false;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    consumeClick.current ||= cancelled || current.mode !== "pending" || Math.max(Math.abs(dx), Math.abs(dy)) > 8;
    const releaseVelocity = event.timeStamp - current.lastTime < 80 ? current.velocity : 0;
    // Once an upward tilt owns the gesture, sideways motion cannot turn it into a reveal.
    const intent = cancelled || current.mode !== "swipe" ? 0 : swipeIntent(dx, dy, event.timeStamp - current.time, current.width, releaseVelocity);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (intent === 1 || (intent === -1 && activeIndex > 0)) {
      if (intent === 1) onNext();
      else onPrevious();
    } else {
      const card = elements.current.get(activeIndex);
      const from = card?.style.transform || "none";
      if (card) card.style.transform = "";
      setPeek(pinnedPeek.current && !cancelled ? .85 : 0);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      animateCard(activeIndex, [
        { transform: from },
        { transform: `translate3d(${dx < 0 ? 3 : -3}px,0,0)`, offset: .7 },
        { transform: "none" },
      ], { duration: reduced ? 0 : 270, easing: "cubic-bezier(.2,.85,.25,1)" });
      deck.current?.removeAttribute("data-look-back");
    }
  }

  const active = cards[activeIndex];
  return <>
    <div className="card-deck tactile-stack" ref={deck} data-tier={tier} style={{ "--rarity-color": active.color } as CSSProperties}>
      <div key={activeIndex} className="pack-reveal-light" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <div className="pack-scene" ref={scene} aria-hidden="true">
        {activeIndex < cards.length - 1 && <span className="pack-stock" />}
        <div className="pack-peek-edges">
          {cards.slice(activeIndex + 1).map((card, i) => <i key={i} style={{
            "--edge": i + 1, zIndex: cards.length - i,
            "--edge-color": rarityTier(card.rarity) >= 1 ? card.color : "#e1d9e5",
          } as CSSProperties} />)}
        </div>
        {cards.map((card, index) => {
          const current = index === activeIndex;
          const position = current ? "is-front" : index === activeIndex + 1 ? "is-next" : index === activeIndex - 1 ? "is-previous" : "is-away";
          return <span key={`${card.id}-${index}`} ref={element => { if (element) elements.current.set(index, element); else elements.current.delete(index); }}
            className={`pack-card ${position}`} style={{ "--rarity-color": card.color } as CSSProperties}>
            <img src={card.image} draggable={false} alt="" />
            <span className="pack-face-shine" />
            {current && rarityTier(card.rarity) >= 2 && <span className="card-holo" />}
            {current && <span key={activeIndex} className="pack-reveal-sheen" />}
          </span>;
        })}
      </div>
      <button className="pack-touch-pad" aria-label={`${active.rarity} ${active.character}. Swipe left to reveal, drag up to peek, or tap for details.`}
        onDragStart={event => event.preventDefault()} onContextMenu={event => event.preventDefault()}
        onPointerDown={down} onPointerMove={move} onPointerUp={event => finish(event)}
        onPointerCancel={event => finish(event, true)}
        onLostPointerCapture={event => { if (gesture.current) finish(event, true); }}
        onClick={event => {
          if (event.detail !== 0 && consumeClick.current) { consumeClick.current = false; return; }
          onInspect();
        }} />
    </div>
    <div className="stack-gesture-controls">
      <button ref={peekButton} className="stack-peek-control" aria-pressed="false"
        onClick={() => {
          pinnedPeek.current = !pinnedPeek.current;
          setPeek(pinnedPeek.current ? .85 : 0);
          if (pinnedPeek.current) onPeek();
        }}>▱ <span>PEEK</span></button>
      <p>Drag up to peek<br /><span>Swipe left to reveal</span></p>
    </div>
  </>;
}
