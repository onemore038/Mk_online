import { useConnection } from "./hooks/useConnection";
import { HomeScreen } from "./screens/HomeScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { GameScreen } from "./screens/GameScreen";

export default function App() {
  const conn = useConnection();

  let body: JSX.Element;
  if (!conn.roomId || !conn.playerId) {
    body = <HomeScreen createRoom={conn.createRoom} joinRoom={conn.joinRoom} />;
  } else if (!conn.game) {
    body = (
      <LobbyScreen
        roomId={conn.roomId}
        playerId={conn.playerId}
        lobby={conn.lobby}
        selectCharacter={conn.selectCharacter}
        setInitialPower={conn.setInitialPower}
        startGame={conn.startGame}
      />
    );
  } else {
    body = <GameScreen game={conn.game} myPlayerId={conn.playerId} sendAction={conn.sendAction} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>MK Online — 某魔法王国ボードゲーム シミュレータ</h1>
        <div className="row">
          {conn.roomId && (
            <span className="hint">
              部屋コード: <strong>{conn.roomId}</strong>
            </span>
          )}
          <span>
            <span className={`status-dot ${conn.connected ? "on" : "off"}`} />
            {conn.connected ? "接続中" : "切断"}
          </span>
          {conn.roomId && (
            <button className="btn" onClick={conn.leaveRoom}>
              退室
            </button>
          )}
        </div>
      </header>
      <main className="main">{body}</main>
      {conn.error && (
        <div className="error-toast" onClick={conn.clearError} role="alert">
          {conn.error}
          <div className="hint" style={{ marginTop: 6 }}>
            （クリックで閉じる）
          </div>
        </div>
      )}
    </div>
  );
}
