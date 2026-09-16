type Props = {
  tone: "win" | "loss" | "info";
  title: string;
  detail?: string;
};

export function GameResult({ tone, title, detail }: Props) {
  return (
    <p className={`game-result is-${tone}`} role="status">
      <b>{title}</b>
      {detail ? <span>{detail}</span> : null}
    </p>
  );
}
