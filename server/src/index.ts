import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { Server, type Socket } from "socket.io";
import {
  applyAction,
  getPlayerView,
  setupGame,
  type ClientToServerEvents,
  type GameAction,
  type LobbyState,
  type ServerToClientEvents,
} from "@mk-online/shared";
import { addPlayer, createRoom, getRoom, pruneStaleRooms, touchRoom, type Room } from "./roomStore.js";

const PORT = Number(process.env.PORT ?? 3001);
// クライアントを別ホストから配信する場合のみ必要（例: 開発時の localhost:5173）。
// サーバーが client/dist を同梱配信する場合（後述）は同一オリジンになるため実質不要。
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const dirname = path.dirname(fileURLToPath(import.meta.url));
// server と client を1プロセス・1ポートにまとめて配信する。
// トンネル（cloudflared/ngrok等）やPaaSへのデプロイをサーバー1つ分で済ませるための構成。
const clientDistPath = path.resolve(dirname, "../../client/dist");
const serveClient = existsSync(clientDistPath);

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.get("/health", (_req, res) => res.json({ ok: true }));

if (serveClient) {
  app.use(express.static(clientDistPath));
  app.get("/", (_req, res) => res.sendFile(path.join(clientDistPath, "index.html")));
} else {
  console.log(
    "client/dist が見つからないため静的配信はスキップします（`npm run build --workspace client` でビルドすると同梱配信されます）",
  );
}

const httpServer = createServer(app);

interface SocketData {
  roomId?: string;
  playerId?: string;
}

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  { cors: { origin: CORS_ORIGIN } },
);

function toLobbyState(room: Room): LobbyState {
  return {
    roomId: room.roomId,
    started: room.game !== null,
    players: room.players.map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      characterId: p.characterId,
      initialPower: p.initialPower,
      isHost: p.isHost,
      connected: p.socketId !== null,
    })),
  };
}

function broadcastLobby(room: Room): void {
  io.to(room.roomId).emit("lobby:update", toLobbyState(room));
}

/**
 * ゲーム状態を各プレイヤーへ個別に送る。手札・ドラフトパケット・山札の中身は
 * getPlayerView でプレイヤーごとに伏せてから送るため、ルーム全体への一斉送信はしない。
 */
function broadcastGameState(room: Room): void {
  if (!room.game) return;
  for (const player of room.players) {
    if (!player.socketId) continue;
    io.to(player.socketId).emit("game:update", getPlayerView(room.game, player.playerId));
  }
}

function getRoomAndPlayer(socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>) {
  const roomId = socket.data.roomId;
  const playerId = socket.data.playerId;
  if (!roomId || !playerId) return { room: undefined, player: undefined };
  const room = getRoom(roomId);
  const player = room?.players.find((p) => p.playerId === playerId);
  return { room, player };
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ nickname }, ack) => {
    const room = createRoom();
    const player = addPlayer(room, nickname);
    player.socketId = socket.id;
    socket.data.roomId = room.roomId;
    socket.data.playerId = player.playerId;
    socket.join(room.roomId);
    ack({ roomId: room.roomId, playerId: player.playerId });
    broadcastLobby(room);
  });

  socket.on("room:join", ({ roomId, nickname }, ack) => {
    const room = getRoom(roomId.toUpperCase());
    if (!room) return ack({ ok: false, error: "部屋が見つかりません" });
    if (room.game) return ack({ ok: false, error: "既にゲームが開始されています" });
    try {
      const player = addPlayer(room, nickname);
      player.socketId = socket.id;
      socket.data.roomId = room.roomId;
      socket.data.playerId = player.playerId;
      socket.join(room.roomId);
      ack({ ok: true, playerId: player.playerId });
      broadcastLobby(room);
    } catch (e) {
      ack({ ok: false, error: (e as Error).message });
    }
  });

  socket.on("room:rejoin", ({ roomId, playerId }, ack) => {
    const room = getRoom(roomId.toUpperCase());
    if (!room) return ack({ ok: false, error: "部屋が見つかりません" });
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player) return ack({ ok: false, error: "プレイヤーが見つかりません" });
    player.socketId = socket.id;
    socket.data.roomId = room.roomId;
    socket.data.playerId = player.playerId;
    socket.join(room.roomId);
    touchRoom(room);
    if (room.game?.players[playerId]) {
      room.game.players[playerId]!.connected = true;
    }
    ack({ ok: true, playerId });
    if (room.game) socket.emit("game:update", getPlayerView(room.game, playerId));
    else broadcastLobby(room);
  });

  socket.on("lobby:selectCharacter", ({ characterId }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player || room.game) return;
    player.characterId = characterId;
    touchRoom(room);
    broadcastLobby(room);
  });

  socket.on("lobby:setInitialPower", ({ power }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player || room.game) return;
    player.initialPower = power;
    touchRoom(room);
    broadcastLobby(room);
  });

  socket.on("lobby:start", (ack) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return ack({ ok: false, error: "不明なプレイヤーです" });
    if (!player.isHost) return ack({ ok: false, error: "ホストのみ開始できます" });
    if (room.players.length < 2) return ack({ ok: false, error: "2人以上集まってから開始してください" });
    const missing = room.players.find((p) => !p.characterId || !p.initialPower);
    if (missing) {
      return ack({
        ok: false,
        error: `${missing.nickname} がキャラクター選択／初期パワー設定を完了していません`,
      });
    }
    try {
      const game = setupGame({
        roomId: room.roomId,
        players: room.players.map((p) => ({
          playerId: p.playerId,
          nickname: p.nickname,
          characterId: p.characterId!,
          initialPower: p.initialPower!,
        })),
        rng: room.rng,
      });
      room.game = game;
      touchRoom(room);
      ack({ ok: true });
      broadcastGameState(room);
    } catch (e) {
      ack({ ok: false, error: (e as Error).message });
    }
  });

  socket.on("game:action", (payload, ack) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player || !room.game) {
      return ack({ ok: false, error: "ゲームが開始されていません", code: "NO_GAME" });
    }
    // playerId はクライアントの自己申告を信用せず、サーバー側で認証済みの値に差し替える
    const action = { ...payload, playerId: player.playerId } as GameAction;
    const result = applyAction(room.game, action, room.rng);
    if (!result.ok) {
      ack({ ok: false, error: result.error.message, code: result.error.code });
      return;
    }
    room.game = result.value;
    touchRoom(room);
    ack({ ok: true });
    broadcastGameState(room);
  });

  socket.on("disconnect", () => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    player.socketId = null;
    if (room.game?.players[player.playerId]) {
      room.game.players[player.playerId]!.connected = false;
    }
    if (room.game) broadcastGameState(room);
    else broadcastLobby(room);
  });
});

setInterval(pruneStaleRooms, 30 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  console.log(`MK Online サーバー起動: http://localhost:${PORT}`);
});
