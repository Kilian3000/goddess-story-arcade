"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { arcadeConfig } from "./arcade-config";
import { WalletChip } from "./wallet-chip";

type Props = {
  children: ReactNode;
  backLabel?: string;
  watermark?: string;
  balanceFen: number;
  vouchers?: { 1: number; 2: number };
  animating?: boolean;
};

export function ArcadeChrome({
  children,
  backLabel = "ARCADE",
  watermark = "GS",
  balanceFen,
  vouchers,
  animating,
}: Props) {
  return (
    <main className="gacha-stage tier-two economy-page">
      <div className="scene-vignette" />
      <div className="constellation constellation-a" />
      <div className="constellation constellation-b" />
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="dust" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      <div className="set-watermark" aria-hidden="true">{watermark}</div>
      <section className="gacha-shell" aria-label={arcadeConfig.brandLabel}>
        <header className="gacha-header">
          <div className="header-left">
            <Link className="edge-control vault-trigger back-trigger" href="/" aria-label="Zurück zur Arcade">
              <span aria-hidden="true">←</span>
              <b>{backLabel}</b>
            </Link>
          </div>
          <div className="wordmark" aria-label={arcadeConfig.brandLabel}>
            {arcadeConfig.brandLead}<span>{arcadeConfig.brandAccent}</span>
            <small>{arcadeConfig.brandTagline}</small>
          </div>
          <div className="header-actions">
            <Link className="edge-control" href="/store"><span>¥</span><b>STORE</b></Link>
            <WalletChip balanceFen={balanceFen} vouchers={vouchers} animating={animating} />
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
