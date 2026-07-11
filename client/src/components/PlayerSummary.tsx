import { useEffect, useRef, useState } from "react";
import { CHARACTERS, POWER_TYPES, type GameState, type PowerType } from "@mk-online/shared";

interface Props {
  game: GameState;
  myPlayerId: string;
}

/** 値が増加した直後、一定時間 true を返す（パワー/VP獲得時のパルス演出用）。 */
function usePulseOnIncrease(value: number): boolean {
  const prev = useRef(value);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (value > prev.current) {
      setPulsing(true);
      const timer = setTimeout(() => setPulsing(false), 700);
      prev.current = value;
      return () => clearTimeout(timer);
    }
    prev.current = value;
    return undefined;
  }, [value]);

  return pulsing;
}

export function PowerBadge({ type, value, mini }: { type: PowerType; value: number; mini?: boolean }) {
  const pulsing = usePulseOnIncrease(value);
  return <span className={`power-badge ${type}${mini ? " mini" : ""}${pulsing ? " pulse" : ""}`}>{value}</span>;
}

export function VpValue({ value }: { value: number }) {
  const pulsing = usePulseOnIncrease(value);
  return <span className={`vp${pulsing ? " pulse" : ""}`}>{value}VP</span>;
}

export function PlayerSummary({ game, myPlayerId }: Props) {
  const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
  return (
    <div className="col">
      {game.playerOrder.map((id) => {
        const p = game.players[id]!;
        const character = CHARACTERS.find((c) => c.id === p.characterId);
        return (
          <div className={`player-strip ${id === currentPlayerId ? "current" : ""}`} key={id}>
            <span>
              {id === currentPlayerId ? "▶ " : ""}
              {p.nickname}
              {id === myPlayerId ? "（あなた）" : ""}
              {!p.connected ? "（切断中）" : ""}
              <span className="hint"> — {character?.name ?? p.characterId}</span>
            </span>
            <span className="row">
              {POWER_TYPES.map((t) => (
                <PowerBadge key={t} type={t} value={p.power[t]} />
              ))}
              <span className="hint">手札{p.hand.length}</span>
              <span className="hint">設置{p.installed.length}</span>
              <VpValue value={p.victoryPoints} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
