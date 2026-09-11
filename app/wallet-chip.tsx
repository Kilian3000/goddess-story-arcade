"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatYuan } from "./economy";
import { AppIcon } from "./ui-icons";

type Props = {
  balanceFen: number;
  fromFen?: number;
  vouchers?: { 1: number; 2: number };
  animating?: boolean;
};

export function WalletChip({ balanceFen, fromFen, vouchers, animating = false }: Props) {
  const [animated, setAnimated] = useState<number | null>(null);
  const start = fromFen ?? balanceFen;
  const shown = animating ? (animated ?? start) : balanceFen;

  useEffect(() => {
    if (!animating) return;
    const from = start;
    const to = balanceFen;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || from === to) return;
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 900);
      const eased = 1 - (1 - t) ** 3;
      setAnimated(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animating, balanceFen, start]);

  const voucherBits = [
    vouchers?.[1] ? `${vouchers[1]}×1¥` : "",
    vouchers?.[2] ? `${vouchers[2]}×2¥` : "",
  ].filter(Boolean).join(" · ");

  return (
    <Link className={`edge-control wallet-chip${animating ? " is-animating" : ""}`} href="/store" aria-live="polite" aria-label={`Guthaben ${formatYuan(shown)} Yuan, Store öffnen`}>
      <span className="edge-icon"><AppIcon name="wallet" /></span>
      <b>{formatYuan(shown)} ¥</b>
      {voucherBits ? <small>{voucherBits}</small> : null}
    </Link>
  );
}
