import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
};

export function GameFrame({ eyebrow, title, children }: Props) {
  return (
    <section className="minigame-panel">
      <header className="minigame-panel-head">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </header>
      {children}
    </section>
  );
}
