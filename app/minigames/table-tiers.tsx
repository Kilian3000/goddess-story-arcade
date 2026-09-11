"use client";

import { formatYuan } from "../economy";
import { JACKPOT_TIERS, type JackpotTierId } from "./odds";

type Props = {
  value: JackpotTierId;
  onChange: (id: JackpotTierId) => void;
  disabled?: boolean;
  playUiTap?: () => Promise<void>;
  label?: string;
};

export function TableTiers({ value, onChange, disabled, playUiTap, label = "Tischklasse" }: Props) {
  return (
    <div className="jackpot-tiers" role="group" aria-label={label}>
      <label className="mobile-table-tier"><span>{label}</span><select value={value} disabled={disabled} onChange={event => { void playUiTap?.(); onChange(event.target.value as JackpotTierId); }}>{JACKPOT_TIERS.map(item => <option key={item.id} value={item.id}>{item.title} · {formatYuan(item.botMinFen)}–{formatYuan(item.botMaxFen)} ¥</option>)}</select></label>
      {JACKPOT_TIERS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={value === item.id ? "is-active" : ""}
          disabled={disabled}
          onClick={() => {
            void playUiTap?.();
            onChange(item.id);
          }}
        >
          <small>{item.title}</small>
          <b>{formatYuan(item.botMinFen)}–{formatYuan(item.botMaxFen)} ¥</b>
          <span>{item.blurb}</span>
        </button>
      ))}
    </div>
  );
}
