"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_BULK_QUERY,
  VALUE_RANGE_PRESETS,
  applyBulkSelection,
  collectAllExceptHighest,
  collectAllIds,
  collectBulkIds,
  dropHighestValue,
  matchingValuePreset,
  parseYuanInput,
  selectionValueFen,
  uniqueSorted,
  withRarity,
  withValuePreset,
  yuanBoundsToFen,
  type BulkApplyOptions,
  type BulkQuery,
  type BulkRow,
  type BulkSort,
} from "./card-bulk-select";
import { formatYuan } from "./economy";

type Props = {
  rows: BulkRow[];
  fullRows?: BulkRow[];
  selected: number[];
  onChange: (ids: number[]) => void;
  max?: number;
  disabled?: boolean;
  applyLabel?: string;
  defaultOpen?: boolean;
};

const COPY_OPTIONS = [
  { value: 1, label: "ab 1 Kopie" },
  { value: 2, label: "ab 2 · Doubles" },
  { value: 3, label: "ab 3" },
  { value: 5, label: "ab 5" },
];

export function CardBulkBar({
  rows,
  fullRows,
  selected,
  onChange,
  max = Number.POSITIVE_INFINITY,
  disabled,
  applyLabel = "Auswählen",
  defaultOpen = true,
}: Props) {
  const [query, setQuery] = useState<BulkQuery>(DEFAULT_BULK_QUERY);
  const [add, setAdd] = useState(false);
  const [sort, setSort] = useState<BulkSort>("value-asc");
  const [minYuan, setMinYuan] = useState("");
  const [maxYuan, setMaxYuan] = useState("");

  const rarities = useMemo(() => uniqueSorted(rows.map((row) => row.rarity)), [rows]);
  const sets = useMemo(() => uniqueSorted(rows.map((row) => row.setName)), [rows]);
  const characters = useMemo(() => uniqueSorted(rows.map((row) => row.character)), [rows]);
  const options: BulkApplyOptions & { max?: number } = { add, sort, max };
  const hits = useMemo(() => collectBulkIds(rows, query, { max, sort }), [max, query, rows, sort]);
  const doubleHits = useMemo(() => collectAllIds(rows, "excess", { max, sort }), [max, rows, sort]);
  const allHits = useMemo(() => collectAllIds(rows, "all", { max, sort }), [max, rows, sort]);
  const exceptHits = useMemo(() => collectAllExceptHighest(rows, "excess", { max, sort }), [max, rows, sort]);
  const hitValue = selectionValueFen(rows, hits);
  const selectedValue = selectionValueFen(fullRows || rows, selected);
  const showFull = Boolean(fullRows && fullRows.length !== rows.length);
  const activePreset = matchingValuePreset(query);
  const finiteMax = Number.isFinite(max);
  const pool = fullRows || rows;

  const commit = (next: BulkQuery, nextPool = rows) => {
    setQuery(next);
    if (disabled) return;
    onChange(applyBulkSelection(selected, nextPool, next, options));
  };

  const applyCustomRange = (nextPool = rows) => {
    const bounds = yuanBoundsToFen(parseYuanInput(minYuan), parseYuanInput(maxYuan));
    commit({ ...query, minValueFen: bounds.minFen, maxValueFen: bounds.maxFen }, nextPool);
  };

  const pick = (ids: number[]) => {
    if (disabled || !ids.length) return;
    onChange(ids);
  };

  if (!rows.length && !selected.length) return null;

  return (
    <div className="bulk-bar">
      <div className="bulk-quick" role="group" aria-label="Schnellauswahl">
        <button type="button" className="bulk-apply" disabled={disabled || !doubleHits.length} onClick={() => pick(doubleHits)}>
          Alle Doubles{doubleHits.length ? ` · ${doubleHits.length}` : ""}
        </button>
        <button type="button" className="bulk-apply" disabled={disabled || !allHits.length} onClick={() => pick(allHits)}>
          Alles{allHits.length ? ` · ${allHits.length}` : ""}
        </button>
        <button type="button" disabled={disabled || exceptHits.length === 0} onClick={() => pick(exceptHits)}>
          Außer Teuerste
        </button>
        <button type="button" disabled={disabled || selected.length === 0} onClick={() => onChange(dropHighestValue(pool, selected))}>
          Teuerste weg
        </button>
        <button type="button" disabled={disabled || selected.length === 0} onClick={() => onChange([])}>
          Leeren
        </button>
      </div>

      <details className="bulk-filters" open={defaultOpen}>
        <summary>
          Filter & Masse
          <span>
            {selected.length
              ? `${selected.length} gesetzt · ${formatYuan(selectedValue)} ¥`
              : `${hits.length} Treffer · ${formatYuan(hitValue)} ¥`}
          </span>
        </summary>

        <p className="bulk-hint">
          {query.scope === "excess" ? "Filter gilt für Doubles — je eine Kopie bleibt." : "Filter nimmt alle Kopien, auch Uniques."}
          {finiteMax ? ` Max. ${max}.` : ""} Klick auf eine gesetzte Karte nimmt sie wieder raus.
        </p>

        <div className="bulk-scopes">
          <button type="button" className={query.scope === "excess" ? "is-active" : ""} disabled={disabled} onClick={() => setQuery({ ...query, scope: "excess" })}>
            Nur Doubles
          </button>
          <button type="button" className={query.scope === "all" ? "is-active" : ""} disabled={disabled} onClick={() => setQuery({ ...query, scope: "all" })}>
            Alle Kopien
          </button>
          <label>
            <span>Kopien</span>
            <select
              value={query.minCopies}
              disabled={disabled}
              onChange={(event) => setQuery({ ...query, minCopies: Number(event.target.value) })}
            >
              {COPY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="bulk-check">
            <input type="checkbox" checked={add} disabled={disabled} onChange={(event) => setAdd(event.target.checked)} />
            Dazu
          </label>
          <label>
            <span>Reihenfolge</span>
            <select value={sort} disabled={disabled} onChange={(event) => setSort(event.target.value as BulkSort)}>
              <option value="value-asc">Günstigste zuerst</option>
              <option value="value-desc">Teuerste zuerst</option>
              <option value="name">Name</option>
              <option value="rarity">Rarity</option>
            </select>
          </label>
        </div>

        {rarities.length > 0 && (
          <div className="bulk-chips" role="group" aria-label="Rarity">
            {rarities.map((rarity) => (
              <button
                key={rarity}
                type="button"
                className={query.rarities.includes(rarity) ? "is-active" : ""}
                disabled={disabled}
                onClick={() => commit(withRarity(query, rarity))}
              >
                {rarity}
              </button>
            ))}
          </div>
        )}

        <div className="bulk-selects">
          <label>
            <span>Collection / Set</span>
            <select
              value={query.setName || "all"}
              disabled={disabled}
              onChange={(event) => setQuery({ ...query, setName: event.target.value === "all" ? null : event.target.value })}
            >
              <option value="all">Alle Sets</option>
              {sets.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          {characters.length > 0 && characters.length <= 80 && (
            <label>
              <span>Charakter</span>
              <select
                value={query.character || "all"}
                disabled={disabled}
                onChange={(event) => setQuery({ ...query, character: event.target.value === "all" ? null : event.target.value })}
              >
                <option value="all">Alle Charaktere</option>
                {characters.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="bulk-chips" role="group" aria-label="Wert">
          {VALUE_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={activePreset === preset.id ? "is-active" : ""}
              disabled={disabled}
              onClick={() => commit(withValuePreset(query, preset.id))}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form
          className="bulk-range"
          onSubmit={(event) => {
            event.preventDefault();
            applyCustomRange();
          }}
        >
          <label>
            <span>Wert von</span>
            <input
              inputMode="decimal"
              placeholder="0,01"
              value={minYuan}
              disabled={disabled}
              onChange={(event) => setMinYuan(event.target.value)}
            />
          </label>
          <label>
            <span>bis</span>
            <input
              inputMode="decimal"
              placeholder="0,50"
              value={maxYuan}
              disabled={disabled}
              onChange={(event) => setMaxYuan(event.target.value)}
            />
          </label>
          <span className="bulk-range-unit">¥</span>
          <button type="submit" disabled={disabled}>Bereich</button>
        </form>

        <div className="bulk-actions">
          <button type="button" className="bulk-apply" disabled={disabled || !hits.length} onClick={() => commit(query)}>
            {applyLabel} · {hits.length}
          </button>
          {showFull && (
            <button type="button" disabled={disabled} onClick={() => commit(query, fullRows)}>
              Ganzen Bestand
            </button>
          )}
        </div>
      </details>
    </div>
  );
}
