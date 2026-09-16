"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cardAsset } from "../arcade-config";
import { rarityColor } from "../arcade-ui";
import { CardBulkBar } from "../card-bulk-bar";
import { pickSingleId, removeAllOfId, type BulkRow } from "../card-bulk-select";
import type { Card } from "../card-types";
import { formatYuan } from "../economy";

export type StakeCard = {
  card: Card;
  count: number;
  valueFen: number;
};

type SortKey = "value-desc" | "value-asc" | "name" | "rarity";

type Props = {
  rows: StakeCard[];
  selected: number[];
  onChange: (ids: number[]) => void;
  max?: number;
  disabled?: boolean;
  emptyHint?: string;
};

const PAGE_ROWS = 3;
const COL_MIN = 118;
const COL_GAP = 8;

export function selectedCount(selected: number[], cardId: number) {
  return selected.filter((id) => id === cardId).length;
}

export function stakeValueFen(rows: StakeCard[], selected: number[]) {
  const values = new Map(rows.map((row) => [row.card.id, row.valueFen]));
  return selected.reduce((sum, id) => sum + (values.get(id) || 0), 0);
}

export function StakeStrip({ cards, empty }: { cards: Card[]; empty?: string }) {
  if (!cards.length) return empty ? <p className="stake-empty">{empty}</p> : null;
  return (
    <ul className="pot-strip">
      {cards.map((card, index) => (
        <li key={`${card.id}-${index}`} style={{ "--card-color": rarityColor(card.rarity) } as CSSProperties}>
          <img src={cardAsset(card.image_path)} alt="" />
          <span>{card.character}</span>
        </li>
      ))}
    </ul>
  );
}

function columnsForWidth(width: number) {
  if (width <= 0) return 6;
  return Math.max(2, Math.floor((width + COL_GAP) / (COL_MIN + COL_GAP)));
}

function toBulkRow(row: StakeCard): BulkRow {
  return {
    id: row.card.id,
    rarity: row.card.rarity,
    setName: row.card.set_name,
    character: row.card.character || "Unknown",
    count: row.count,
    valueFen: row.valueFen,
  };
}

