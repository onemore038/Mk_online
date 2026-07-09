import type { GameAction } from "./actions.js";
import type { GameState, PowerPool } from "./types.js";

/** ロビー（ゲーム開始前）の1プレイヤー分の情報。 */
export interface LobbyPlayerInfo {
  readonly playerId: string;
  readonly nickname: string;
  readonly characterId: string | null;
  readonly initialPower: PowerPool | null;
  readonly isHost: boolean;
  readonly connected: boolean;
}

export interface LobbyState {
  readonly roomId: string;
  readonly players: readonly LobbyPlayerInfo[];
  readonly started: boolean;
}

/**
 * GameAction から playerId を除いた型（クライアントは自分の playerId を詐称できないよう、
 * サーバー側がソケットの認証情報から補完する）。
 * 通常の Omit はユニオン型に対して分配されず共通フィールドしか残らないため、
 * 分配版（Distributive Omit）で各アクション固有のフィールドを保持する。
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ActionRequest = DistributiveOmit<GameAction, "playerId">;

export interface ActionAck {
  readonly ok: boolean;
  readonly error?: string;
  readonly code?: string;
}

export interface CreateRoomAck {
  readonly roomId: string;
  readonly playerId: string;
}

export type JoinRoomAck = { readonly ok: true; readonly playerId: string } | { readonly ok: false; readonly error: string };

export interface ServerToClientEvents {
  "lobby:update": (lobby: LobbyState) => void;
  "game:update": (state: GameState) => void;
  "game:error": (payload: { message: string; code: string }) => void;
  "room:closed": (payload: { reason: string }) => void;
}

export interface ClientToServerEvents {
  "room:create": (
    payload: { nickname: string },
    ack: (res: CreateRoomAck) => void,
  ) => void;
  "room:join": (
    payload: { roomId: string; nickname: string },
    ack: (res: JoinRoomAck) => void,
  ) => void;
  "room:rejoin": (
    payload: { roomId: string; playerId: string },
    ack: (res: JoinRoomAck) => void,
  ) => void;
  "lobby:selectCharacter": (payload: { characterId: string }) => void;
  "lobby:setInitialPower": (payload: { power: PowerPool }) => void;
  "lobby:start": (ack: (res: { ok: boolean; error?: string }) => void) => void;
  "game:action": (payload: ActionRequest, ack: (res: ActionAck) => void) => void;
}
