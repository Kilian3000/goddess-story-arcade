"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { FoilSurface } from "./foil-surface";
import { sliceProgress, canStartSlice } from "./pack-slice";

type Props = {
  art: string; setName: string; cost: number; cards: number; count: 1 | 10;
  opening: boolean; affordable: boolean; firstCard?: string; glows: { level: number; color: string }[];
  onOpen: () => void; onFoil: (progress: number) => void;
};

export function PackOpening({ art, setName, cost, cards, count, opening, affordable, firstCard, glows, onOpen, onFoil }: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setReady(true), 700); return () => window.clearTimeout(timer); }, []);
  const surface = useRef<HTMLDivElement>(null);
  const motion = useRef<HTMLDivElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const points = useRef<string[]>([]);
  function trace(event: PointerEvent<HTMLButtonElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    points.current.push(`${((event.clientX-box.left)/box.width*100).toFixed(2)},${((event.clientY-box.top)/box.height*150).toFixed(2)}`);
    if(points.current.length>70) points.current.shift();
    trail.current?.setAttribute("d", "M"+points.current.join(" L"));
  }
  function setCut(value: number) {
    surface.current?.style.setProperty("--cut", String(value));
    surface.current?.toggleAttribute("data-cutting", value > 0);
  }
  
  const gesture = useRef<{ id: number; x: number; y: number; width: number; direction: 1 | -1; tick: number } | null>(null);
  const committed = useRef(false);
  function releaseFoil() {
    motion.current?.removeAttribute("data-held");
    for (const prop of ["--foil-x", "--foil-y", "--foil-roll", "--foil-pitch"]) motion.current?.style.removeProperty(prop);
  }
  function open() {
    if (!ready || !affordable || opening || committed.current) return;
    gesture.current = null;
    releaseFoil();
    setCut(1);
    committed.current = true;
    onOpen();
    // A failed data/economy check should leave the gesture available for retry.
    window.setTimeout(() => { committed.current = false; }, 1500);
  }
  function down(event: PointerEvent<HTMLButtonElement>) {
    if (!ready || !event.isPrimary || event.button !== 0 || opening || !affordable) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    if (!canStartSlice(x, y)) return;
    const direction = x < .5 ? 1 : -1;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: box.width, direction, tick: 0 };
    
    points.current=[]; trace(event);
    setCut(0);
    event.currentTarget.setPointerCapture(event.pointerId);
    motion.current?.setAttribute("data-held", "");
    onFoil(0);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    trace(event);
    const progress = sliceProgress(g.x, event.clientX, g.width, g.direction);
    const dx = event.clientX - g.x, dy = event.clientY - g.y;
    surface.current?.style.setProperty("--foil-light", `${20 + progress*65}%`);
    motion.current?.style.setProperty("--foil-x", `${Math.tanh(dx / g.width) * 13}px`);
    motion.current?.style.setProperty("--foil-y", `${Math.tanh(dy / g.width) * 9}px`);
    motion.current?.style.setProperty("--foil-roll", `${Math.tanh(dx / g.width) * 3}deg`);
    motion.current?.style.setProperty("--foil-pitch", `${Math.tanh(-dy / g.width) * 8}deg`);
    setCut(progress);
    const tick = Math.floor(progress * 6);
    if (tick > g.tick) { g.tick = tick; onFoil(progress); }
    if (progress >= 1) open();
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    releaseFoil();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const progress = sliceProgress(g.x, event.clientX, g.width, g.direction);
    if (!cancel && progress >= .88) open();
    else setCut(0);
  }
  return <div ref={surface} className={`pocket-opening ${opening ? "is-opening" : ""} ${count === 10 ? "is-batch" : ""}`} style={{ "--cut": opening ? 1 : 0 } as CSSProperties}>
    <div className="pocket-spotlight" aria-hidden="true" />
    <div className="pocket-card-stack" aria-hidden="true">{firstCard && <img src={firstCard} alt="" />}</div>
    <div className="pocket-pack-stage">
      <div className="pocket-pack-motion" ref={motion}>
      {Array.from({ length: count }, (_, i) => <div className={`pocket-wrapper glow-${glows[i]?.level || 0}`} key={i} style={{ "--stack": i, "--glow": glows[i]?.color || "#cde9f6", zIndex: 20 - i } as CSSProperties} aria-hidden="true">
        {(["body", "cap"] as const).map(part => <div key={part} className={`pocket-${part}-shell`}>
          <div className={`pocket-foil pocket-${part}`}>
            <img src={art} alt="" draggable={false} /><span className="pocket-foil-sheen" />
            {i === 0 && part === "body" && <FoilSurface wrapper strength={.4} />}
            <strong className="pocket-brand">GODDESS <b>STORY</b></strong>
            <span className="pocket-edition"><b>{setName}</b><small>{cards} CARDS</small></span>
            <span className="pocket-crimp" /><span className="pocket-seal-brand">GODDESS STORY <i>✦</i></span>
          </div>
          {part === "body" && <svg className="pocket-mouth" viewBox="0 0 300 22" preserveAspectRatio="none" aria-hidden="true">
            <path className="mouth-interior" d="M1 8 C38 -3 83 2 143 8 C201 14 247 13 299 9 C283 22 226 23 159 17 C91 11 43 20 1 8Z" />
            <path className="mouth-back" d="M1 8 C38 -3 83 2 143 8 C201 14 247 13 299 9" />
            <path className="mouth-front" d="M1 8 C43 20 91 11 159 17 C226 23 283 22 299 9" />
          </svg>}
        </div>)}
        <span className="pocket-hit-flash"><i /><b /><em /></span>
        
      </div>)}
      </div>
      <svg className="pocket-finger-trail" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true"><path ref={trail} /></svg>
      <button className="pocket-slice-pad" aria-label={`${count === 10 ? "10 Booster" : "Booster"} ${setName} öffnen: oben entlang der Naht wischen`} disabled={!ready || opening || !affordable} onPointerDown={down} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)} onClick={event => { if (event.detail === 0) open(); }} onDragStart={event => event.preventDefault()} />
    </div>
    <div className="pocket-opening-controls">
      {!opening && <>{!affordable && <p>Nicht genug Yuan für diese Packs</p>}<small>{count === 10 ? "10 Packs" : setName} · {count * cost} ¥</small>{affordable ? <button disabled={!ready} onClick={open}>Öffnen</button> : <a href="/store">Zum Store ↗</a>}</>}
    </div>
  </div>;
}
