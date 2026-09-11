import { yuanToFen } from "../economy";

export const YUAN_CHIPS = [1, 2, 5, 10] as const;

type Props = {
  valueYuan: number;
  onChange: (yuan: number) => void;
  balanceFen: number;
  disabled?: boolean;
};

export function YuanStake({ valueYuan, onChange, balanceFen, disabled }: Props) {
  return (
    <div className="yuan-stake" role="group" aria-label="Yuan-Einsatz">
      {YUAN_CHIPS.map((yuan) => (
        <button
          key={yuan}
          type="button"
          className={valueYuan === yuan ? "is-active" : ""}
          disabled={disabled || balanceFen < yuanToFen(yuan)}
          onClick={() => onChange(yuan)}
        >
          {yuan} ¥
        </button>
      ))}
    </div>
  );
}
