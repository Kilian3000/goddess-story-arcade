"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

import { CAROUSEL_PACKS, carouselOffset, carouselRelease } from "./carousel-motion";
type Props = { art: string; character: string; setName: string; cost: number; cards: number; onChoose: () => void; onTick: () => void };

export function PackCarousel({ art, character, setName, cost, cards, onChoose, onTick }: Props) {
  const [position, setPosition] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const current = useRef(0);
  const frame = useRef(0);
  const chosen = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ id: number; x: number; start: number; lastX: number; time: number; speed: number; moved: boolean; step: number } | null>(null);
  const suppress = useRef(false);
  const lastTick = useRef(0);
  useEffect(() => () => { cancelAnimationFrame(frame.current); if (timer.current) clearTimeout(timer.current); }, []);
  function update(value: number) {
    current.current = value; setPosition(value);
    const tick = Math.round(value);
    if (tick !== lastTick.current) { lastTick.current = tick; onTick(); }
  }
  function settle(target: number) {
    cancelAnimationFrame(frame.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { update(target); return; }
    const from = current.current;
    let start: number | undefined;
    function step(now: number) {
      start ??= now;
      const t = Math.min(1, (now - start) / 340);
      update(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame.current = requestAnimationFrame(step);
    }
    frame.current = requestAnimationFrame(step);
  }
  function choose() {
    if (chosen.current || drag.current) return;
    chosen.current = true; cancelAnimationFrame(frame.current);
    update(Math.round(current.current)); setChoosing(true); onTick();
    timer.current = setTimeout(onChoose, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280);
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || chosen.current) return;
    cancelAnimationFrame(frame.current); suppress.current = false;
    drag.current = { id: event.pointerId, x: event.clientX, start: current.current, lastX: event.clientX, time: event.timeStamp, speed: 0, moved: false, step: Math.max(90, Math.min(180, event.currentTarget.clientWidth * .24)) };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const g = drag.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x;
    if (Math.abs(dx) > 6) { g.moved = true; suppress.current = true; event.currentTarget.setPointerCapture(event.pointerId); }
    if (!g.moved) return;
    g.speed = -(event.clientX - g.lastX) / Math.max(1, event.timeStamp - g.time) / g.step;
    g.lastX = event.clientX; g.time = event.timeStamp;
    update(g.start - dx / g.step);
  }
  function up(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const g = drag.current;
    if (!g || g.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (g.moved || cancelled) settle(carouselRelease(current.current, !cancelled && event.timeStamp - g.time < 80 ? g.speed : 0));
  }
  const selected = ((Math.round(position) % CAROUSEL_PACKS) + CAROUSEL_PACKS) % CAROUSEL_PACKS;
  return <section className={`booster-carousel ${choosing ? "is-chosen" : ""}`} aria-label="Choose a booster from the carousel">
    <div className="carousel-heading"><small>{setName} · {cost} YUAN</small><h1>WHICH ONE<br /><em>FEELS LUCKY?</em></h1></div>
    <div className="carousel-ring" onPointerDown={down} onPointerMove={move} onPointerUp={event => up(event)} onPointerCancel={event => up(event, true)} onLostPointerCapture={event => { if (drag.current) up(event, true); }} onDragStart={event => event.preventDefault()}>
      <div className="carousel-floor" aria-hidden="true" />
      {Array.from({ length: CAROUSEL_PACKS }, (_, index) => {
        const offset = carouselOffset(index, position), angle = offset * Math.PI * 2 / CAROUSEL_PACKS, depth = Math.cos(angle);
        return <button key={index} className={`carousel-pack ${selected === index ? "is-front" : ""}`} aria-label={`Booster ${index + 1}${selected === index ? ", pick this pack" : ", bring to front"}`} aria-pressed={selected === index} disabled={choosing} style={{
          "--ring-x": Math.sin(angle), "--ring-depth": depth - 1, "--ring-turn": `${-offset * 22}deg`, "--pack-light": .42 + (depth + 1) * .29, zIndex: Math.round((depth + 1) * 100),
        } as CSSProperties} onClick={() => { if (suppress.current) { suppress.current = false; return; } if (selected === index) choose(); else settle(current.current + offset); }} onKeyDown={event => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); settle(Math.round(current.current) + (event.key === "ArrowRight" ? 1 : -1)); }
        }}>
          <span className="carousel-wrapper"><img src={art} alt="" draggable={false} /><span className="carousel-foil" /><span className="carousel-title">GODDESS<br /><b>STORY</b></span><span className="carousel-edition">{setName}<small>{cards} CARDS · {character}</small></span></span>
        </button>;
      })}
    </div>
    <div className="carousel-controls"><button onClick={() => settle(Math.round(current.current) - 1)} disabled={choosing} aria-label="Rotate packs left">←</button><span aria-live="polite">{String(selected + 1).padStart(2,"0")} <i>/ {CAROUSEL_PACKS}</i></span><button onClick={() => settle(Math.round(current.current) + 1)} disabled={choosing} aria-label="Rotate packs right">→</button></div>
    <button className="carousel-choose" onClick={choose} disabled={choosing}>{choosing ? "THIS IS THE ONE" : "PICK THIS PACK"} <span>↗</span></button>
    <p className="carousel-note">Swipe to browse. Same set, same odds.</p>
  </section>;
}
