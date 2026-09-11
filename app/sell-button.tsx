"use client";

import { useRef, useState, type ReactNode } from "react";

/** Activate on a completed tap, never on touch-down or a scrolling gesture. */
export function SellButton({ sold, onSell, className, children, soldLabel = "Verkauft" }: {
  sold: boolean; onSell: () => boolean; className: string; children: ReactNode; soldLabel?: string;
}) {
  const pointer = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const committed = useRef(false);
  const [completed, setCompleted] = useState(false);
  const activate = () => {
    if (sold || committed.current) return;
    committed.current = true;
    try {
      if (onSell()) setCompleted(true);
      else committed.current = false;
    } catch (error) { committed.current = false; throw error; }
  };
  return <button className={className} disabled={sold || completed}
    onPointerDown={event => {
      if (event.isPrimary && event.button === 0) pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    }}
    onPointerMove={event => {
      const p = pointer.current;
      if (p && Math.hypot(event.clientX-p.x,event.clientY-p.y)>10) p.moved=true;
    }}
    onPointerCancel={() => { pointer.current=null; }}
    onPointerLeave={() => { pointer.current=null; }}
    onPointerUp={event => {
      const p = pointer.current; pointer.current=null;
      if (!p || p.id !== event.pointerId || p.moved || Math.hypot(event.clientX-p.x,event.clientY-p.y)>10) return;
      event.preventDefault(); activate();
    }}
    onClick={event => { if (event.detail === 0) activate(); }}
  >{sold || completed ? soldLabel : children}</button>;
}
