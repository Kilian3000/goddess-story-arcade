import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  table?: ReactNode;
  stake?: ReactNode;
  stakeLabel?: string;
};

export function GameFrame({ eyebrow, title, children, table, stake, stakeLabel = "Einsatz wählen" }: Props) {
  return (
    <section className={`minigame-panel${table || stake ? " has-card-table" : ""}`}>
      <header className="minigame-panel-head">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </header>
      {children}
      {table ? <div className="card-table">{table}</div> : null}
      {stake ? (
        <div className="card-table-stake">
          <header className="card-table-stake-head">
            <span>KARTEN</span>
            <b>{stakeLabel}</b>
          </header>
          {stake}
        </div>
      ) : null}
    </section>
  );
}
