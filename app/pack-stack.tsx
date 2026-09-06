"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import { rarityTier } from "./gacha-engine";
import { swipeIntent, cardDragTransform } from "./pack-gestures";

type StackCard = { id: number; image: string; character: string; rarity: string; color: string };
type Props = {
  cards: StackCard[];
  activeIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onInspect: () => void;
};
type Gesture = { x: number; y: number; time: number; lastX: number; lastTime: number; velocity: number; width: number; pointerId: number; element: HTMLButtonElement };

export function PackStack({ cards, activeIndex, onNext, onPrevious, onInspect }: Props) {
  const deck = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<number, HTMLButtonElement>());
  const animations = useRef(new Map<number, Animation>());
  const previousIndex = useRef(activeIndex);
  const gesture = useRef<Gesture | null>(null);
  const consumeClick = useRef(false);

  // Only the outgoing card animates; the face underneath is already loaded,
  // full-sized and exactly in its final position. Keep every card's DOM identity.
  useLayoutEffect(() => {
    const previous = previousIndex.current;
    previousIndex.current = activeIndex;
    if (previous === activeIndex) return;
    gesture.current = null;
    consumeClick.current = true;
    deck.current?.removeAttribute("data-look-back");
    animations.current.get(activeIndex)?.cancel();
    const incoming = elements.current.get(activeIndex);
    if (incoming) incoming.style.transform = "";
    const outgoing = elements.current.get(previous);
    if (!outgoing) return;
    const from = getComputedStyle(outgoing).transform;
    animations.current.get(previous)?.cancel();
    outgoing.style.transform = "";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sign = activeIndex > previous ? -1 : 1;
    const travel = Math.max(outgoing.offsetWidth * 1.4, window.innerWidth / 2 + outgoing.offsetWidth / 2 + 24);
    const animation = outgoing.animate([
      { transform: from, opacity: 1, visibility: "visible", zIndex: 4 },
      { transform: `translate3d(${sign * travel}px,-18px,0) rotate(${sign * 9}deg)`, opacity: 0, visibility: "visible", zIndex: 4 },
    ], { duration: 230, easing: "cubic-bezier(.18,.72,.25,1)" });
    animations.current.set(previous, animation);
    animation.onfinish = () => animations.current.delete(previous);
  }, [activeIndex]);

  useEffect(() => {
    const running = animations.current;
    return () => { running.forEach(animation => animation.cancel()); };
  }, []);

  function down(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const position = new DOMMatrixReadOnly(getComputedStyle(event.currentTarget).transform);
    animations.current.get(activeIndex)?.cancel();
    event.currentTarget.style.transform = cardDragTransform(position.m41, position.m42 / .12, event.currentTarget.offsetWidth);
    consumeClick.current = false;
    gesture.current = { x: event.clientX - position.m41, y: event.clientY - position.m42 / .12, time: event.timeStamp, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, width: event.currentTarget.offsetWidth, pointerId: event.pointerId, element: event.currentTarget };
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
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 8) consumeClick.current = true;
    // A small drag is a peek, without any timer or separate interaction mode.
    deck.current?.toggleAttribute("data-look-back", dx > 0 && activeIndex > 0);
    const resisted = dx > 0 && activeIndex === 0 ? dx * .22 : dx;
    current.element.style.transform = cardDragTransform(resisted, dy, current.width);
  }

  function finish(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    consumeClick.current ||= cancelled || Math.max(Math.abs(dx), Math.abs(dy)) > 8;
    const releaseVelocity = event.timeStamp - current.lastTime < 80 ? current.velocity : 0;
    const intent = cancelled ? 0 : swipeIntent(dx, dy, event.timeStamp - current.time, current.width, releaseVelocity);
    if (current.element.hasPointerCapture(event.pointerId)) current.element.releasePointerCapture(event.pointerId);
    if (intent === 1 || (intent === -1 && activeIndex > 0)) {
      // Sound and next face start in this input event, not after an animation.
      if (intent === 1) onNext();
      else onPrevious();
    } else {
      const from = current.element.style.transform || "none";
      current.element.style.transform = "";
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const animation = current.element.animate([{ transform: from }, { transform: "none" }], {
        duration: reduced ? 0 : 180, easing: "cubic-bezier(.2,.85,.25,1)",
      });
      animations.current.set(activeIndex, animation);
      animation.onfinish = () => {
        animations.current.delete(activeIndex);
        deck.current?.removeAttribute("data-look-back");
      };
    }
  }

  return <>
    <div className="card-deck tactile-stack" ref={deck}>
      {activeIndex < cards.length - 1 && <span className="pack-stock" aria-hidden="true" />}
      {cards.map((card, index) => {
        const current = index === activeIndex;
        const position = current ? "is-front" : index === activeIndex + 1 ? "is-next" : index === activeIndex - 1 ? "is-previous" : "is-away";
        return <button key={`${card.id}-${index}`} ref={element => { if (element) elements.current.set(index, element); else elements.current.delete(index); }}
          className={`pack-card ${position}`} style={{ "--rarity-color": card.color } as CSSProperties}
          tabIndex={current ? 0 : -1} aria-hidden={!current} aria-label={current ? `${card.rarity} ${card.character}. Tap for details, swipe left for the next card.` : undefined}
          onDragStart={event => event.preventDefault()} onContextMenu={event => event.preventDefault()}
          onPointerDown={current ? down : undefined} onPointerMove={current ? move : undefined}
          onPointerUp={current ? event => finish(event) : undefined} onPointerCancel={event => finish(event, true)}
          onLostPointerCapture={event => { if (gesture.current) finish(event, true); }}
          onClick={event => {
            if (!current) return;
            if (event.detail !== 0 && consumeClick.current) { consumeClick.current = false; return; }
            onInspect();
          }}>
          <img src={card.image} draggable={false} alt={current ? `${card.rarity} ${card.character}` : ""} />
          {current && rarityTier(card.rarity) >= 2 && <span className="card-holo" />}
          {current && rarityTier(card.rarity) >= 3 && <span className="card-spark"><i /><i /><i /></span>}
        </button>;
      })}
    </div>
    <p className="stack-gesture-tip">Slide left to reveal · Tap for details</p>
  </>;
}
