import { CHARACTERS, POWER_TYPES, type GameState } from "@mk-online/shared";

interface Props {
  game: GameState;
  myPlayerId: string;
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
                <span key={t} className={`power-badge ${t}`}>
                  {p.power[t]}
                </span>
              ))}
              <span className="hint">手札{p.hand.length}</span>
              <span className="hint">設置{p.installed.length}</span>
              <span className="vp">{p.victoryPoints}VP</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
