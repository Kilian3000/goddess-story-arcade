"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArcadeChrome } from "../arcade-chrome";
import { cardAsset } from "../arcade-config";
import { groupLabels, rarityColor } from "../arcade-ui";
import { TRADE_RULES, excessCopies, formatYuan } from "../economy";
import { useCardCatalog } from "../use-card-catalog";
import { useEconomy } from "../use-economy";

export default function CollectionPage() {
  const { allCards, catalog, catalogReady, dbStatus, catalogStatus } = useCardCatalog();
  const { state, valueFen, sell, trade } = useEconomy();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState("value");
  const [setFilter, setSetFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [dupesOnly, setDupesOnly] = useState(false);

  const byId = useMemo(() => new Map(allCards.map((card) => [card.id, card])), [allCards]);
  const packBySet = useMemo(() => new Map(catalog.map((pack) => [pack.setName, pack])), [catalog]);
  const rarityOf = useMemo(() => (id: number) => byId.get(id)?.rarity, [byId]);

  const owned = useMemo(() => (
    Object.entries(state.cards).flatMap(([id, count]) => {
      const card = byId.get(Number(id));
      if (!card) return [];
      return [{
        card,
        count,
        valueFen: valueFen(card.id, card.rarity),
        pack: packBySet.get(card.set_name),
      }];
    })
  ), [byId, packBySet, state.cards, valueFen]);

  const rarities = useMemo(() => [...new Set(owned.map((row) => row.card.rarity))].sort(), [owned]);
  const sets = useMemo(() => [...new Set(owned.map((row) => row.card.set_name))].sort(), [owned]);
  const groups = useMemo(() => [...new Set(owned.map((row) => row.pack?.group).filter(Boolean) as string[])], [owned]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return owned.filter((row) => {
      if (setFilter !== "all" && row.card.set_name !== setFilter) return false;
      if (groupFilter !== "all" && row.pack?.group !== groupFilter) return false;
      if (rarityFilter !== "all" && row.card.rarity !== rarityFilter) return false;
      if (dupesOnly && row.count < 2) return false;
      if (!needle) return true;
      return [
        row.card.character,
        row.card.title,
        row.card.set_name,
        row.card.number,
        row.card.rarity,
      ].some((value) => value?.toLowerCase().includes(needle));
    }).sort((left, right) => (
      (sort === "name" ? (left.card.character || "").localeCompare(right.card.character || "") : sort === "copies" ? right.count - left.count : right.valueFen - left.valueFen)
      || left.card.set_name.localeCompare(right.card.set_name)
      || left.card.number.localeCompare(right.card.number)
    ));
  }, [dupesOnly, groupFilter, owned, query, rarityFilter, setFilter, sort]);

  const unique = owned.length;
  const total = owned.reduce((sum, row) => sum + row.count, 0);
  const collectionFen = owned.reduce((sum, row) => sum + row.valueFen * row.count, 0);
  const rExcess = excessCopies(state, rarityOf, "R");
  const srExcess = excessCopies(state, rarityOf, "SR");

  const byRarity = useMemo(() => {
    const map = new Map<string, { count: number; valueFen: number }>();
    for (const row of owned) {
      const current = map.get(row.card.rarity) ?? { count: 0, valueFen: 0 };
      current.count += row.count;
      current.valueFen += row.valueFen * row.count;
      map.set(row.card.rarity, current);
    }
    return [...map.entries()].sort((left, right) => right[1].valueFen - left[1].valueFen);
  }, [owned]);

  const bySet = useMemo(() => {
    const map = new Map<string, { count: number; unique: number; valueFen: number; group: string }>();
    for (const row of owned) {
      const current = map.get(row.card.set_name) ?? {
        count: 0,
        unique: 0,
        valueFen: 0,
        group: row.pack?.group || "",
      };
      current.count += row.count;
      current.unique += 1;
      current.valueFen += row.valueFen * row.count;
      map.set(row.card.set_name, current);
    }
    return [...map.entries()].sort((left, right) => right[1].valueFen - left[1].valueFen);
  }, [owned]);

  return (
    <ArcadeChrome watermark="BINDER" activeSection="collection" balanceFen={state.balanceFen} vouchers={state.vouchers}>
      <div className="economy-body collection-body">
        <header className="economy-heading">
          <span>02 · BINDER</span>
          <h1>Sammlung</h1>
          <p>Karten, Werte und Doppelte auf einen Blick.</p>
        </header>

        {!catalogReady && dbStatus !== "error" && catalogStatus !== "error" && (
          <div className="loading-state collection-status"><span className="loader-sigil" />Sammlung wird geladen…</div>
        )}
        {(dbStatus === "error" || catalogStatus === "error") && (
          <div className="error-card collection-status"><b>Archiv nicht erreichbar</b><span>Kartendaten konnten nicht geladen werden.</span></div>
        )}

        {catalogReady && (
          <>
            <section className="collection-stats" aria-label="Sammlungsübersicht">
              <div><small>Unique</small><b>{unique.toLocaleString("de-DE")}</b></div>
              <div><small>Karten</small><b>{total.toLocaleString("de-DE")}</b></div>
              <div><small>Wert</small><b>{formatYuan(collectionFen)} ¥</b></div>
              <div><small>Geöffnet</small><b>{state.stats.packsOpened.toLocaleString("de-DE")}</b></div>
            </section>

            <details className="collection-trades"><summary>Doppelte tauschen <span>R {rExcess}/50 · SR {srExcess}/5</span></summary><section className="trade-row" aria-label="Dupe-Tausch">
              <button
                className="trade-button"
                disabled={rExcess < TRADE_RULES.R.excess}
                onClick={() => trade("R", rarityOf)}
              >
                <small>AUTO-TAUSCH</small>
                <b>50 R-Dupes → 1¥ Pack</b>
                <span>{rExcess} / {TRADE_RULES.R.excess} überschüssig</span>
              </button>
              <button
                className="trade-button"
                disabled={srExcess < TRADE_RULES.SR.excess}
                onClick={() => trade("SR", rarityOf)}
              >
                <small>AUTO-TAUSCH</small>
                <b>5 SR-Dupes → 2¥ Pack</b>
                <span>{srExcess} / {TRADE_RULES.SR.excess} überschüssig</span>
              </button>
            </section></details>

            <section className={`collection-filters${filtersOpen ? " is-expanded" : ""}`}>
              <input className="pack-search" type="search" placeholder="Charakter, Set, Nummer…" value={query} onChange={(event) => setQuery(event.target.value)} />
              <div className="binder-toolbar"><button className={dupesOnly ? "is-active" : ""} aria-pressed={dupesOnly} onClick={() => setDupesOnly(!dupesOnly)}>Doppelte</button><button aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Filter{[setFilter, groupFilter, rarityFilter].filter(v => v !== "all").length ? ` · ${[setFilter, groupFilter, rarityFilter].filter(v => v !== "all").length}` : ""} {filtersOpen ? "−" : "+"}</button><select aria-label="Karten sortieren" value={sort} onChange={event => setSort(event.target.value)}><option value="value">Wert ↓</option><option value="name">Name A–Z</option><option value="copies">Anzahl ↓</option></select></div>
              <label>
                <span>Set</span>
                <select value={setFilter} onChange={(event) => setSetFilter(event.target.value)}>
                  <option value="all">Alle Sets</option>
                  {sets.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label>
                <span>Pack</span>
                <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                  <option value="all">Alle Linien</option>
                  {groups.map((group) => <option key={group} value={group}>{groupLabels[group] || group}</option>)}
                </select>
              </label>
              <label>
                <span>Rarity</span>
                <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)}>
                  <option value="all">Alle</option>
                  {rarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                </select>
              </label>
              <label className="dupes-toggle">
                <input type="checkbox" checked={dupesOnly} onChange={(event) => setDupesOnly(event.target.checked)} />
                Nur Doppelte
              </label>
            </section>

            {filtered.length === 0 ? (
              <p className="collection-empty">{owned.length ? "Keine Karten für diesen Filter." : <>Noch keine Karten. <Link href="/">Öffne ein Pack</Link> in der Arcade.</>}</p>
            ) : (
              <section className="collection-results" aria-label="Kartensammlung">
                <header><b>DEINE KARTEN</b><span>{filtered.length} / {unique}</span></header>
                <ul className="collection-grid">
                  {filtered.map(({ card, count, valueFen: value, pack }) => (
                    <li key={card.id} style={{ "--card-color": rarityColor(card.rarity) } as CSSProperties}>
                      <div className="collection-card-art">
                        <img loading="lazy" src={cardAsset(card.image_path)} alt={`${card.rarity} ${card.character}`} />
                        <b style={{ color: rarityColor(card.rarity) }}>{card.rarity}</b>
                        <span>×{count}</span>
                      </div>
                      <div className="collection-card-copy">
                        <strong>{card.character || "Unknown"}</strong>
                        <small>{card.set_name} · {card.number}</small>
                        <em>{groupLabels[pack?.group || ""] || pack?.group || "Set"}</em>
                      </div>
                      <button onClick={() => sell(card.id, value)}>SELL · {formatYuan(value)} ¥</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(byRarity.length > 0 || bySet.length > 0) && (
              <section className="collection-ledger" aria-label="Sammlungswerte">
                <header><b>WERTÜBERSICHT</b><span>nach Rarity und Set</span></header>
                {byRarity.length > 0 && (
                  <div className="collection-breakdown" aria-label="Wert nach Rarity">
                    {byRarity.map(([rarity, row]) => (
                      <div key={rarity} style={{ "--chip": rarityColor(rarity) } as CSSProperties}>
                        <b>{rarity}</b>
                        <span>{row.count} · {formatYuan(row.valueFen)} ¥</span>
                      </div>
                    ))}
                  </div>
                )}
                {bySet.length > 0 && (
                  <div className="collection-sets" aria-label="Wert nach Set">
                    {bySet.map(([name, row]) => (
                      <div key={name}>
                        <b>{name}</b>
                        <span>{groupLabels[row.group] || row.group || "Set"} · {row.unique} unique · {row.count} Karten</span>
                        <em>{formatYuan(row.valueFen)} ¥</em>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </ArcadeChrome>
  );
}
