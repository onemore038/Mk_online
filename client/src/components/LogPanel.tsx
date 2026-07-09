import type { GameEvent } from "@mk-online/shared";

export function LogPanel({ log }: { log: readonly GameEvent[] }) {
  const recent = log.slice(-40);
  return (
    <div className="log-panel">
      {[...recent].reverse().map((e, i) => (
        <div key={i}>
          [T{e.turn}] {e.playerId ? `${e.playerId}: ` : ""}
          {e.detail}
        </div>
      ))}
    </div>
  );
}
