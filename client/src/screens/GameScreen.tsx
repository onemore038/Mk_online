import { useEffect, useState } from "react";
import { POWER_TYPES, type ActionRequest, type GameState, type PowerType } from "@mk-online/shared";
import { DiceRow } from "../components/DiceRow";
import { CardTile } from "../components/CardTile";
import { PlayerSummary } from "../components/PlayerSummary";
import { LogPanel } from "../components/LogPanel";

interface Props {
  game: GameState;
  myPlayerId: string;
  sendAction: (action: ActionRequest) => void;
}

function groupStacks(cardIds: readonly string[]): { cardId: string; count: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const id of cardIds) {
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return order.map((cardId) => ({ cardId, count: counts.get(cardId)! }));
}

export function GameScreen({ game, myPlayerId, sendAction }: Props) {
  const [selectedDie, setSelectedDie] = useState<number | null>(null);
  const [discardSelection, setDiscardSelection] = useState<string[]>([]);

  useEffect(() => {
    setSelectedDie(null);
  }, [game.dice]);

  const me = game.players[myPlayerId];
  const isMyTurn = game.playerOrder[game.currentPlayerIndex] === myPlayerId;

  if (game.phase === "gameOver") {
    return (
      <div className="panel">
        <h2>ゲーム終了</h2>
        <p>
          勝者:{" "}
          {game.winnerIds?.map((id) => game.players[id]?.nickname).join(", ") ?? "-"}
        </p>
        <PlayerSummary game={game} myPlayerId={myPlayerId} />
      </div>
    );
  }

  if (game.phase === "draft") {
    const draft = game.draft!;
    const myPacket = draft.packets[myPlayerId] ?? [];
    const waiting = !draft.pendingPicks.includes(myPlayerId);
    return (
      <div className="col">
        <div className="panel">
          <h2>ドラフト（ラウンド {draft.round + 1} / 3）</h2>
          <p className="hint">
            手元のカードから1枚キープしてください。残りは隣のプレイヤーへ渡ります。
          </p>
          {waiting ? (
            <p className="hint">他のプレイヤーの選択を待っています…</p>
          ) : (
            <div className="grid cards">
              {myPacket.map((cardId, i) => (
                <CardTile key={`${cardId}-${i}`} cardId={cardId} onClick={() => sendAction({ type: "DRAFT_PICK", cardId })} />
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <h2>プレイヤー</h2>
          <PlayerSummary game={game} myPlayerId={myPlayerId} />
        </div>
      </div>
    );
  }

  if (!me) return <p>プレイヤー情報を取得できません</p>;

  if (game.phase === "turnStart") {
    return (
      <div className="col">
        <div className="panel">
          <h2>ターン {game.turnNumber}</h2>
          {isMyTurn ? (
            <button className="btn primary" onClick={() => sendAction({ type: "RESOLVE_TURN_START" })}>
              ターン開始（ダイスを振る）
            </button>
          ) : (
            <p className="hint">
              {game.players[game.playerOrder[game.currentPlayerIndex]!]?.nickname} さんのターン開始を待っています…
            </p>
          )}
        </div>
        <div className="panel">
          <h2>プレイヤー</h2>
          <PlayerSummary game={game} myPlayerId={myPlayerId} />
        </div>
      </div>
    );
  }

  // phase === "turnActions"
  const overHandLimit = me.hand.length > me.handLimit;
  const marketStacks = groupStacks(game.openMarket);

  function toggleDiscard(cardId: string, idx: number) {
    const key = `${cardId}-${idx}`;
    setDiscardSelection((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function convertPower(from: PowerType, to: PowerType) {
    if (from === to) return;
    sendAction({ type: "CONVERT_POWER", from, to });
  }

  return (
    <div className="col">
      <div className="panel">
        <h2>ターン {game.turnNumber}{isMyTurn ? "（あなたの番）" : ""}</h2>
        <PlayerSummary game={game} myPlayerId={myPlayerId} />
      </div>

      <div className="panel">
        <h2>ダイス</h2>
        <DiceRow dice={game.dice} selectedIndex={selectedDie} selectable={isMyTurn} onSelect={setSelectedDie} />
        {isMyTurn && (
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn"
              disabled={selectedDie === null}
              onClick={() => {
                if (selectedDie === null) return;
                sendAction({ type: "GAIN_POWER", source: { kind: "die", dieIndex: selectedDie } });
              }}
            >
              選択したダイスでパワー獲得
            </button>
            <button
              className="btn"
              disabled={selectedDie === null}
              onClick={() => {
                if (selectedDie === null) return;
                sendAction({ type: "ACQUIRE_CARD", source: "deck", dieIndex: selectedDie });
              }}
            >
              選択したダイスで山札から1枚獲得
            </button>
            <span className="hint">
              {me.diceBreadCards > 0 ? `サイコロパン ${me.diceBreadCards}枚` : "サイコロパンなし"}
            </span>
            {POWER_TYPES.map((t) => (
              <button
                key={t}
                className="btn"
                disabled={me.diceBreadCards <= 0}
                onClick={() => sendAction({ type: "GAIN_POWER", source: { kind: "diceBread", powerType: t } })}
              >
                パンで{t}獲得
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>パワー変換（同種2個 → 異種1個）</h2>
        <div className="row">
          {POWER_TYPES.flatMap((from) =>
            POWER_TYPES.filter((to) => to !== from).map((to) => (
              <button
                key={`${from}-${to}`}
                className="btn"
                disabled={!isMyTurn || me.power[from] < 2}
                onClick={() => convertPower(from, to)}
              >
                {from}→{to}
              </button>
            )),
          )}
        </div>
      </div>

      <div className="panel">
        <h2>オープンマーケット</h2>
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn" disabled={!isMyTurn} onClick={() => sendAction({ type: "REFRESH_MARKET" })}>
            場を入れ替える（お金・権力・魔力を1個ずつ消費）
          </button>
        </div>
        <div className="grid cards">
          {marketStacks.map(({ cardId, count }) => (
            <CardTile
              key={cardId}
              cardId={cardId}
              count={count}
              disabled={!isMyTurn || selectedDie === null}
              onClick={() => {
                if (selectedDie === null) return;
                sendAction({ type: "ACQUIRE_CARD", source: "openMarket", cardId, dieIndex: selectedDie });
              }}
            />
          ))}
        </div>
        {isMyTurn && selectedDie === null && <p className="hint">カードを獲得するには先にダイスを選択してください</p>}
      </div>

      <div className="panel">
        <h2>レジェンドカード</h2>
        <p className="hint">
          {game.legendPlacedThisTurn ? "このターンは既にレジェンドカードを設置済みです" : "1ターンに1枚まで設置できます"}
        </p>
        <h3 className="hint">Ⅰ</h3>
        <div className="grid cards">
          {game.legend1Row.map((cardId) => (
            <CardTile
              key={cardId}
              cardId={cardId}
              disabled={!isMyTurn || game.legendPlacedThisTurn}
              onClick={() => sendAction({ type: "PLACE_LEGEND_CARD", cardId, row: "legend1", dieIndices: [] })}
            />
          ))}
        </div>
        <h3 className="hint" style={{ marginTop: 10 }}>Ⅱ</h3>
        <div className="grid cards">
          {game.legend2Row.map((cardId) => (
            <CardTile
              key={cardId}
              cardId={cardId}
              disabled={!isMyTurn || game.legendPlacedThisTurn}
              onClick={() => sendAction({ type: "PLACE_LEGEND_CARD", cardId, row: "legend2", dieIndices: [] })}
            />
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>
          手札（{me.hand.length}/{me.handLimit}）
        </h2>
        {overHandLimit && (
          <div className="panel" style={{ borderColor: "var(--danger)" }}>
            <p className="hint">
              手札が上限を超えています。{me.hand.length - me.handLimit}枚選んで捨ててください（選択中: {discardSelection.length}枚）
            </p>
            <div className="grid cards">
              {me.hand.map((cardId, idx) => {
                const key = `${cardId}-${idx}`;
                return (
                  <CardTile
                    key={key}
                    cardId={cardId}
                    selected={discardSelection.includes(key)}
                    onClick={() => toggleDiscard(cardId, idx)}
                  />
                );
              })}
            </div>
            <button
              className="btn danger"
              disabled={discardSelection.length !== me.hand.length - me.handLimit}
              onClick={() => {
                const ids = discardSelection.map((k) => k.slice(0, k.lastIndexOf("-")));
                sendAction({ type: "DISCARD_TO_HAND_LIMIT", cardIds: ids });
                setDiscardSelection([]);
              }}
            >
              選択したカードを捨てる
            </button>
          </div>
        )}
        {!overHandLimit && (
          <div className="grid cards">
            {me.hand.map((cardId, idx) => (
              <CardTile
                key={`${cardId}-${idx}`}
                cardId={cardId}
                disabled={!isMyTurn}
                onClick={() => sendAction({ type: "INSTALL_CARD", cardId, dieIndices: [] })}
              />
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>設置済みカード</h2>
        <div className="grid cards">
          {me.installed.map((c) => (
            <CardTile
              key={c.instanceId}
              cardId={c.cardId}
              disabled={!isMyTurn || c.installedThisTurn || c.usedThisTurn}
              extra={c.installedThisTurn ? "設置直後（使用不可）" : c.usedThisTurn ? "使用済み" : undefined}
              onClick={() => sendAction({ type: "USE_INSTALLED_CARD", instanceId: c.instanceId })}
            />
          ))}
        </div>
      </div>

      <div className="panel">
        <button className="btn primary" disabled={!isMyTurn} onClick={() => sendAction({ type: "END_TURN" })}>
          ターン終了
        </button>
      </div>

      <div className="panel">
        <h2>ログ</h2>
        <LogPanel log={game.log} />
      </div>
    </div>
  );
}
