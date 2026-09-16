"use client";

import { useMemo } from "react";
import { CardBulkBar } from "./card-bulk-bar";
import { selectionValueFen, type BulkRow } from "./card-bulk-select";
import type { Card } from "./card-types";
import { formatYuan } from "./economy";
import type { RevealMark } from "./pack-draw";

type Props = {
  pack: Card[];
  soldIndexes: Set<number>;
  pullMarks: RevealMark[];
  valueFen: (cardId: number, rarity: string) => number;
  selected: number[];
  onChange: (indexes: number[]) => void;
  onSellIndexes: (indexes: number[]) => void;
};

function slotRow(card: Card, index: number, mark: RevealMark | undefined, value: number): BulkRow {
  const copies = mark?.copies || 1;
  return {
    id: index,
    rarity: card.rarity,
    setName: card.set_name,
    character: card.character || "Unknown",
    count: 1,
    valueFen: value,
    excessEligible: !mark?.isNew || copies > 1,
  };
}

export function PackSummaryBulk({ pack, soldIndexes, pullMarks, valueFen, selected, onChange, onSellIndexes }: Props) {
  const rows = useMemo(
    () => pack.flatMap((card, index) => (
      soldIndexes.has(index) ? [] : [slotRow(card, index, pullMarks[index], valueFen(card.id, card.rarity))]
    )),
    [pack, pullMarks, soldIndexes, valueFen],
  );
  const pickedValue = selectionValueFen(rows, selected);

  const sellPicked = () => {
    if (!selected.length) return;
    onSellIndexes(selected);
    onChange([]);
  };

  const sellR = () => {
    const indexes = rows.filter((row) => row.rarity === "R").map((row) => row.id);
    if (indexes.length) onSellIndexes(indexes);
  };

  return (
    <div className="summary-extra-actions">
      <CardBulkBar
        rows={rows}
        selected={selected}
        onChange={onChange}
        applyLabel="Markieren"
        defaultOpen={false}
      />
      <div className="bulk-actions">
        <button type="button" className="junk-sell" disabled={!selected.length} onClick={sellPicked}>
          Auswahl verkaufen{selected.length ? ` · ${selected.length} · ${formatYuan(pickedValue)} ¥` : ""}
        </button>
        <button type="button" className="junk-sell" disabled={!rows.some((row) => row.rarity === "R")} onClick={sellR}>
          Alle R verkaufen
        </button>
      </div>
    </div>
  );
}
