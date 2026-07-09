import { useState } from "react";

interface Props {
  createRoom: (nickname: string) => void;
  joinRoom: (roomId: string, nickname: string) => void;
}

export function HomeScreen({ createRoom, joinRoom }: Props) {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");

  return (
    <div className="col" style={{ maxWidth: 420 }}>
      <div className="panel">
        <h2>ニックネーム</h2>
        <input
          type="text"
          placeholder="表示名を入力"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      <div className="panel">
        <h2>部屋を作る</h2>
        <p className="hint">新しい部屋を作り、コードを他のプレイヤーに共有します。</p>
        <button
          className="btn primary"
          disabled={!nickname.trim()}
          onClick={() => createRoom(nickname)}
        >
          部屋を作成
        </button>
      </div>

      <div className="panel">
        <h2>部屋に参加する</h2>
        <div className="row">
          <input
            type="text"
            placeholder="部屋コード（6文字）"
            value={roomCode}
            maxLength={6}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          />
          <button
            className="btn primary"
            disabled={!nickname.trim() || roomCode.length !== 6}
            onClick={() => joinRoom(roomCode, nickname)}
          >
            参加
          </button>
        </div>
      </div>
    </div>
  );
}
