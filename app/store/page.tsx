"use client";

import { useState } from "react";
import { ArcadeChrome } from "../arcade-chrome";
import { CheckoutFlow } from "../checkout-flow";
import { STORE_SKUS, formatYuan, storeSuccessChance, writePendingTopup, yuanToFen, type StoreSku } from "../economy";
import { useEconomy } from "../use-economy";

export default function StorePage() {
  const { state } = useEconomy();
  const [sku, setSku] = useState<StoreSku | null>(null);

  const approve = () => {
    if (!sku) return;
    writePendingTopup({ yuan: sku.yuan, euro: sku.euro });
    window.location.assign("/");
  };

  return (
    <ArcadeChrome watermark="STORE" balanceFen={state.balanceFen} vouchers={state.vouchers}>
      <div className="economy-body store-body">
        <header className="economy-heading">
          <span>STORE · SIMULATION</span>
          <h1>Yuan laden</h1>
          <p>Wie in einem Handyspiel — inkl. Prüfung und Ablehnungsrisiko. Es wird nirgendwo nach einer Zahlungsart gefragt.</p>
        </header>
        <p className="store-bonus">
          Pack-Bonus: +{state.packsOpenedSinceTopup}% nach {state.packsOpenedSinceTopup.toLocaleString("de-DE")} geöffneten Packs.
          Nach einem erfolgreichen Kauf fällt der Bonus auf die Baseline zurück.
        </p>
        <div className="store-grid">
          {STORE_SKUS.map((item) => {
            const chance = storeSuccessChance(item.baseline, state.packsOpenedSinceTopup);
            return (
              <button key={item.id} className="store-sku" onClick={() => setSku(item)}>
                <small>{item.euro.toLocaleString("de-DE")} €</small>
                <b>{formatYuan(yuanToFen(item.yuan))} ¥</b>
                <span>{Math.round(chance * 100)}% Freigabe</span>
                <em>Baseline {Math.round(item.baseline * 100)}%</em>
              </button>
            );
          })}
        </div>
      </div>
      {sku && (
        <CheckoutFlow
          sku={sku}
          chance={storeSuccessChance(sku.baseline, state.packsOpenedSinceTopup)}
          onCancel={() => setSku(null)}
          onApproved={approve}
        />
      )}
    </ArcadeChrome>
  );
}
