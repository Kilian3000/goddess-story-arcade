"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArcadeChrome } from "../arcade-chrome";
import { cardAsset } from "../arcade-config";
import { CardBulkBar } from "../card-bulk-bar";
import {
  addRowCopy,
  dropHighestValue,
  pruneSelection,
  removeAllOfId,
  removeRowCopy,
  selectionTouchesLastCopy,
  selectionValueFen,
  selectedCountOf,
  toggleRowSelection,
  type BulkRow,
} from "../card-bulk-select";
import { groupLabels, rarityColor } from "../arcade-ui";
import { ACHIEVEMENTS, MAX_SHRINE, candleLit, nightOfferFresh } from "../arcade-meta";
import {
  allSetProgress,
  characterProgress,
  excessCardIds,
  makeNightOffer,
  newlyCompletedCharacters,
  ownedCount,
} from "../collection-progress";
import { CRAFT_RULES, TRADE_RULES, craftRuleForTarget, excessCopies, formatYuan } from "../economy";
import { FoilSurface } from "../foil-surface";
import { rarityTier } from "../gacha-engine";
import type { WaifuMuse } from "../lucky-shrine";
import { PatienceTable } from "../minigames/patience";
import { cardFinish } from "../pack-presentation";
import { useArcadeMeta } from "../use-arcade-meta";
import { useCardCatalog } from "../use-card-catalog";
import { useEconomy } from "../use-economy";

type Tab = "owned" | "dex" | "shrine";
type DexMode = "set" | "character";
const STICKERS = ["☆", "♥", "✦"] as const;

