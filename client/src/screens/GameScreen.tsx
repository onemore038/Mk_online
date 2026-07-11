import { useEffect, useState } from "react";
import {
  CHARACTERS,
  DIE_FACE_TO_POWER,
  POWER_TYPES,
  getMarketCard,
  diceFacesSatisfyGroups,
  type ActionRequest,
  type GameState,
  type InstalledCard,
  type PowerType,
} from "@mk-online/shared";
import { DiceRow, DiceMultiSelect } from "../components/DiceRow";
import { CardTile } from "../components/CardTile";
import { PlayerSummary, PowerBadge, VpValue } from "../components/PlayerSummary";
import { LogPanel } from "../components/LogPanel";
import { describeFaceGroups } from "../lib/cardText";

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

/** カード設置に必要なダイス数（マリーの常時割引を反映）。 */
function requiredDiceCount(costDice: number | undefined, characterId: string): number {
  const marieDiscount = characterId === "char.marie" ? 1 : 0;
  return Math.max(0, (costDice ?? 0) - marieDiscount);
}

const USE_PANEL_CARD_IDS = ["std.lean", "std.rich", "std.fingerTest", "std.mixer", "adv.darkVault"];

const POWER_LABEL: Record<PowerType, string> = { money: "お金", authority: "権力", magic: "魔力" };

