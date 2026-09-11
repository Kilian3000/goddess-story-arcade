"use client";

import { useEffect, useRef, useState } from "react";
import { formatYuan, yuanToFen, type StoreSku } from "./economy";

type Stage = "cart" | "verify" | "authorize" | "approved" | "declined";

type Props = {
  sku: StoreSku;
  chance: number;
  onCancel: () => void;
  onApproved: () => void;
};

const stageCopy: Record<Stage, { kicker: string; title: string; body: string }> = {
  cart: {
    kicker: "SIMULATED CHECKOUT",
    title: "Bestätigen",
    body: "Keine echte Zahlung. Es wird keine Zahlungsart abgefragt — nur das Gefühl eines Handy-Stores.",
  },
  verify: {
    kicker: "PRÜFUNG",
    title: "Wird geprüft…",
    body: "Bestellung wird mit dem Simulator-Konto abgeglichen.",
  },
  authorize: {
    kicker: "AUTORISIERUNG",
    title: "Wird autorisiert…",
    body: "Die Einzahlung wartet auf Freigabe.",
  },
  approved: {
    kicker: "FREIGEGEBEN",
    title: "Autorisiert",
    body: "Du wirst zur Arcade zurückgebracht.",
  },
  declined: {
    kicker: "ABGELEHNT",
    title: "Einzahlung abgelehnt",
    body: "Die Bank des Simulators hat die Buchung nicht durchgewunken. Der Pack-Bonus bleibt erhalten.",
  },
};

export function CheckoutFlow({ sku, chance, onCancel, onApproved }: Props) {
  const [stage, setStage] = useState<Stage>("cart");
  const timers = useRef<number[]>([]);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const beginPay = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setStage("verify");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const verifyMs = reduced ? 40 : 900;
    const authMs = reduced ? 80 : 2200;
    timers.current = [
      window.setTimeout(() => setStage("authorize"), verifyMs),
      window.setTimeout(() => {
        const approved = Math.random() < chance;
        setStage(approved ? "approved" : "declined");
        if (approved) {
          window.setTimeout(onApproved, reduced ? 20 : 600);
        }
      }, authMs),
    ];
  };

  const copy = stageCopy[stage];
  const busy = stage === "verify" || stage === "authorize" || stage === "approved";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className={`odds-modal checkout-modal checkout-${stage}`} role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        {stage === "cart" || stage === "declined" ? (
          <button className="modal-close" onClick={onCancel} aria-label="Checkout schließen">×</button>
        ) : null}
        <span className="odds-kicker">{copy.kicker}</span>
        <h2 id="checkout-title">{copy.title}</h2>
        <p className="odds-pattern">{formatYuan(yuanToFen(sku.yuan))} Yuan · {sku.euro.toLocaleString("de-DE")} €</p>
        <p className="odds-intro">{copy.body}</p>
        <div className="checkout-meter" aria-hidden={stage === "cart"}>
          <i data-stage={stage} />
          <span>{stage === "verify" ? "Prüfung" : stage === "authorize" ? "Autorisierung" : stage === "approved" ? "Freigegeben" : stage === "declined" ? "Abgelehnt" : "Bereit"}</span>
        </div>
        <p className="checkout-chance">Freigabechance {Math.round(chance * 100)}%</p>
        {stage === "cart" && (
          <div className="checkout-actions">
            <button className="primary-action" onClick={beginPay}>
              <span>JETZT AUFLADEN</span><i>¥</i>
            </button>
            <button className="checkout-cancel" onClick={onCancel}>Abbrechen</button>
          </div>
        )}
        {stage === "declined" && (
          <button className="primary-action" onClick={onCancel}><span>ZURÜCK ZUM STORE</span><i>←</i></button>
        )}
        {busy && <p className="checkout-wait" aria-live="polite">{copy.title}</p>}
      </section>
    </div>
  );
}