export default function CollectionPage() {
  const { allCards, catalog, catalogReady, dbStatus, catalogStatus } = useCardCatalog();
  const { state, valueFen, sell, sellMany, trade, craft, takeCards, grantCards, credit } = useEconomy();
  const arcade = useArcadeMeta();
  const [tab, setTab] = useState<Tab>("owned");
  const [dexMode, setDexMode] = useState<DexMode>("set");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState("value");
  const [setFilter, setSetFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [dupesOnly, setDupesOnly] = useState(false);
  const [dexSet, setDexSet] = useState("");
  const [toast, setToast] = useState("");
  const [foilSlot, setFoilSlot] = useState<number | null>(null);
  const [sticker, setSticker] = useState<(typeof STICKERS)[number]>("☆");
  const [yearIndex, setYearIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);

  const byId = useMemo(() => new Map(allCards.map((card) => [card.id, card])), [allCards]);
  const packBySet = useMemo(() => new Map(catalog.map((pack) => [pack.setName, pack])), [catalog]);
  const rarityOf = useMemo(() => (id: number) => byId.get(id)?.rarity, [byId]);
  const lookup = (id: number) => {
    const card = byId.get(id);
    return card ? { rarity: card.rarity, set_name: card.set_name } : undefined;
  };

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
  const setRows = useMemo(
    () => allSetProgress(allCards, state.cards, (name) => packBySet.get(name)?.group || ""),
    [allCards, packBySet, state.cards],
  );
  const characters = useMemo(() => characterProgress(allCards, state.cards), [allCards, state.cards]);
  const patienceRows = useMemo(() => owned.map((row) => ({ card: row.card, count: row.count, valueFen: row.valueFen })), [owned]);
  const patienceMuses = useMemo<WaifuMuse[]>(() => (
    arcade.shrineCardIds.flatMap((id) => {
      const card = byId.get(id);
      return card ? [{ image: cardAsset(card.image_path), character: card.character, rarity: card.rarity, setName: card.set_name, attitude: "confident", duelTier: 1 }] : [];
    })
  ), [arcade.shrineCardIds, byId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return owned.filter((row) => {
      if (setFilter !== "all" && row.card.set_name !== setFilter) return false;
      if (groupFilter !== "all" && row.pack?.group !== groupFilter) return false;
      if (rarityFilter !== "all" && row.card.rarity !== rarityFilter) return false;
      if (dupesOnly && row.count < 2) return false;
      if (!needle) return true;
      return [row.card.character, row.card.title, row.card.set_name, row.card.number, row.card.rarity]
        .some((value) => value?.toLowerCase().includes(needle));
    }).sort((left, right) => (
      (sort === "name" ? (left.card.character || "").localeCompare(right.card.character || "") : sort === "copies" ? right.count - left.count : right.valueFen - left.valueFen)
      || left.card.set_name.localeCompare(right.card.set_name)
      || left.card.number.localeCompare(right.card.number)
    ));
  }, [dupesOnly, groupFilter, owned, query, rarityFilter, setFilter, sort]);

  const ownedBulk = useMemo<BulkRow[]>(() => owned.map((row) => ({
    id: row.card.id,
    rarity: row.card.rarity,
    setName: row.card.set_name,
    character: row.card.character || "Unknown",
    count: row.count,
    valueFen: row.valueFen,
  })), [owned]);
  const filteredBulk = useMemo<BulkRow[]>(() => filtered.map((row) => ({
    id: row.card.id,
    rarity: row.card.rarity,
    setName: row.card.set_name,
    character: row.card.character || "Unknown",
    count: row.count,
    valueFen: row.valueFen,
  })), [filtered]);
  const liveSelected = pruneSelection(selected, ownedBulk);
  const selectedValue = selectionValueFen(ownedBulk, liveSelected);

  const unique = owned.length;
  const total = owned.reduce((sum, row) => sum + row.count, 0);
  const collectionFen = owned.reduce((sum, row) => sum + row.valueFen * row.count, 0);
  const rExcess = excessCopies(state, rarityOf, "R");
  const srExcess = excessCopies(state, rarityOf, "SR");
  const activeSet = dexSet || setRows[0]?.setName || "";
  const dexCards = allCards.filter((card) => card.set_name === activeSet).sort((left, right) => left.number.localeCompare(right.number) || left.id - right.id);
  const activeProgress = setRows.find((row) => row.setName === activeSet);
  const lit = candleLit(arcade.meta);
  const offer = arcade.meta.nightOffer && nightOfferFresh(arcade.meta) ? arcade.meta.nightOffer : null;
  const offerTarget = offer ? byId.get(offer.targetId) : null;
  const yearPages = arcade.meta.yearbook;
  const yearPage = yearPages[yearIndex] || yearPages[0] || null;

  useEffect(() => {
    if (!catalogReady) return;
    const now = Date.now();
    if (nightOfferFresh(arcade.meta, now)) return;
    const next = makeNightOffer(allCards, state.cards, now);
    if (!next && !arcade.meta.nightOffer) return;
    arcade.setNightOffer(next);
  }, [allCards, arcade.meta.nightOffer, catalogReady, state.cards]);

  useEffect(() => {
    if (!catalogReady) return;
    const known = arcade.meta.yearbook.map((page) => page.character);
    for (const name of newlyCompletedCharacters(allCards, state.cards, known)) {
      const row = characters.find((item) => item.character === name);
      const first = row?.cards.find((card) => ownedCount(state.cards, card.id) > 0);
      arcade.addYearbook(name, first?.id || 0);
    }
  }, [allCards, arcade.meta.yearbook, catalogReady, characters, state.cards]);

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2800);
  };

  const tryCraft = (card: { id: number; rarity: string; set_name: string; character: string }) => {
    const result = craft(card, lookup);
    if (!result.ok) {
      flash("Craft nicht möglich — zu wenig Dupes.");
      return;
    }
    flash(`${card.character || card.set_name} gecraftet`);
  };

  const sellSelected = () => {
    if (!liveSelected.length) return;
    if (selectionTouchesLastCopy(ownedBulk, liveSelected) && !window.confirm("Die Auswahl enthält letzte Kopien. Trotzdem verkaufen?")) return;
    const items = liveSelected.map((id) => {
      const card = byId.get(id);
      return { cardId: id, valueFen: card ? valueFen(card.id, card.rarity) : 0 };
    });
    const sold = sellMany(items);
    if (sold) {
      flash(`${sold} Karten verkauft`);
      setSelected([]);
    }
  };

  const lightOffering = () => {
    const ids = excessCardIds(state.cards, rarityOf, "R", 3);
    if (ids.length < 3 || !takeCards(ids)) {
      flash("Drei Excess-R nötig.");
      return;
    }
    arcade.lightCandle();
    flash("Opferkerze brennt 24 Stunden.");
  };

  const acceptNight = () => {
    if (!offer || !takeCards(offer.payIds)) {
      flash("Nachtmarkt braucht Excess, nie die letzte Kopie.");
      return;
    }
    grantCards([offer.targetId]);
    arcade.setNightOffer(null);
    flash("Geist handelt. Lücke geschlossen.");
  };

  const printPurikura = async () => {
    const ids = arcade.shrineCardIds.slice(0, 3);
    if (ids.length < 3) {
      flash("Drei Schrein-Karten für den Streifen.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 760;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#1a1020";
    ctx.fillRect(0, 0, 360, 760);
    for (let index = 0; index < 3; index += 1) {
      const card = byId.get(ids[index]);
      if (!card) continue;
      const image = new Image();
      image.src = cardAsset(card.image_path);
      await image.decode().catch(() => undefined);
      ctx.drawImage(image, 30, 24 + index * 230, 300, 210);
    }
    ctx.fillStyle = "#ffe27a";
    ctx.font = "18px monospace";
    ctx.fillText(`${sticker}  ${new Date().toLocaleDateString("de-DE")}  ${sticker}`, 30, 730);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "purikura.png";
    link.click();
    arcade.unlockAchievement("purikura");
    flash("Streifen gespeichert.");
  };

  return (
    <ArcadeChrome watermark="BINDER" activeSection="collection" balanceFen={state.balanceFen} vouchers={state.vouchers}>
      <div className="economy-body collection-body">
        <header className="economy-heading">
          <span>02 · BINDER</span>
          <h1>Sammlung</h1>
          <p>Karten zeigen, Sets jagen, Chase pinnen.</p>
        </header>

        {!catalogReady && dbStatus !== "error" && catalogStatus !== "error" && (
          <div className="loading-state collection-status"><span className="loader-sigil" />Sammlung wird geladen…</div>
        )}
        {(dbStatus === "error" || catalogStatus === "error") && (
          <div className="error-card collection-status"><b>Archiv nicht erreichbar</b><span>Kartendaten konnten nicht geladen werden.</span></div>
        )}

        {catalogReady && (
          <>
            <nav className="collection-tabs" aria-label="Binder-Ansichten">
              <button type="button" className={tab === "owned" ? "is-active" : ""} onClick={() => setTab("owned")}>Owned</button>
              <button type="button" className={tab === "dex" ? "is-active" : ""} onClick={() => setTab("dex")}>Dex</button>
              <button type="button" className={tab === "shrine" ? "is-active" : ""} onClick={() => setTab("shrine")}>Schrein</button>
            </nav>

            <section className="collection-stats" aria-label="Sammlungsübersicht">
              <div><small>Unique</small><b>{unique.toLocaleString("de-DE")}</b></div>
              <div><small>Karten</small><b>{total.toLocaleString("de-DE")}</b></div>
              <div><small>Wert</small><b>{formatYuan(collectionFen)} ¥</b></div>
              <div><small>Geöffnet</small><b>{state.stats.packsOpened.toLocaleString("de-DE")}</b></div>
            </section>

            {arcade.chaseCardIds.length > 0 && (
              <section className="chase-row" aria-label="Chase-Pins">
                {arcade.chaseCardIds.map((id) => {
                  const card = byId.get(id);
                  if (!card) return null;
                  return (
                    <Link key={id} href={`/?set=${encodeURIComponent(card.set_name)}`} className="chase-chip">
                      <img src={cardAsset(card.image_path)} alt="" />
                      <span>{card.character || card.set_name}</span>
                    </Link>
                  );
                })}
              </section>
            )}

            <details className="achievement-drawer">
              <summary>Achievements <span>{arcade.achievements.length}/{ACHIEVEMENTS.length}</span></summary>
              <ul>
                {ACHIEVEMENTS.map((item) => (
                  <li key={item.id} className={arcade.achievements.includes(item.id) ? "is-on" : ""}>
                    <b>{item.title}</b>
                    <span>{item.blurb}</span>
                  </li>
                ))}
              </ul>
            </details>

            {tab === "owned" && (
              <>
                <details className="collection-trades"><summary>Doppelte tauschen <span>R {rExcess}/50 · SR {srExcess}/5</span></summary><section className="trade-row" aria-label="Dupe-Tausch">
                  <button className="trade-button" disabled={rExcess < TRADE_RULES.R.excess} onClick={() => trade("R", rarityOf)}>
                    <small>AUTO-TAUSCH</small>
                    <b>50 R-Dupes → 1¥ Pack</b>
                    <span>{rExcess} / {TRADE_RULES.R.excess} überschüssig</span>
                  </button>
                  <button className="trade-button" disabled={srExcess < TRADE_RULES.SR.excess} onClick={() => trade("SR", rarityOf)}>
                    <small>AUTO-TAUSCH</small>
                    <b>5 SR-Dupes → 2¥ Pack</b>
                    <span>{srExcess} / {TRADE_RULES.SR.excess} überschüssig</span>
                  </button>
                </section></details>

                <details className="night-market" open={Boolean(offer)}>
                  <summary>Nachtmarkt <span>{offer ? "Geist wartet" : "kein Angebot"}</span></summary>
                  {offer && offerTarget ? (
                    <div className="night-offer">
                      <p>{offerTarget.character || offerTarget.set_name} gegen {offer.payIds.length} Excess aus {offer.setName}. Nie die letzte Kopie.</p>
                      <div className="binder-toolbar">
                        <button type="button" onClick={acceptNight}>Annehmen</button>
                        <button type="button" onClick={() => arcade.setNightOffer(null)}>Ablehnen</button>
                      </div>
                    </div>
                  ) : <p>In 12 Stunden kommt der nächste Geist — wenn Excess und eine Dex-Lücke passen.</p>}
                </details>

                <section className={`collection-filters${filtersOpen ? " is-expanded" : ""}`}>
                  <input className="pack-search" type="search" placeholder="Charakter, Set, Nummer…" value={query} onChange={(event) => setQuery(event.target.value)} />
                  <div className="binder-toolbar">
                    <button className={dupesOnly ? "is-active" : ""} aria-pressed={dupesOnly} onClick={() => setDupesOnly(!dupesOnly)}>Doppelte</button>
                    <button aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Filter{[setFilter, groupFilter, rarityFilter].filter((value) => value !== "all").length ? ` · ${[setFilter, groupFilter, rarityFilter].filter((value) => value !== "all").length}` : ""} {filtersOpen ? "−" : "+"}</button>
                    <select aria-label="Karten sortieren" value={sort} onChange={(event) => setSort(event.target.value)}><option value="value">Wert ↓</option><option value="name">Name A–Z</option><option value="copies">Anzahl ↓</option></select>
                  </div>
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
                </section>

                {filtered.length === 0 ? (
                  <p className="collection-empty">{owned.length ? "Keine Karten für diesen Filter." : <>Noch keine Karten. <Link href="/">Öffne ein Pack</Link> in der Arcade.</>}</p>
                ) : (
                  <section className="collection-results" aria-label="Kartensammlung">
                    <header>
                      <b>DEINE KARTEN</b>
                      <span>{filtered.length} / {unique}</span>
                      <button type="button" className="junk-sell" onClick={() => {
                        const junk = filtered.filter((row) => row.card.rarity === "R").flatMap((row) => Array.from({ length: Math.max(0, row.count - 1) }, () => ({ cardId: row.card.id, valueFen: row.valueFen })));
                        const sold = sellMany(junk);
                        if (sold) flash(`${sold} R-Doubles verkauft`);
                      }}>Alle R-Doubles im Filter</button>
                    </header>
                    <CardBulkBar
                      rows={filteredBulk}
                      fullRows={ownedBulk}
                      selected={liveSelected}
                      onChange={setSelected}
                      applyLabel="Markieren"
                    />
                    {liveSelected.length > 0 && (
                      <div className="bulk-dock">
                        <b>{liveSelected.length} gewählt · {formatYuan(selectedValue)} ¥</b>
                        <button type="button" className="junk-sell" onClick={sellSelected}>Auswahl verkaufen</button>
                        <button type="button" onClick={() => setSelected(dropHighestValue(ownedBulk, liveSelected))}>Teuerste weg</button>
                        <button type="button" onClick={() => setSelected([])}>Leeren</button>
                      </div>
                    )}
                    <ul className="collection-grid">
                      {filtered.map(({ card, count, valueFen: value, pack }) => {
                        const used = selectedCountOf(liveSelected, card.id);
                        const bulkRow = { id: card.id, rarity: card.rarity, setName: card.set_name, character: card.character || "Unknown", count, valueFen: value };
                        return (
                          <li
                            key={card.id}
                            className={used ? "is-selected" : ""}
                            style={{ "--card-color": rarityColor(card.rarity) } as CSSProperties}
                          >
                            <button
                              type="button"
                              className="collection-card-pick"
                              aria-pressed={used > 0}
                              onClick={() => setSelected(toggleRowSelection(liveSelected, bulkRow))}
                            >
                              <div className="collection-card-art">
                                <img loading="lazy" src={cardAsset(card.image_path)} alt={`${card.rarity} ${card.character}`} />
                                <b style={{ color: rarityColor(card.rarity) }}>{card.rarity}</b>
                                <span>×{count}</span>
                                {used > 0 && <em className="collection-pick-count">{used}</em>}
                              </div>
                              <div className="collection-card-copy">
                                <strong>{card.character || "Unknown"}</strong>
                                <small>{card.set_name} · {card.number}</small>
                                <em>{groupLabels[pack?.group || ""] || pack?.group || "Set"}</em>
                              </div>
                            </button>
                            <div className="collection-card-actions">
                              {used > 0 && (
                                <div className="stake-qty">
                                  <span>{used}/{count}{used >= count ? " · letzte Kopie" : ""}</span>
                                  <button type="button" onClick={() => setSelected(removeRowCopy(liveSelected, card.id))} aria-label={`${card.character} weniger`}>−</button>
                                  <button type="button" disabled={used >= count} onClick={() => setSelected(addRowCopy(liveSelected, bulkRow))} aria-label={`${card.character} mehr`}>+</button>
                                  <button type="button" onClick={() => setSelected(removeAllOfId(liveSelected, card.id))} aria-label={`${card.character} aus der Auswahl nehmen`}>×</button>
                                </div>
                              )}
                              <button type="button" onClick={() => {
                                if (sell(card.id, value)) {
                                  setSelected(removeRowCopy(liveSelected, card.id));
                                }
                              }}>SELL · {formatYuan(value)} ¥</button>
                              <button type="button" className={arcade.chaseCardIds.includes(card.id) ? "is-active" : ""} onClick={() => arcade.toggleChase(card.id)}>Chase</button>
                              <button type="button" onClick={() => arcade.placeOnShrine(card.id)}>Schrein</button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </>
            )}

            {tab === "dex" && (
              <section className="dex-panel">
                <div className="binder-toolbar">
                  <button type="button" className={dexMode === "set" ? "is-active" : ""} onClick={() => setDexMode("set")}>Sets</button>
                  <button type="button" className={dexMode === "character" ? "is-active" : ""} onClick={() => setDexMode("character")}>Charaktere</button>
                </div>
                {dexMode === "set" && (
                  <>
                    <label className="dex-set-pick">
                      <span>Set</span>
                      <select value={activeSet} onChange={(event) => setDexSet(event.target.value)}>
                        {setRows.map((row) => (
                          <option key={row.setName} value={row.setName}>{row.setName} · {row.unique}/{row.total} · {row.title}</option>
                        ))}
                      </select>
                    </label>
                    {activeProgress && (
                      <p className="dex-progress">{activeProgress.unique}/{activeProgress.total} · {activeProgress.title}
                        <Link href={`/?set=${encodeURIComponent(activeSet)}`}>Zum Set</Link>
                      </p>
                    )}
                    <ul className="dex-grid">
                      {dexCards.map((card) => {
                        const have = ownedCount(state.cards, card.id);
                        const rule = craftRuleForTarget(card.rarity);
                        return (
                          <li key={card.id} className={have ? "is-owned" : "is-missing"} style={{ "--card-color": rarityColor(card.rarity) } as CSSProperties}>
                            {have ? <img loading="lazy" src={cardAsset(card.image_path)} alt="" /> : <span className="dex-gap" />}
                            <b>{card.rarity}</b>
                            <strong>{card.character || card.number}</strong>
                            <small>{have ? `×${have}` : "Lücke"}</small>
                            <div>
                              <button type="button" className={arcade.chaseCardIds.includes(card.id) ? "is-active" : ""} onClick={() => arcade.toggleChase(card.id)}>Chase</button>
                              {rule && (rule === "CHASE" || !have) && <button type="button" onClick={() => tryCraft(card)}>Craft {CRAFT_RULES[rule].excess} {CRAFT_RULES[rule].from}</button>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                {dexMode === "character" && (
                  <>
                    <input className="pack-search" type="search" placeholder="Charakter…" value={query} onChange={(event) => setQuery(event.target.value)} />
                    {yearPage && (
                      <article className="yearbook-page">
                        <b>Jahrbuch</b>
                        <strong>{yearPage.character}</strong>
                        <span>{new Date(yearPage.unlockedAt).toLocaleDateString("de-DE")}</span>
                        {byId.get(yearPage.firstNewId) && <img src={cardAsset(byId.get(yearPage.firstNewId)!.image_path)} alt="" />}
                        {yearPages.length > 1 && (
                          <div className="binder-toolbar">
                            <button type="button" onClick={() => setYearIndex((index) => (index - 1 + yearPages.length) % yearPages.length)}>←</button>
                            <button type="button" onClick={() => setYearIndex((index) => (index + 1) % yearPages.length)}>→</button>
                          </div>
                        )}
                      </article>
                    )}
                    <ul className="character-dex">
                      {characters.filter((row) => {
                        const needle = query.trim().toLowerCase();
                        return !needle || row.character.toLowerCase().includes(needle);
                      }).map((row) => {
                        const setsFor = [...new Set(row.cards.map((card) => card.set_name))];
                        const oshi = arcade.meta.oshiCharacter === row.character;
                        const complete = row.unique === row.total && row.total > 0;
                        return (
                          <li key={row.character} className={`${oshi ? "is-oshi" : ""}${complete && oshi ? " is-polaroid" : ""}`}>
                            <b>{row.character}{complete && oshi ? " · Polaroid" : ""}</b>
                            <span>{row.unique}/{row.total}</span>
                            <div className="star-nodes" aria-hidden="true">
                              {setsFor.map((name) => {
                                const inSet = row.cards.filter((card) => card.set_name === name);
                                const have = inSet.filter((card) => ownedCount(state.cards, card.id) > 0).length;
                                return <i key={name} className={have === inSet.length ? "is-lit" : have ? "is-partial" : ""} title={name} />;
                              })}
                            </div>
                            <button type="button" className={oshi ? "is-active" : ""} onClick={() => arcade.setOshi(oshi ? null : row.character)}>
                              {oshi ? "Oshi" : "Als Oshi"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>
            )}

            {tab === "shrine" && (
              <section className={`shrine-board${lit ? " is-candle" : ""}`} aria-label="Schrein">
                <p>Bis zu neun Favoriten. Rein zum Zeigen.{lit ? " Die Kerze brennt." : ""}</p>
                <div className="binder-toolbar">
                  <button type="button" disabled={lit || rExcess < 3} onClick={lightOffering}>Opferkerze · 3 Excess-R</button>
                </div>
                <ol>
                  {Array.from({ length: MAX_SHRINE }, (_, index) => {
                    const id = arcade.shrineCardIds[index];
                    const card = id ? byId.get(id) : null;
                    return (
                      <li key={index}>
                        {card ? (
                          <button
                            type="button"
                            className="shrine-slot"
                            onClick={() => arcade.removeFromShrine(card.id)}
                            onPointerEnter={() => setFoilSlot(index)}
                            onPointerLeave={() => setFoilSlot((current) => current === index ? null : current)}
                            onFocus={() => setFoilSlot(index)}
                            onBlur={() => setFoilSlot((current) => current === index ? null : current)}
                          >
                            <span className="shrine-foil tactile-stack">
                              <img src={cardAsset(card.image_path)} alt={card.character} />
                              {foilSlot === index && (
                                <FoilSurface
                                  finish={cardFinish(card.rarity)}
                                  strength={rarityTier(card.rarity) >= 4 ? .85 : rarityTier(card.rarity) >= 3 ? .65 : rarityTier(card.rarity) >= 2 ? .45 : rarityTier(card.rarity) >= 1 ? .3 : 0}
                                />
                              )}
                            </span>
                            <small>{card.character}</small>
                          </button>
                        ) : <span>Leer</span>}
                      </li>
                    );
                  })}
                </ol>
                <div className="purikura-panel">
                  <b>Purikura</b>
                  <p>Drei Schrein-Slots, ein Sticker, Datum. Ein Streifen zum Speichern.</p>
                  <div className="binder-toolbar">
                    {STICKERS.map((mark) => (
                      <button key={mark} type="button" className={sticker === mark ? "is-active" : ""} onClick={() => setSticker(mark)}>{mark}</button>
                    ))}
                    <button type="button" onClick={() => void printPurikura()}>Streifen speichern</button>
                  </div>
                </div>
                <details className="evening-mode">
                  <summary>Abend-Modus · Kabufuda</summary>
                  <PatienceTable
                    rows={patienceRows}
                    catalog={allCards}
                    muses={patienceMuses}
                    credit={credit}
                    onPulse={() => undefined}
                    playUiTap={async () => undefined}
                    playWin={async () => undefined}
                  />
                </details>
              </section>
            )}
            {toast && <p className="meta-toast" role="status">{toast}</p>}
          </>
        )}
      </div>
    </ArcadeChrome>
  );
}
