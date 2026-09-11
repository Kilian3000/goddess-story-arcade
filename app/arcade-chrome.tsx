"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { arcadeConfig } from "./arcade-config";
import { AppIcon } from "./ui-icons";
import { WalletChip } from "./wallet-chip";

type Props = {
  children: ReactNode;
  backLabel?: string;
  watermark?: string;
  activeSection?: "packs" | "games" | "collection" | "store";
  balanceFen: number;
  vouchers?: { 1: number; 2: number };
  animating?: boolean;
};

export function ArcadeChrome({
  children,
  backLabel = "ARCADE",
  watermark = "GS",
  activeSection,
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
              <span className="edge-icon"><AppIcon name="back" /></span>
              <b>{backLabel}</b>
            </Link>
          </div>
          <div className="wordmark" aria-label={arcadeConfig.brandLabel}>
            {arcadeConfig.brandLead}<span>{arcadeConfig.brandAccent}</span>
            <small>{arcadeConfig.brandTagline}</small>
          </div>
          <div className="header-actions">
            <Link className="edge-control" href="/store"><span className="edge-icon"><AppIcon name="store" /></span><b>STORE</b></Link>
            <WalletChip balanceFen={balanceFen} vouchers={vouchers} animating={animating} />
          </div>
        </header>
        <nav className="experience-switch economy-switch" aria-label="Navigation">
          <Link className={activeSection === "packs" ? "is-active" : ""} href="/"><span><AppIcon name="pack" /></span><b>PACKS</b><small>open</small></Link>
          <Link className={activeSection === "games" ? "is-active" : ""} href="/?play=waifu21"><span><AppIcon name="games" /></span><b>GAMES</b><small>play</small></Link>
          <Link className={activeSection === "collection" ? "is-active" : ""} href="/collection"><span><AppIcon name="collection" /></span><b>CARDS</b><small>collect</small></Link>
          <Link className={activeSection === "store" ? "is-active" : ""} href="/store"><span><AppIcon name="store" /></span><b>STORE</b><small>yuan</small></Link>
        </nav>
        {children}
      </section>
    </main>
  );
}
