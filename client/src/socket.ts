import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@mk-online/shared";

// 明示指定が無い場合：開発時（別ポートの vite dev server）は localhost:3001 を既定にし、
// 本番ビルド（サーバーが client/dist を同梱配信する構成）ではページと同一オリジンに接続する。
const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? (import.meta.env.DEV ? "http://localhost:3001" : undefined);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: true,
});