export function GameScreen({ game, myPlayerId, sendAction }: Props) {
  const [selectedDie, setSelectedDie] = useState<number | null>(null);
  const [discardSelection, setDiscardSelection] = useState<string[]>([]);
  const [discardBreadCount, setDiscardBreadCount] = useState(0);

  // ターン開始時の選択（コロネリア/ショコラのパワー選択、闇市の3択）
  const [turnStartPowerChoice, setTurnStartPowerChoice] = useState<PowerType>("money");
  const [turnStartBlackMarket, setTurnStartBlackMarket] = useState<
    Record<string, { option: "market" | "diceBread" | "power"; powerType?: PowerType | undefined }>
  >({});

  // カード設置（INSTALL_CARD）の保留中パネル
  const [installTarget, setInstallTarget] = useState<string | null>(null);
  const [installDice, setInstallDice] = useState<number[]>([]);
  const [installFlanBonus, setInstallFlanBonus] = useState(false);
  const [installUseBargain, setInstallUseBargain] = useState(false);
  const [installBargainAlloc, setInstallBargainAlloc] = useState<Partial<Record<PowerType, number>>>({});

  // レジェンドカード設置（PLACE_LEGEND_CARD）の保留中パネル
  const [legendTarget, setLegendTarget] = useState<{ cardId: string; row: "legend1" | "legend2" } | null>(null);
  const [legendDice, setLegendDice] = useState<number[]>([]);
  const [legendBreadIdx, setLegendBreadIdx] = useState<number[]>([]);
  const [legendAnyDiscards, setLegendAnyDiscards] = useState<string[]>([]);
  const [legendUseBargain, setLegendUseBargain] = useState(false);
  const [legendBargainAlloc, setLegendBargainAlloc] = useState<Partial<Record<PowerType, number>>>({});

  // 設置済みカード使用（USE_INSTALLED_CARD）の保留中パネル
  const [useTarget, setUseTarget] = useState<{ instanceId: string; cardId: string } | null>(null);
  const [useDie, setUseDie] = useState<number | null>(null);
  const [useRerollIdx, setUseRerollIdx] = useState<number[]>([]);
  const [useFingerDelta, setUseFingerDelta] = useState<1 | -1>(1);
  const [useDarkVaultCount, setUseDarkVaultCount] = useState(1);

  // ソフィ専用行動の選択
  const [sophiePower, setSophiePower] = useState<PowerType>("money");

  useEffect(() => {
    setSelectedDie(null);
  }, [game.dice]);

  useEffect(() => {
    setInstallTarget(null);
    setLegendTarget(null);
    setUseTarget(null);
    setTurnStartBlackMarket({});
    setDiscardSelection([]);
    setDiscardBreadCount(0);
  }, [game.turnNumber]);

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
      <div className="board-layout">
        <div className="board-main">
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
        </div>
        <div className="board-side">
          <div className="panel">
            <h2>プレイヤー</h2>
            <PlayerSummary game={game} myPlayerId={myPlayerId} />
          </div>
        </div>
      </div>
    );
  }

  if (!me) return <p>プレイヤー情報を取得できません</p>;

  const myPendingChoices = game.pendingChoices.filter((c) => c.playerId === myPlayerId);

  function renderPendingChoicesPanel() {
    if (myPendingChoices.length === 0) return null;
    return (
      <div className="panel" style={{ borderColor: "var(--accent)" }}>
        <h2>あなたの選択待ち</h2>
        <div className="col">
          {myPendingChoices.map((choice) => {
            if (choice.kind === "paneteriaCardType") {
              return (
                <div key={choice.id}>
                  <p className="hint">パネテリア遊園地：獲得するカードの種類を選んでください</p>
                  <div className="grid cards">
                    {groupStacks(game.openMarket).map(({ cardId, count }) => (
                      <CardTile
                        key={cardId}
                        cardId={cardId}
                        count={count}
                        onClick={() => sendAction({ type: "RESOLVE_PENDING_CHOICE", choiceId: choice.id, cardId })}
                      />
                    ))}
                  </div>
                </div>
              );
            }
            const label = choice.kind === "twoStarBraceletPower" ? "二ツ星のブレスレット" : "五ツ星のネックレス";
            return (
              <div key={choice.id} className="row">
                <span className="hint">
                  {label}：獲得するパワーを選んでください（{choice.amount}個）
                </span>
                <button
                  className="btn"
                  onClick={() => sendAction({ type: "RESOLVE_PENDING_CHOICE", choiceId: choice.id, powerType: "authority" })}
                >
                  権力
                </button>
                <button
                  className="btn"
                  onClick={() => sendAction({ type: "RESOLVE_PENDING_CHOICE", choiceId: choice.id, powerType: "magic" })}
                >
                  魔力
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (game.phase === "turnStart") {
    const needsPowerChoice = me.characterId === "char.coronelia" || me.characterId === "char.chocolat";
    const blackMarketInstances = me.installed.filter((c) => c.cardId === "adv.blackMarket");
    const canCroixSkip = me.characterId === "char.croix" && !me.croixSkipAbilityUsed;

    return (
      <div className="board-layout">
        <div className="board-main">
        {renderPendingChoicesPanel()}
        <div className="panel">
          <h2>ターン {game.turnNumber}</h2>
          {isMyTurn ? (
            <>
              {needsPowerChoice && (
                <div className="row" style={{ marginBottom: 10 }}>
                  <span className="hint">獲得するパワーを選択：</span>
                  {POWER_TYPES.map((t) => (
                    <button
                      key={t}
                      className={`btn${turnStartPowerChoice === t ? " selected" : ""}`}
                      onClick={() => setTurnStartPowerChoice(t)}
                    >
                      {POWER_LABEL[t]}
                    </button>
                  ))}
                </div>
              )}
              {blackMarketInstances.map((inst) => (
                <div key={inst.instanceId} className="row" style={{ marginBottom: 10 }}>
                  <span className="hint">闇市の選択：</span>
                  {(["market", "diceBread", "power"] as const).map((opt) => (
                    <button
                      key={opt}
                      className={`btn${(turnStartBlackMarket[inst.instanceId]?.option ?? "market") === opt ? " selected" : ""}`}
                      onClick={() =>
                        setTurnStartBlackMarket((prev) => ({
                          ...prev,
                          [inst.instanceId]: { option: opt, powerType: prev[inst.instanceId]?.powerType },
                        }))
                      }
                    >
                      {opt === "market" ? "マーケットカード" : opt === "diceBread" ? "サイコロパン" : "パワー"}
                    </button>
                  ))}
                  {turnStartBlackMarket[inst.instanceId]?.option === "power" &&
                    POWER_TYPES.map((t) => (
                      <button
                        key={t}
                        className={`btn${(turnStartBlackMarket[inst.instanceId]?.powerType ?? "money") === t ? " selected" : ""}`}
                        onClick={() =>
                          setTurnStartBlackMarket((prev) => ({
                            ...prev,
                            [inst.instanceId]: { option: "power", powerType: t },
                          }))
                        }
                      >
                        {POWER_LABEL[t]}
                      </button>
                    ))}
                </div>
              ))}
              <button
                className="btn primary"
                onClick={() =>
                  sendAction({
                    type: "RESOLVE_TURN_START",
                    ...(needsPowerChoice ? { characterPowerChoice: turnStartPowerChoice } : {}),
                    ...(blackMarketInstances.length > 0 ? { blackMarketChoices: turnStartBlackMarket } : {}),
                  })
                }
              >
                ターン開始（ダイスを振る）
              </button>
              {canCroixSkip && (
                <div className="panel" style={{ marginTop: 14 }}>
                  <h3>クロワの能力：ターンをスキップして無償設置</h3>
                  <p className="hint">
                    ゲーム中1度だけ使用できます。使うとこのターンは他の行動を行わずに終了します。
                  </p>
                  <div className="grid cards">
                    {groupStacks(game.openMarket).map(({ cardId, count }) => (
                      <CardTile
                        key={cardId}
                        cardId={cardId}
                        count={count}
                        onClick={() => sendAction({ type: "CROIX_SKIP_TURN_INSTALL", cardId })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="hint">
              {game.players[game.playerOrder[game.currentPlayerIndex]!]?.nickname} さんのターン開始を待っています…
            </p>
          )}
        </div>
        </div>
        <div className="board-side">
          <div className="panel">
            <h2>プレイヤー</h2>
            <PlayerSummary game={game} myPlayerId={myPlayerId} />
          </div>
        </div>
      </div>
    );
  }

  // phase === "turnActions"
  // 手札上限は「マーケットカード＋サイコロパンカード」の合計に対して適用される（reducer.ts の endTurn/discardToHandLimit 参照）
  const handExcess = me.hand.length + me.diceBreadCards.length - me.handLimit;
  const overHandLimit = handExcess > 0;
  const marketStacks = groupStacks(game.openMarket);

  function toggleDiscard(cardId: string, idx: number) {
    const key = `${cardId}-${idx}`;
    setDiscardSelection((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function convertPower(from: PowerType, to: PowerType) {
    if (from === to) return;
    sendAction({ type: "CONVERT_POWER", from, to });
  }

  function openInstall(cardId: string) {
    setInstallTarget(cardId);
    setInstallDice([]);
    setInstallFlanBonus(false);
    setInstallUseBargain(false);
    setInstallBargainAlloc({});
  }

  function openLegend(cardId: string, row: "legend1" | "legend2") {
    setLegendTarget({ cardId, row });
    setLegendDice([]);
    setLegendBreadIdx([]);
    setLegendAnyDiscards([]);
    setLegendUseBargain(false);
    setLegendBargainAlloc({});
  }

  function handleInstalledClick(c: InstalledCard) {
    if (USE_PANEL_CARD_IDS.includes(c.cardId)) {
      setUseTarget({ instanceId: c.instanceId, cardId: c.cardId });
      setUseDie(null);
      setUseRerollIdx([]);
      setUseFingerDelta(1);
      setUseDarkVaultCount(1);
    } else {
      sendAction({ type: "USE_INSTALLED_CARD", instanceId: c.instanceId });
    }
  }

  return (
    <div className="tabletop">
      {renderPendingChoicesPanel()}

      {/* 対戦相手（奥） */}
      <div className="opponents-strip">
        {game.playerOrder
          .filter((id) => id !== myPlayerId)
          .map((id) => {
            const p = game.players[id]!;
            const character = CHARACTERS.find((c) => c.id === p.characterId);
            const isCurrent = game.playerOrder[game.currentPlayerIndex] === id;
            return (
              <div key={id} className={`opponent-card${isCurrent ? " current" : ""}`}>
                <div className="name">
                  {isCurrent ? "▶ " : ""}
                  {p.nickname}
                  {!p.connected ? "（切断中）" : ""}
                </div>
                <div className="hint">{character?.name ?? p.characterId}</div>
                <div className="row" style={{ marginTop: 6 }}>
                  {POWER_TYPES.map((t) => (
                    <PowerBadge key={t} type={t} value={p.power[t]} mini />
                  ))}
                </div>
                <div className="hint" style={{ marginTop: 4 }}>
                  手札{p.hand.length}・設置{p.installed.length}・<VpValue value={p.victoryPoints} />
                </div>
                {p.installed.length > 0 && (
                  <div className="grid cards compact" style={{ marginTop: 6 }}>
                    {groupStacks(p.installed.map((c) => c.cardId)).map(({ cardId, count }) => (
                      <CardTile key={cardId} cardId={cardId} count={count} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* 中央：レジェンド／マーケット／ダイス */}
      <div className="board-row triple">
      <div className="panel table-zone zone-legend">
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
              onClick={() => openLegend(cardId, "legend1")}
            />
          ))}
        </div>
        <h3 className="hint" style={{ marginTop: 10 }}>Ⅱ</h3>
        <div className="grid cards">
          {game.legendColumns.map((col) => {
            const legend1Available = game.legend1Row.includes(col.legend1Id);
            const legend2Available = game.legend2Row.includes(col.legend2Id);
            if (!legend1Available && !legend2Available) return null;
            if (legend1Available) {
              return (
                <CardTile
                  key={col.legend2Id}
                  cardId={col.legend2Id}
                  disabled
                  extra="ロック中（対応するⅠの設置で解放）"
                />
              );
            }
            return (
              <CardTile
                key={col.legend2Id}
                cardId={col.legend2Id}
                disabled={!isMyTurn || game.legendPlacedThisTurn}
                onClick={() => openLegend(col.legend2Id, "legend2")}
              />
            );
          })}
        </div>

        {legendTarget && (() => {
          const card = getMarketCard(legendTarget.cardId);
          const cost = card.cost;
          if (cost === null) {
            return (
              <div className="panel" style={{ borderColor: "var(--accent)", marginTop: 12 }}>
                <h3>{card.name}</h3>
                <p className="hint">このカードは設置条件が未確認のため設置できません</p>
                <button className="btn" onClick={() => setLegendTarget(null)}>閉じる</button>
              </div>
            );
          }

          const usesPipSum = cost.requiredPipSum !== undefined;
          const requiredDice = usesPipSum ? 0 : requiredDiceCount(cost.dice, me.characterId);
          const pipSum =
            legendDice.reduce((s, i) => s + (game.dice[i]?.face ?? 0), 0) +
            legendBreadIdx.reduce((s, i) => s + (me.diceBreadCards[i] ?? 0), 0);
          const anyDiscardNeeded = cost.requiredAnyHandDiscardCount ?? 0;
          const bargainAvail = me.pendingBargainRingReduction ?? 0;
          const hasPowerCost = (cost.money ?? 0) > 0 || (cost.authority ?? 0) > 0 || (cost.magic ?? 0) > 0;
          const totalAlloc = POWER_TYPES.reduce((s, t) => s + (legendBargainAlloc[t] ?? 0), 0);

          const faceHint = usesPipSum ? null : describeFaceGroups(cost.diceFaceGroups);
          const selectedFaces = legendDice.map((i) => game.dice[i]?.face).filter((f): f is NonNullable<typeof f> => f !== undefined);
          const faceOk = usesPipSum || diceFacesSatisfyGroups(selectedFaces, cost.diceFaceGroups);

          const diceOk = usesPipSum
            ? pipSum >= (cost.requiredPipSum ?? 0)
            : legendDice.length === requiredDice && faceOk;
          const discardOk = anyDiscardNeeded === 0 || legendAnyDiscards.length === anyDiscardNeeded;
          const breadOk = usesPipSum || me.diceBreadCards.length >= (cost.requiredDiceBreadCount ?? 0);

          return (
            <div className="panel" style={{ borderColor: "var(--accent)", marginTop: 12 }}>
              <h3>{card.name} を設置（レジェンド{legendTarget.row === "legend1" ? "Ⅰ" : "Ⅱ"}）</h3>
              <p className="hint">{card.effectSummary}</p>

              {usesPipSum ? (
                <>
                  <p className="hint">出目合計: {pipSum} / 必要: {cost.requiredPipSum}以上</p>
                  <p className="hint">このターンに振ったダイス</p>
                  <DiceMultiSelect
                    dice={game.dice}
                    selectedIndices={legendDice}
                    onToggle={(i) => setLegendDice((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
                  />
                  {me.diceBreadCards.length > 0 && (
                    <>
                      <p className="hint" style={{ marginTop: 8 }}>サイコロパン</p>
                      <div className="row">
                        {me.diceBreadCards.map((face, i) => (
                          <div
                            key={i}
                            className={`die selectable${legendBreadIdx.includes(i) ? " selected" : ""}`}
                            onClick={() => setLegendBreadIdx((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
                          >
                            {face}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : requiredDice > 0 ? (
                <>
                  <p className="hint">
                    必要ダイス: {requiredDice}個（選択中: {legendDice.length}）{faceHint ? `（${faceHint}）` : ""}
                    {legendDice.length === requiredDice && !faceOk && "（出目の組み合わせが条件を満たしていません）"}
                  </p>
                  <DiceMultiSelect
                    dice={game.dice}
                    selectedIndices={legendDice}
                    onToggle={(i) =>
                      setLegendDice((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < requiredDice ? [...p, i] : p))
                    }
                  />
                </>
              ) : null}

              {hasPowerCost && (
                <p className="hint" style={{ marginTop: 8 }}>
                  コスト:{cost.money ? ` お金${cost.money}` : ""}{cost.authority ? ` 権力${cost.authority}` : ""}
                  {cost.magic ? ` 魔力${cost.magic}` : ""}
                </p>
              )}

              {cost.requiredDiscards && cost.requiredDiscards.length > 0 && (
                <p className="hint">
                  自動的に捨て札になる設置済みカード: {cost.requiredDiscards.map((d) => `${getMarketCard(d.cardId).name}×${d.count}`).join("、")}
                </p>
              )}

              {!usesPipSum && (cost.requiredDiceBreadCount ?? 0) > 0 && (
                <p className="hint">
                  サイコロパン{cost.requiredDiceBreadCount}枚を自動的に消費します（所持: {me.diceBreadCards.length}枚）
                </p>
              )}

              {anyDiscardNeeded > 0 && (
                <>
                  <p className="hint" style={{ marginTop: 8 }}>
                    手札から{anyDiscardNeeded}枚捨てる（選択中: {legendAnyDiscards.length}）
                  </p>
                  <div className="grid cards">
                    {me.hand.map((cardId, idx) => {
                      const key = `${cardId}-${idx}`;
                      return (
                        <CardTile
                          key={key}
                          cardId={cardId}
                          selected={legendAnyDiscards.includes(key)}
                          onClick={() =>
                            setLegendAnyDiscards((p) =>
                              p.includes(key) ? p.filter((x) => x !== key) : p.length < anyDiscardNeeded ? [...p, key] : p,
                            )
                          }
                        />
                      );
                    })}
                  </div>
                </>
              )}

              {bargainAvail > 0 && hasPowerCost && (
                <div className="col" style={{ marginTop: 8 }}>
                  <label className="row">
                    <input
                      type="checkbox"
                      checked={legendUseBargain}
                      onChange={(e) => {
                        setLegendUseBargain(e.target.checked);
                        setLegendBargainAlloc({});
                      }}
                    />
                    値切りの指輪の軽減（残り{bargainAvail}）を使う
                  </label>
                  {legendUseBargain && (
                    <div className="row">
                      {POWER_TYPES.filter((t) => (cost[t] ?? 0) > 0).map((t) => (
                        <label key={t} className="row">
                          {t}:
                          <input
                            type="number"
                            min={0}
                            max={Math.min(cost[t] ?? 0, bargainAvail)}
                            value={legendBargainAlloc[t] ?? 0}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(Number(e.target.value), cost[t] ?? 0));
                              setLegendBargainAlloc((prev) => ({ ...prev, [t]: v }));
                            }}
                            style={{ width: 55 }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="row" style={{ marginTop: 10 }}>
                <button
                  className="btn primary"
                  disabled={!diceOk || !discardOk || !breadOk || (legendUseBargain && totalAlloc > bargainAvail)}
                  onClick={() => {
                    sendAction({
                      type: "PLACE_LEGEND_CARD",
                      cardId: legendTarget.cardId,
                      row: legendTarget.row,
                      dieIndices: legendDice,
                      ...(usesPipSum ? { diceBreadIndices: legendBreadIdx } : {}),
                      ...(anyDiscardNeeded > 0
                        ? { anyDiscardCardIds: legendAnyDiscards.map((k) => k.slice(0, k.lastIndexOf("-"))) }
                        : {}),
                      ...(legendUseBargain ? { bargainRingAllocation: legendBargainAlloc } : {}),
                    });
                    setLegendTarget(null);
                  }}
                >
                  設置する
                </button>
                <button className="btn" onClick={() => setLegendTarget(null)}>キャンセル</button>
              </div>
            </div>
          );
        })()}
      </div>

        <div className="panel table-zone zone-market">
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

        <div className="panel table-zone zone-dice">
          <h2>ダイス</h2>
          <div className="row dice-legend" style={{ marginBottom: 8 }}>
            <span><span className="dice-legend-dot money" />出目1・2＝お金</span>
            <span><span className="dice-legend-dot authority" />出目3・4＝権力</span>
            <span><span className="dice-legend-dot magic" />出目5・6＝魔力</span>
          </div>
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
                {selectedDie !== null && game.dice[selectedDie]
                  ? `（→ ${POWER_LABEL[DIE_FACE_TO_POWER[game.dice[selectedDie]!.face]]}）`
                  : ""}
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
                {me.diceBreadCards.length > 0
                  ? `サイコロパン ${me.diceBreadCards.length}枚`
                  : "サイコロパンなし"}
              </span>
              {POWER_TYPES.map((t) => (
                <button
                  key={t}
                  className="btn"
                  disabled={me.diceBreadCards.length <= 0}
                  onClick={() => sendAction({ type: "GAIN_POWER", source: { kind: "diceBread", powerType: t } })}
                >
                  パンで{POWER_LABEL[t]}獲得
                </button>
              ))}
            </div>
          )}

          <h3 style={{ marginTop: 10 }}>パワー変換（同種2個 → 異種1個）</h3>
          <div className="row">
            {POWER_TYPES.flatMap((from) =>
              POWER_TYPES.filter((to) => to !== from).map((to) => (
                <button
                  key={`${from}-${to}`}
                  className="btn"
                  disabled={!isMyTurn || me.power[from] < 2}
                  onClick={() => convertPower(from, to)}
                >
                  {POWER_LABEL[from]}→{POWER_LABEL[to]}
                </button>
              )),
            )}
          </div>
        </div>
      </div>

      {me.characterId === "char.sophie" && (
        <div className="panel">
          <h2>ソフィの能力：カードを捨ててパワー獲得</h2>
          <p className="hint">手札のマーケットカードを1枚捨て、金/権/魔いずれか1種類のパワーを1つ得ます。何度でも使えます。</p>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="hint">獲得するパワー：</span>
            {POWER_TYPES.map((t) => (
              <button
                key={t}
                className={`btn${sophiePower === t ? " selected" : ""}`}
                onClick={() => setSophiePower(t)}
              >
                {POWER_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="grid cards">
            {me.hand.map((cardId, idx) => (
              <CardTile
                key={`${cardId}-${idx}`}
                cardId={cardId}
                disabled={!isMyTurn}
                onClick={() => sendAction({ type: "SOPHIE_DISCARD_FOR_POWER", cardId, powerType: sophiePower })}
              />
            ))}
          </div>
        </div>
      )}

      {me.characterId === "char.chocolat" && (
        <div className="panel">
          <h2>ショコラの能力：パワー1:1交換</h2>
          <p className="hint">自分の所有パワー1つをパワー置き場に戻し、別のパワー1つを得ます。何度でも使えます。</p>
          <div className="row">
            {POWER_TYPES.flatMap((from) =>
              POWER_TYPES.filter((to) => to !== from).map((to) => (
                <button
                  key={`${from}-${to}`}
                  className="btn"
                  disabled={!isMyTurn || me.power[from] < 1}
                  onClick={() => sendAction({ type: "CHOCOLAT_CONVERT_POWER", from, to })}
                >
                  {POWER_LABEL[from]}→{POWER_LABEL[to]}
                </button>
              )),
            )}
          </div>
        </div>
      )}

      {/* あなたの領地（手前） */}
      <div className="panel table-zone zone-territory">
        <h2>
          あなたの領地（{me.nickname}） — ターン{game.turnNumber}{isMyTurn ? "・あなたの番" : ""}
        </h2>
        <div className="row" style={{ marginBottom: 8 }}>
          {POWER_TYPES.map((t) => (
            <PowerBadge key={t} type={t} value={me.power[t]} />
          ))}
          <span className="hint">手札{me.hand.length}</span>
          <span className="hint">設置{me.installed.length}</span>
          <VpValue value={me.victoryPoints} />
        </div>

        <div className="board-row">
          <div className="panel">
            <h2>
              手札（{me.hand.length + me.diceBreadCards.length}/{me.handLimit}：カード{me.hand.length}
              {me.diceBreadCards.length > 0 ? `・サイコロパン${me.diceBreadCards.length}` : ""}）
            </h2>
            {overHandLimit && (
              <div className="panel" style={{ borderColor: "var(--danger)" }}>
                <p className="hint">
                  手札が上限を超えています。合計{handExcess}枚（カード＋サイコロパン）選んで捨ててください（選択中:
                  {discardSelection.length + discardBreadCount}枚）
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
                {me.diceBreadCards.length > 0 && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <span className="hint">サイコロパンを捨てる枚数（所持: {me.diceBreadCards.length}）:</span>
                    <button
                      className="btn"
                      disabled={discardBreadCount <= 0}
                      onClick={() => setDiscardBreadCount((n) => n - 1)}
                    >
                      -
                    </button>
                    <span>{discardBreadCount}</span>
                    <button
                      className="btn"
                      disabled={discardBreadCount >= me.diceBreadCards.length}
                      onClick={() => setDiscardBreadCount((n) => n + 1)}
                    >
                      +
                    </button>
                  </div>
                )}
                <button
                  className="btn danger"
                  disabled={discardSelection.length + discardBreadCount !== handExcess}
                  onClick={() => {
                    const ids = discardSelection.map((k) => k.slice(0, k.lastIndexOf("-")));
                    sendAction({
                      type: "DISCARD_TO_HAND_LIMIT",
                      cardIds: ids,
                      ...(discardBreadCount > 0 ? { discardDiceBreadCount: discardBreadCount } : {}),
                    });
                    setDiscardSelection([]);
                    setDiscardBreadCount(0);
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
                    onClick={() => openInstall(cardId)}
                  />
                ))}
              </div>
            )}

            {installTarget && (() => {
              const card = getMarketCard(installTarget);
              const cost = card.cost;
              if (cost === null) {
                return (
                  <div className="panel" style={{ borderColor: "var(--accent)", marginTop: 12 }}>
                    <h3>{card.name}</h3>
                    <p className="hint">このカードはコストが未確認のため設置できません</p>
                    <button className="btn" onClick={() => setInstallTarget(null)}>閉じる</button>
                  </div>
                );
              }

              const requiredDice = requiredDiceCount(cost.dice, me.characterId);
              const hasSecondCopy = me.characterId === "char.flan" && me.hand.filter((id) => id === installTarget).length >= 2;
              const bargainAvail = me.pendingBargainRingReduction ?? 0;
              const hasPowerCost = (cost.money ?? 0) > 0 || (cost.authority ?? 0) > 0 || (cost.magic ?? 0) > 0;
              const totalAlloc = POWER_TYPES.reduce((s, t) => s + (installBargainAlloc[t] ?? 0), 0);
              const faceHint = describeFaceGroups(cost.diceFaceGroups);
              const selectedFaces = installDice.map((i) => game.dice[i]?.face).filter((f): f is NonNullable<typeof f> => f !== undefined);
              const faceOk = diceFacesSatisfyGroups(selectedFaces, cost.diceFaceGroups);

              return (
                <div className="panel" style={{ borderColor: "var(--accent)", marginTop: 12 }}>
                  <h3>{card.name} を設置</h3>
                  <p className="hint">
                    必要ダイス: {requiredDice}個{cost.dice && me.characterId === "char.marie" ? "（マリーの割引適用済み）" : ""}
                    {faceHint ? `（${faceHint}）` : ""}
                    {hasPowerCost &&
                      ` / コスト:${cost.money ? ` お金${cost.money}` : ""}${cost.authority ? ` 権力${cost.authority}` : ""}${cost.magic ? ` 魔力${cost.magic}` : ""}`}
                  </p>

                  {requiredDice > 0 && (
                    <>
                      <DiceMultiSelect
                        dice={game.dice}
                        selectedIndices={installDice}
                        onToggle={(i) =>
                          setInstallDice((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < requiredDice ? [...p, i] : p))
                        }
                      />
                      <p className="hint">
                        選択中: {installDice.length} / {requiredDice}
                        {installDice.length === requiredDice && !faceOk && "（出目の組み合わせが条件を満たしていません）"}
                      </p>
                    </>
                  )}

                  {hasSecondCopy && (
                    <label className="row" style={{ marginTop: 8 }}>
                      <input
                        type="checkbox"
                        checked={installFlanBonus}
                        onChange={(e) => setInstallFlanBonus(e.target.checked)}
                      />
                      フランの能力：同名カードをもう1枚無料で同時設置する
                    </label>
                  )}

                  {bargainAvail > 0 && hasPowerCost && (
                    <div className="col" style={{ marginTop: 8 }}>
                      <label className="row">
                        <input
                          type="checkbox"
                          checked={installUseBargain}
                          onChange={(e) => {
                            setInstallUseBargain(e.target.checked);
                            setInstallBargainAlloc({});
                          }}
                        />
                        値切りの指輪の軽減（残り{bargainAvail}）を使う
                      </label>
                      {installUseBargain && (
                        <div className="row">
                          {POWER_TYPES.filter((t) => (cost[t] ?? 0) > 0).map((t) => (
                            <label key={t} className="row">
                              {t}:
                              <input
                                type="number"
                                min={0}
                                max={Math.min(cost[t] ?? 0, bargainAvail)}
                                value={installBargainAlloc[t] ?? 0}
                                onChange={(e) => {
                                  const v = Math.max(0, Math.min(Number(e.target.value), cost[t] ?? 0));
                                  setInstallBargainAlloc((prev) => ({ ...prev, [t]: v }));
                                }}
                                style={{ width: 55 }}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="row" style={{ marginTop: 10 }}>
                    <button
                      className="btn primary"
                      disabled={
                        installDice.length !== requiredDice ||
                        !faceOk ||
                        (installUseBargain && totalAlloc > bargainAvail)
                      }
                      onClick={() => {
                        sendAction({
                          type: "INSTALL_CARD",
                          cardId: installTarget,
                          dieIndices: installDice,
                          ...(installFlanBonus ? { flanBonusCopy: true } : {}),
                          ...(installUseBargain ? { bargainRingAllocation: installBargainAlloc } : {}),
                        });
                        setInstallTarget(null);
                      }}
                    >
                      設置する
                    </button>
                    <button className="btn" onClick={() => setInstallTarget(null)}>キャンセル</button>
                  </div>
                </div>
              );
            })()}
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
                  onClick={() => handleInstalledClick(c)}
                />
              ))}
            </div>

            {useTarget && (() => {
              const card = getMarketCard(useTarget.cardId);
              const needsDie =
                useTarget.cardId === "std.lean" || useTarget.cardId === "std.rich" || useTarget.cardId === "std.fingerTest";
              const confirmDisabled =
                (needsDie && useDie === null) || (useTarget.cardId === "adv.darkVault" && me.power.money < useDarkVaultCount);

              return (
                <div className="panel" style={{ borderColor: "var(--accent)", marginTop: 12 }}>
                  <h3>{card.name} を使用</h3>
                  {(useTarget.cardId === "std.lean" || useTarget.cardId === "std.rich") && (
                    <>
                      <p className="hint">出目を{useTarget.cardId === "std.lean" ? 1 : 6}に変更するダイスを選択</p>
                      <DiceRow dice={game.dice} selectedIndex={useDie} selectable onSelect={setUseDie} />
                    </>
                  )}
                  {useTarget.cardId === "std.fingerTest" && (
                    <>
                      <p className="hint">±1したいダイスを選択</p>
                      <DiceRow dice={game.dice} selectedIndex={useDie} selectable onSelect={setUseDie} />
                      <div className="row" style={{ marginTop: 8 }}>
                        <button className={`btn${useFingerDelta === 1 ? " selected" : ""}`} onClick={() => setUseFingerDelta(1)}>+1</button>
                        <button className={`btn${useFingerDelta === -1 ? " selected" : ""}`} onClick={() => setUseFingerDelta(-1)}>-1</button>
                      </div>
                    </>
                  )}
                  {useTarget.cardId === "std.mixer" && (
                    <>
                      <p className="hint">振り直すダイスを選択（0個も可）</p>
                      <DiceMultiSelect
                        dice={game.dice}
                        selectedIndices={useRerollIdx}
                        onToggle={(i) => setUseRerollIdx((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
                      />
                    </>
                  )}
                  {useTarget.cardId === "adv.darkVault" && (
                    <>
                      <p className="hint">カードの上に載せる「お金」の数（所持: {me.power.money}）</p>
                      <div className="row">
                        {[1, 2, 3].map((n) => (
                          <button
                            key={n}
                            className={`btn${useDarkVaultCount === n ? " selected" : ""}`}
                            disabled={me.power.money < n}
                            onClick={() => setUseDarkVaultCount(n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="row" style={{ marginTop: 10 }}>
                    <button
                      className="btn primary"
                      disabled={confirmDisabled}
                      onClick={() => {
                        if (useTarget.cardId === "std.lean" || useTarget.cardId === "std.rich") {
                          sendAction({ type: "USE_INSTALLED_CARD", instanceId: useTarget.instanceId, targetDieIndex: useDie! });
                        } else if (useTarget.cardId === "std.fingerTest") {
                          sendAction({
                            type: "USE_INSTALLED_CARD",
                            instanceId: useTarget.instanceId,
                            targetDieIndex: useDie!,
                            fingerTestDelta: useFingerDelta,
                          });
                        } else if (useTarget.cardId === "std.mixer") {
                          sendAction({ type: "USE_INSTALLED_CARD", instanceId: useTarget.instanceId, rerollDieIndices: useRerollIdx });
                        } else if (useTarget.cardId === "adv.darkVault") {
                          sendAction({
                            type: "USE_INSTALLED_CARD",
                            instanceId: useTarget.instanceId,
                            darkVaultTokenCount: useDarkVaultCount,
                          });
                        }
                        setUseTarget(null);
                      }}
                    >
                      使用する
                    </button>
                    <button className="btn" onClick={() => setUseTarget(null)}>キャンセル</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary" disabled={!isMyTurn} onClick={() => sendAction({ type: "END_TURN" })}>
            ターン終了
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>ログ</h2>
        <LogPanel log={game.log} />
      </div>
    </div>
  );
}
