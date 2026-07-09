/**
 * ゲーム全体で共有される型定義。
 *
 * 数値（カードのコスト・VP・ダイス目とパワーの対応表など）のうち
 * 公式資料で確認できていないものは `null` または TODO コメントを付けている。
 * 実装を進める際は物理カード／公式ルールブックで数値を確認してから埋めること。
 */

export type PowerType = "money" | "authority" | "magic";

export const POWER_TYPES: readonly PowerType[] = ["money", "authority", "magic"];

export type PowerPool = Record<PowerType, number>;

export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * TODO(要確認): サイコロの出目とパワー種別の対応関係が未確認。
 * 「出目に対応するパワーチップ1枚を取る」というFAQ記述はあるが、
 * 6面のダイスと3種のパワーがどう対応するのか（2面ずつ？ダイス自体が色分けされている？）は
 * 物理コンポーネントを見ないと確定できない。ここでは暫定的に2面ずつの対応にしている。
 */
export const DIE_FACE_TO_POWER: Readonly<Record<DieFace, PowerType>> = {
  1: "money",
  2: "money",
  3: "authority",
  4: "authority",
  5: "magic",
  6: "magic",
};

export type CardCategory =
  | "character"
  | "standard"
  | "advance"
  | "legend1"
  | "legend2";

/** カードのコスト。数値未確認の間は null。 */
export interface CardCost {
  readonly dice?: number;
  readonly money?: number;
  readonly authority?: number;
  readonly magic?: number;
}

/** カード1種類の静的定義（マスタデータ）。プレイ中に変化しない。 */
export interface MarketCardDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: Exclude<CardCategory, "character">;
  /** 公式数値が未確認の場合は null */
  readonly cost: CardCost | null;
  /** 公式数値が未確認の場合は null */
  readonly victoryPoints: number | null;
  /** 人間が読める効果概要（プレイ確認用）。プログラム的な効果は effect に別途実装する。 */
  readonly effectSummary: string;
  /** カード固有効果の有無。未実装のカードは false。 */
  readonly hasProgrammaticEffect: boolean;
}

export interface CharacterDefinition {
  readonly id: string;
  readonly name: string;
  /** 通常3。コロネリアなど例外はここで上書きする。 */
  readonly diceCount: number;
  readonly abilitySummary: string;
  readonly hasProgrammaticEffect: boolean;
}

/** 場に設置されたカードのインスタンス状態。 */
export interface InstalledCard {
  readonly instanceId: string;
  readonly cardId: string;
  /** このターンに設置されたばかりで、まだ効果を使用できない状態か */
  installedThisTurn: boolean;
  /** 「ターン中1回使用」効果を、このターン既に使ったか */
  usedThisTurn: boolean;
}

export interface PlayerState {
  readonly playerId: string;
  readonly nickname: string;
  readonly characterId: string;
  power: PowerPool;
  /** 手札（マーケットカードのカードIDのリスト。同名複数可） */
  hand: string[];
  handLimit: number;
  installed: InstalledCard[];
  victoryPoints: number;
  diceBreadCards: number;
  connected: boolean;
}

export type GamePhase =
  /** 開始時のスタンダードカード・ドラフト中 */
  | "draft"
  /** 手番プレイヤーのターン開始時効果処理中 */
  | "turnStart"
  /** 手番プレイヤーがダイスを振ってA〜Gの行動を行うフェイズ */
  | "turnActions"
  /** 手番プレイヤーのターン終了処理中 */
  | "turnEnd"
  | "gameOver";

export interface DraftState {
  /** 現在のラウンド（0始まり、全3ラウンド） */
  round: number;
  /** プレイヤーIDごとに、現在手元にあるパケット（カードIDの配列） */
  packets: Record<string, string[]>;
  /** このラウンドで、まだピックしていないプレイヤーID */
  pendingPicks: string[];
}

export interface GameEvent {
  readonly turn: number;
  readonly playerId: string | null;
  readonly type: string;
  readonly detail: string;
}

export interface GameState {
  readonly roomId: string;
  readonly playerOrder: string[];
  players: Record<string, PlayerState>;
  currentPlayerIndex: number;
  phase: GamePhase;
  draft: DraftState | null;

  /** 現在のターンで振っているダイスの目。使用済みかどうかを合わせて管理する。 */
  dice: { face: DieFace; used: boolean }[];

  /** オープンマーケット（場札）。カードIDのリスト。同名カードのスタックを許容する。 */
  openMarket: string[];
  marketDeck: string[];
  marketDiscard: string[];

  legend1Row: string[];
  legend1Deck: string[];
  legend2Row: string[];
  legend2Deck: string[];
  /** 手番プレイヤーが今ターンに既にレジェンドカードを設置したか */
  legendPlacedThisTurn: boolean;

  diceBreadDeckCount: number;
  diceBreadDiscardCount: number;

  turnNumber: number;
  /** 誰かが20VP以上に到達した時点のプレイヤーID。以降は最終周回に入る。 */
  finalRoundTriggeredBy: string | null;
  winnerIds: string[] | null;

  log: GameEvent[];
}