export function CardStakePicker({
  rows,
  selected,
  onChange,
  max = Number.POSITIVE_INFINITY,
  disabled,
  emptyHint = "Noch keine Karten in der Sammlung.",
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(6);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("value-desc");
  const [dupesOnly, setDupesOnly] = useState(false);
  const [singlesOnly, setSinglesOnly] = useState(false);
  const [rarity, setRarity] = useState("all");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const pageSize = columns * PAGE_ROWS;

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const update = () => setColumns(columnsForWidth(node.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rarities = useMemo(
    () => [...new Set(rows.map((row) => row.card.rarity))].sort(),
    [rows],
  );

  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (selectedOnly && !selectedIds.has(row.card.id)) return false;
      if (dupesOnly && row.count < 2) return false;
      if (singlesOnly && row.count > 1) return false;
      if (rarity !== "all" && row.card.rarity !== rarity) return false;
      if (!needle) return true;
      return [
        row.card.character,
        row.card.title,
        row.card.set_name,
        row.card.number,
        row.card.rarity,
      ].some((value) => value?.toLowerCase().includes(needle));
    });
    next.sort((left, right) => {
      if (sort === "value-asc") return left.valueFen - right.valueFen || left.card.id - right.card.id;
      if (sort === "name") return (left.card.character || "").localeCompare(right.card.character || "") || left.card.id - right.card.id;
      if (sort === "rarity") return left.card.rarity.localeCompare(right.card.rarity) || right.valueFen - left.valueFen;
      return right.valueFen - left.valueFen || left.card.id - right.card.id;
    });
    return next;
  }, [dupesOnly, query, rarity, rows, selectedIds, selectedOnly, singlesOnly, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const selectedValue = stakeValueFen(rows, selected);
  const bulkRows = useMemo(() => filtered.map(toBulkRow), [filtered]);
  const allBulkRows = useMemo(() => rows.map(toBulkRow), [rows]);
  const multi = max > 1;

  const add = (cardId: number, owned: number) => {
    if (disabled) return;
    const used = selectedCount(selected, cardId);
    if (used >= owned) return;
    if (max <= 1) {
      onChange([cardId]);
      return;
    }
    if (selected.length >= max) return;
    onChange([...selected, cardId]);
  };

  const toggleCard = (cardId: number, owned: number) => {
    if (disabled) return;
    if (selectedCount(selected, cardId) > 0) {
      onChange(removeAllOfId(selected, cardId));
      return;
    }
    add(cardId, owned);
  };

  const remove = (cardId: number) => {
    if (disabled) return;
    const index = selected.lastIndexOf(cardId);
    if (index < 0) return;
    onChange(selected.filter((_, current) => current !== index));
  };

  const dropCard = (cardId: number) => {
    if (disabled) return;
    onChange(removeAllOfId(selected, cardId));
  };

  const changeFilter = (apply: () => void) => {
    apply();
    setPage(0);
  };

  const pickOne = (kind: "cheap" | "expensive" | "cheap-excess") => {
    if (disabled) return;
    const id = pickSingleId(bulkRows, kind);
    if (id != null) onChange([id]);
  };

  if (!rows.length) {
    return <p className="stake-empty">{emptyHint}</p>;
  }

  return (
    <div className="stake-picker" ref={boxRef}>
      <div className={`stake-toolbar${filtersOpen ? " is-expanded" : ""}`}>
        <button className="stake-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Filter{rarity !== "all" || dupesOnly || singlesOnly ? " · aktiv" : ""} {filtersOpen ? "−" : "+"}</button>
        <input
          className="stake-search"
          type="search"
          placeholder="Charakter, Set, Rarity…"
          value={query}
          onChange={(event) => changeFilter(() => setQuery(event.target.value))}
        />
        <label>
          <span>SORT</span>
          <select value={sort} onChange={(event) => changeFilter(() => setSort(event.target.value as SortKey))}>
            <option value="value-desc">Preis ↓</option>
            <option value="value-asc">Preis ↑</option>
            <option value="name">Name</option>
            <option value="rarity">Rarity</option>
          </select>
        </label>
        <label>
          <span>RARITY</span>
          <select value={rarity} onChange={(event) => changeFilter(() => setRarity(event.target.value))}>
            <option value="all">Alle</option>
            {rarities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="stake-check">
          <input type="checkbox" checked={dupesOnly} onChange={(event) => changeFilter(() => { setDupesOnly(event.target.checked); if (event.target.checked) setSinglesOnly(false); })} />
          Nur Doppelte
        </label>
        <label className="stake-check">
          <input type="checkbox" checked={singlesOnly} onChange={(event) => changeFilter(() => { setSinglesOnly(event.target.checked); if (event.target.checked) setDupesOnly(false); })} />
          Nur Uniques
        </label>
        {multi && (
          <label className="stake-check">
            <input type="checkbox" checked={selectedOnly} onChange={(event) => changeFilter(() => setSelectedOnly(event.target.checked))} />
            Nur Auswahl
          </label>
        )}
      </div>
      {!multi && (
        <div className="bulk-quick">
          <button type="button" disabled={disabled} onClick={() => pickOne("cheap")}>Günstigste</button>
          <button type="button" disabled={disabled} onClick={() => pickOne("expensive")}>Teuerste</button>
          <button type="button" disabled={disabled} onClick={() => pickOne("cheap-excess")}>Günstigstes Double</button>
        </div>
      )}
      {multi && (
        <CardBulkBar
          rows={bulkRows}
          fullRows={allBulkRows}
          selected={selected}
          onChange={onChange}
          max={max}
          disabled={disabled}
          applyLabel="Setzen"
          defaultOpen={false}
        />
      )}
      {selected.length > 0 && (
        <p className="stake-summary">{selected.length} gesetzt · {formatYuan(selectedValue)} ¥</p>
      )}
      {visible.length === 0 ? (
        <p className="stake-empty">Keine Karten für diesen Filter.</p>
      ) : (
        <ul className="stake-grid">
          {visible.map(({ card, count, valueFen }) => {
            const used = selectedCount(selected, card.id);
            const lastCopy = used > 0 && used >= count;
            return (
              <li key={card.id} className={used ? "is-selected" : ""} style={{ "--card-color": rarityColor(card.rarity) } as CSSProperties}>
                <button type="button" disabled={disabled} onClick={() => toggleCard(card.id, count)}>
                  <img src={cardAsset(card.image_path)} alt="" />
                  <b style={{ color: rarityColor(card.rarity) }}>{card.rarity}</b>
                  <strong>{card.character || "Unknown"}</strong>
                  <small>{card.set_name} · ×{count}</small>
                  <em>{formatYuan(valueFen)} ¥</em>
                </button>
                {used > 0 && (
                  <div className="stake-qty">
                    <span>{used}/{count}{lastCopy ? " · letzte Kopie" : ""}</span>
                    <button type="button" disabled={disabled} onClick={() => remove(card.id)} aria-label={`${card.character} eine Kopie weniger`}>−</button>
                    <button type="button" disabled={disabled || used >= count} onClick={() => add(card.id, count)} aria-label={`${card.character} eine Kopie mehr`}>+</button>
                    <button type="button" disabled={disabled} onClick={() => dropCard(card.id)} aria-label={`${card.character} aus der Auswahl nehmen`}>×</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="stake-pager">
        <button type="button" disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}>←</button>
        <span>Seite {safePage + 1} / {pageCount} · {filtered.length} Karten</span>
        <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>→</button>
      </div>
    </div>
  );
}
