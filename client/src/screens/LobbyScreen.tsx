import { useEffect, useState } from "react";
import { CHARACTERS, POWER_TYPES, type LobbyState, type PowerPool, type PowerType } from "@mk-online/shared";

interface Props {
  roomId: string;
  playerId: string;
  lobby: LobbyState | null;
  selectCharacter: (characterId: string) => void;
  setInitialPower: (power: PowerPool) => void;
  startGame: () => void;
}

const POWER_LABEL: Record<PowerType, string> = { money: "お金", authority: "権力", magic: "魔力" };

export function LobbyScreen({ roomId, playerId, lobby, selectCharacter, setInitialPower, startGame }: Props) {
  const [power, setPower] = useState<PowerPool>({ money: 4, authority: 0, magic: 0 });

  useEffect(() => {
    setInitialPower(power);
    // マウント時に一度だけ初期値をサーバーへ送る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = lobby?.players.find((p) => p.playerId === playerId);
  const takenCharacterIds = new Set(
    lobby?.players.filter((p) => p.characterId && p.playerId !== playerId).map((p) => p.characterId),
  );

  function transferTo(target: PowerType) {
    const donor = POWER_TYPES.filter((t) => t !== target).sort((a, b) => power[b] - power[a])[0]!;
    if (power[donor] <= 0) return;
    const next = { ...power, [donor]: power[donor] - 1, [target]: power[target] + 1 };
    setPower(next);
    setInitialPower(next);
  }

  const canStart = !!me?.isHost && (lobby?.players.length ?? 0) >= 2 && (lobby?.players.every((p) => p.characterId) ?? false);

  return (
    <div className="col">
      <div className="panel">
        <h2>部屋 {roomId} — ロビー</h2>
        {lobby?.players.map((p) => (
          <div className={`player-strip ${p.playerId === playerId ? "current" : ""}`} key={p.playerId}>
            <span>
              {p.isHost ? "👑 " : ""}
              {p.nickname}
              {!p.connected ? "（切断中）" : ""}
            </span>
            <span className="hint">
              {p.characterId ? CHARACTERS.find((c) => c.id === p.characterId)?.name : "未選択"}
            </span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>キャラクター選択</h2>
        <div className="grid cards">
          {CHARACTERS.map((c) => {
            const takenByOther = takenCharacterIds.has(c.id);
            const isMine = me?.characterId === c.id;
            return (
              <button
                key={c.id}
                className={`card ${isMine ? "selected" : ""} ${takenByOther ? "disabled" : ""}`}
                disabled={takenByOther}
                onClick={() => selectCharacter(c.id)}
              >
                <div className="name">{c.name}</div>
                <div className="meta">{c.abilitySummary}</div>
                <div className="meta">ダイス{c.diceCount}個</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2>初期パワー（合計4個を自由配分）</h2>
        <div className="power-picker">
          {POWER_TYPES.map((t) => (
            <div className="stepper" key={t}>
              <span className={`power-badge ${t}`}>
                {POWER_LABEL[t]} {power[t]}
              </span>
              <button className="btn" onClick={() => transferTo(t)}>
                +1
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>開始</h2>
        {me?.isHost ? (
          <>
            <p className="hint">2人以上・全員がキャラクターを選択したら開始できます（人数が定員4人に満たなくてもOK）。</p>
            <button className="btn primary" disabled={!canStart} onClick={startGame}>
              ゲーム開始
            </button>
          </>
        ) : (
          <p className="hint">ホストの開始を待っています…</p>
        )}
      </div>
    </div>
  );
}
