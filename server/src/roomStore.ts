import { customAlphabet, nanoid } from "nanoid";
import { createCryptoRng, type GameState, type PowerPool, type Rng } from "@mk-online/shared";

// 紛らわしい文字（0/O, 1/I 等）を除いた部屋コード用アルファベット
const roomIdAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;

export interface RoomPlayer {
  playerId: string;
  nickname: string;
  characterId: string | null;
  initialPower: PowerPool | null;
  isHost: boolean;
  socketId: string | null;
}

export interface Room {
  roomId: string;
  players: RoomPlayer[];
  game: GameState | null;
  rng: Rng;
  createdAt: number;
  lastActivityAt: number;
}

const rooms = new Map<string, Room>();

export function createRoom(): Room {
  let roomId = roomIdAlphabet();
  while (rooms.has(roomId)) roomId = roomIdAlphabet();
  const room: Room = {
    roomId,
    players: [],
    game: null,
    rng: createCryptoRng(),
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function touchRoom(room: Room): void {
  room.lastActivityAt = Date.now();
}

export function addPlayer(room: Room, nickname: string): RoomPlayer {
  if (room.game) throw new Error("既にゲームが開始されています");
  if (room.players.length >= MAX_PLAYERS) throw new Error("部屋は満員です（最大4人）");
  const trimmed = nickname.trim().slice(0, 20) || "名無し";
  const player: RoomPlayer = {
    playerId: nanoid(10),
    nickname: trimmed,
    characterId: null,
    initialPower: null,
    isHost: room.players.length === 0,
    socketId: null,
  };
  room.players.push(player);
  touchRoom(room);
  return player;
}

const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6時間操作がなければ破棄

export function pruneStaleRooms(): void {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.lastActivityAt > ROOM_TTL_MS) rooms.delete(id);
  }
}
