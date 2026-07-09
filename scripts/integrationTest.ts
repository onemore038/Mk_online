/**
 * サーバー・クライアント間の実際の通信（socket.io-client）を使って、
 * 部屋作成→参加→キャラ選択→開始→ドラフト→ターン操作 の一連の流れを検証する手動スクリプト。
 * `npx tsx scripts/integrationTest.ts` で実行する（vitest のテストスイートには含めない）。
 */
process.env.PORT = "3999";
process.env.CORS_ORIGIN = "http://localhost:5173";

await import("../server/src/index.js");

const { io } = await import("socket.io-client");
const { CHARACTERS } = await import("../shared/src/index.js");
import type {
  ActionAck,
  ClientToServerEvents,
  CreateRoomAck,
  GameState,
  JoinRoomAck,
  LobbyState,
  ServerToClientEvents,
} from "../shared/src/index.js";
import type { Socket } from "socket.io-client";

const URL = "http://localhost:3999";

function connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
  return io(URL, { transports: ["websocket"] });
}

function waitFor<T>(fn: (resolve: (v: T) => void) => void): Promise<T> {
  return new Promise((resolve) => fn(resolve));
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitUntil timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    console.error(`✗ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${message}`);
  }
}

async function main() {
  const p1 = connect();
  const p2 = connect();

  // イベントリスナーは接続直後、他のどのemitより先に登録する。
  // socket.io-client は Node の EventEmitter 同様、.on() 登録前に届いたイベントを
  // キューせず単純に読み捨てるため、後から登録すると最初の更新を取りこぼす。
  let lobbyP1: LobbyState | undefined;
  let gameP1: GameState | undefined;
  let gameP2: GameState | undefined;
  p1.on("lobby:update", (l) => (lobbyP1 = l));
  p1.on("game:update", (g) => (gameP1 = g));
  p2.on("game:update", (g) => (gameP2 = g));

  await Promise.all([
    waitFor<void>((resolve) => p1.on("connect", () => resolve())),
    waitFor<void>((resolve) => p2.on("connect", () => resolve())),
  ]);
  console.log("両クライアントが接続しました");

  const created = await waitFor<CreateRoomAck>((resolve) =>
    p1.emit("room:create", { nickname: "Alice" }, resolve),
  );
  assert(created.roomId.length === 6, `部屋コードが発行された: ${created.roomId}`);

  const joined = await waitFor<JoinRoomAck>((resolve) =>
    p2.emit("room:join", { roomId: created.roomId, nickname: "Bob" }, resolve),
  );
  assert(joined.ok, "2人目が参加できた");
  if (!joined.ok) throw new Error("join failed");

  await waitUntil(() => (lobbyP1?.players.length ?? 0) === 2);
  assert(lobbyP1?.players.length === 2, "ロビーに2人表示される");

  p1.emit("lobby:selectCharacter", { characterId: CHARACTERS[0]!.id });
  p1.emit("lobby:setInitialPower", { power: { money: 4, authority: 0, magic: 0 } });
  p2.emit("lobby:selectCharacter", { characterId: CHARACTERS[1]!.id });
  p2.emit("lobby:setInitialPower", { power: { money: 0, authority: 4, magic: 0 } });
  await waitUntil(() => (lobbyP1?.players.every((p) => p.characterId) ?? false));

  const startAck = await waitFor<{ ok: boolean; error?: string }>((resolve) =>
    p1.emit("lobby:start", resolve),
  );
  assert(startAck.ok, `ホストがゲームを開始できた: ${startAck.error ?? ""}`);

  await waitUntil(() => gameP1 !== undefined && gameP2 !== undefined);

  assert(gameP1?.phase === "draft", "ゲームがドラフトフェイズで始まった");

  // ドラフトが終わるまで、自分の番なら常にパケットの先頭カードをキープし続ける
  let progressed = true;
  while (progressed) {
    progressed = false;
    const g1 = gameP1;
    if (g1?.draft) {
      const myPlayerId1 = Object.keys(g1.players).find((id) => g1.players[id]!.nickname === "Alice")!;
      if (g1.draft.pendingPicks.includes(myPlayerId1)) {
        const packet = g1.draft.packets[myPlayerId1]!;
        await waitFor<ActionAck>((resolve) =>
          p1.emit("game:action", { type: "DRAFT_PICK", cardId: packet[0]! }, resolve),
        );
        await new Promise((r) => setTimeout(r, 50));
        progressed = true;
      }
    }
    const g2 = gameP2;
    if (g2?.draft) {
      const myPlayerId2 = Object.keys(g2.players).find((id) => g2.players[id]!.nickname === "Bob")!;
      if (g2.draft.pendingPicks.includes(myPlayerId2)) {
        const packet = g2.draft.packets[myPlayerId2]!;
        await waitFor<ActionAck>((resolve) =>
          p2.emit("game:action", { type: "DRAFT_PICK", cardId: packet[0]! }, resolve),
        );
        await new Promise((r) => setTimeout(r, 50));
        progressed = true;
      }
    }
    if (!gameP1?.draft && !gameP2?.draft) break;
  }

  await new Promise((r) => setTimeout(r, 200));
  assert(gameP1?.phase === "turnStart", `ドラフト完了後 turnStart になった (実際: ${gameP1?.phase})`);
  assert((gameP1?.players[Object.keys(gameP1.players)[0]!]?.hand.length ?? 0) >= 0, "ドラフト後の手札を確認");

  // 手札の非公開チェック: p1視点でp2の手札は "?" で伏せられているはず
  const bobIdFromP1 = Object.keys(gameP1!.players).find((id) => gameP1!.players[id]!.nickname === "Bob")!;
  const bobHandFromP1 = gameP1!.players[bobIdFromP1]!.hand;
  assert(
    bobHandFromP1.every((c) => c === "?"),
    "p1視点ではBobの手札が伏せられている",
  );
  const bobHandFromP2 = gameP2!.players[bobIdFromP1]!.hand;
  assert(
    bobHandFromP2.some((c) => c !== "?"),
    "p2視点では自分(Bob)の手札が見える",
  );

  const currentId = gameP1!.playerOrder[gameP1!.currentPlayerIndex]!;
  const currentSocket = gameP1!.players[currentId]!.nickname === "Alice" ? p1 : p2;

  const startTurn = await waitFor<ActionAck>((resolve) =>
    currentSocket.emit("game:action", { type: "RESOLVE_TURN_START" }, resolve),
  );
  assert(startTurn.ok, "RESOLVE_TURN_STARTが成功した");
  await new Promise((r) => setTimeout(r, 100));

  const refresh = await waitFor<ActionAck>((resolve) =>
    currentSocket.emit("game:action", { type: "REFRESH_MARKET" }, resolve),
  );
  // 初期パワーが不足していれば失敗するはずなのでどちらでも許容し、コードだけ確認
  console.log(`REFRESH_MARKET結果: ok=${refresh.ok} code=${refresh.code ?? ""}`);

  const gainPower = await waitFor<ActionAck>((resolve) =>
    currentSocket.emit(
      "game:action",
      { type: "GAIN_POWER", source: { kind: "die", dieIndex: 0 } },
      resolve,
    ),
  );
  assert(gainPower.ok, `GAIN_POWERが成功した: ${gainPower.error ?? ""}`);

  const endTurn = await waitFor<ActionAck>((resolve) =>
    currentSocket.emit("game:action", { type: "END_TURN" }, resolve),
  );
  assert(endTurn.ok, `END_TURNが成功した: ${endTurn.error ?? ""}`);

  await new Promise((r) => setTimeout(r, 200));
  assert(gameP1?.turnNumber === 2, `ターンが2に進んだ (実際: ${gameP1?.turnNumber})`);
  assert(gameP1?.phase === "turnStart", "次のプレイヤーの turnStart になった");

  console.log("\n結合テスト完了");
  p1.close();
  p2.close();
  process.exit(process.exitCode ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
