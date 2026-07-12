import { useCallback, useEffect, useState } from "react";
import type {
  ActionRequest,
  GameState,
  LobbyState,
  PowerPool,
} from "@mk-online/shared";
import { socket } from "../socket";

const STORAGE_ROOM_ID = "mk_roomId";
const STORAGE_PLAYER_ID = "mk_playerId";

export interface UseConnection {
  connected: boolean;
  roomId: string | null;
  playerId: string | null;
  lobby: LobbyState | null;
  game: GameState | null;
  error: string | null;
  clearError: () => void;
  createRoom: (nickname: string) => void;
  joinRoom: (roomId: string, nickname: string) => void;
  leaveRoom: () => void;
  selectCharacter: (characterId: string) => void;
  setInitialPower: (power: PowerPool) => void;
  startGame: () => void;
  sendAction: (action: ActionRequest) => void;
}

export function useConnection(): UseConnection {
  const [connected, setConnected] = useState(socket.connected);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      const savedRoomId = localStorage.getItem(STORAGE_ROOM_ID);
      const savedPlayerId = localStorage.getItem(STORAGE_PLAYER_ID);
      if (savedRoomId && savedPlayerId) {
        socket.emit("room:rejoin", { roomId: savedRoomId, playerId: savedPlayerId }, (res) => {
          if (res.ok) {
            setRoomId(savedRoomId);
            setPlayerId(savedPlayerId);
          } else {
            localStorage.removeItem(STORAGE_ROOM_ID);
            localStorage.removeItem(STORAGE_PLAYER_ID);
          }
        });
      }
    };
    const onDisconnect = () => setConnected(false);
    const onLobbyUpdate = (state: LobbyState) => setLobby(state);
    const onGameUpdate = (state: GameState) => setGame(state);
    const onGameError = (payload: { message: string; code: string }) =>
      setError(`${payload.message}（${payload.code}）`);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("lobby:update", onLobbyUpdate);
    socket.on("game:update", onGameUpdate);
    socket.on("game:error", onGameError);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("lobby:update", onLobbyUpdate);
      socket.off("game:update", onGameUpdate);
      socket.off("game:error", onGameError);
    };
  }, []);

  const createRoom = useCallback((nickname: string) => {
    socket.emit("room:create", { nickname }, (res) => {
      localStorage.setItem(STORAGE_ROOM_ID, res.roomId);
      localStorage.setItem(STORAGE_PLAYER_ID, res.playerId);
      setRoomId(res.roomId);
      setPlayerId(res.playerId);
    });
  }, []);

  const joinRoom = useCallback((targetRoomId: string, nickname: string) => {
    socket.emit("room:join", { roomId: targetRoomId, nickname }, (res) => {
      if (!res.ok) {
        setError(res.error);
        return;
      }
      localStorage.setItem(STORAGE_ROOM_ID, targetRoomId.toUpperCase());
      localStorage.setItem(STORAGE_PLAYER_ID, res.playerId);
      setRoomId(targetRoomId.toUpperCase());
      setPlayerId(res.playerId);
    });
  }, []);

  const leaveRoom = useCallback(() => {
    localStorage.removeItem(STORAGE_ROOM_ID);
    localStorage.removeItem(STORAGE_PLAYER_ID);
    setRoomId(null);
    setPlayerId(null);
    setLobby(null);
    setGame(null);
    socket.disconnect();
    socket.connect();
  }, []);

  const selectCharacter = useCallback((characterId: string) => {
    socket.emit("lobby:selectCharacter", { characterId });
  }, []);

  const setInitialPower = useCallback((power: PowerPool) => {
    socket.emit("lobby:setInitialPower", { power });
  }, []);

  const startGame = useCallback(() => {
    socket.emit("lobby:start", (res) => {
      if (!res.ok && res.error) setError(res.error);
    });
  }, []);

  const sendAction = useCallback((action: ActionRequest) => {
    socket.emit("game:action", action, (res) => {
      if (!res.ok) setError(`${res.error ?? "エラー"}${res.code ? `（${res.code}）` : ""}`);
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    connected,
    roomId,
    playerId,
    lobby,
    game,
    error,
    clearError,
    createRoom,
    joinRoom,
    leaveRoom,
    selectCharacter,
    setInitialPower,
    startGame,
    sendAction,
  };
}
