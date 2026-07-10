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

/** 公式ルールブックPDFで確認済み（1・2→お金／3・4→権力／5・6→魔力）。 */
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

/**
 * 設置コストの一部として「特定カードを1枚ずつ捨て札にする」ことを要求するもの
 * （例: レジェンドⅡの多くはサイコロ・パワーを使わずこの形式で設置する）。
 */
export interface RequiredDiscard {
  readonly cardId: string;
  readonly count: number;
  /** どこから捨てるか。"hand"＝手札から、"installed"＝自分の設置済みカードから。 */
  readonly from: "hand" | "installed";
}

/**
 * ダイスコストのうち、特定の出目を要求するグループ。
 * 例: { faces: [1, 2], count: 2 } は「出目1or2のダイスを2個」。
 * 1枚のカードが複数グループを持つ場合（例: 出目1を1個・出目6を1個）、
 * 各グループは異なるダイスで満たす必要がある（同じダイスを2グループに使い回せない）。
 */
export interface DiceFaceGroup {
  readonly faces: readonly DieFace[];
  readonly count: number;
}

/** カードのコスト。数値未確認の間は null。 */
export interface CardCost {
  readonly dice?: number;
  readonly money?: number;
  readonly authority?: number;
  readonly magic?: number;
  /**
   * dice で要求される出目の内訳。未指定の場合、dice 個のダイスはどの出目でもよい
   * （例: 倉庫・パネテリア遊園地）。指定がある場合、各グループの count 合計が dice と一致する。
   */
  readonly diceFaceGroups?: readonly DiceFaceGroup[];
  /** dice/money/authority/magic に加えて（またはその代わりに）要求される捨て札条件。 */
  readonly requiredDiscards?: readonly RequiredDiscard[];
  /** 手札のサイコロパンカードを指定枚数（目は問わない）捨てることを要求する。 */
  readonly requiredDiceBreadCount?: number;
  /** 手札のマーケットカードを、種類を問わず指定枚数捨てることを要求する（どのカードを捨てるかはプレイヤーが選ぶ）。 */
  readonly requiredAnyHandDiscardCount?: number;
  /**
   * このターンに振ったサイコロと所持サイコロパンの出目合計が、この値以上になるよう
   * 使用（消費）することを要求する（例: 無限鏡の大迷宮＝36）。
   */
  readonly requiredPipSum?: number;
}

/**
 * 盤面状況に応じて動的に決まるVPの計算方法。
 * `victoryPoints` が null で、かつこのフィールドがあるカードは「固定VPではなく計算式で決まる」ことを表す。
 */
export type VictoryPointsFormula =
  /** 指定したカード（自分自身であることが多い）の自分の設置枚数 × pointsPerCard（+ base）。 */
  | {
      readonly kind: "perInstalledCardCount";
      readonly cardId: string;
      readonly pointsPerCard: number;
      readonly base?: number;
    }
  /** 自分が設置したマーケットカード・レジェンドカードの、指定パワー種のコスト合計を divisor で割った数（端数切り捨て）。 */
  | {
      readonly kind: "perPowerCostEvery";
      readonly powerType: PowerType;
      readonly divisor: number;
    }
  /** カード上に置かれたトークン（パワー等）の数がそのままVPになる。トークン管理は別途状態拡張が必要（未実装）。 */
  | { readonly kind: "tokensOnCard" };

/** カード1種類の静的定義（マスタデータ）。プレイ中に変化しない。 */
export interface MarketCardDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: Exclude<CardCategory, "character">;
  /** 公式数値が未確認の場合は null */
  readonly cost: CardCost | null;
  /** 固定VPが未確認、または動的に決まる（victoryPointsFormula参照）場合は null */
  readonly victoryPoints: number | null;
  /** victoryPoints が null のカードのうち、計算式が判明しているものに設定する。 */
  readonly victoryPointsFormula?: VictoryPointsFormula;
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

/**
 * レジェンドⅠ・Ⅱ1列分の対応関係。
 * 公式ルール上、Ⅱは対応するⅠが誰かに設置されるまで設置できない
 * （Ⅰが設置されたら、隣接するⅡが元のⅠの場所に配置され設置可能になる）。
 */
export interface LegendColumn {
  readonly legend1Id: string;
  readonly legend2Id: string;
}

/** 場に設置されたカードのインスタンス状態。 */
export interface InstalledCard {
  readonly instanceId: string;
  readonly cardId: string;
  /** このターンに設置されたばかりで、まだ効果を使用できない状態か */
  installedThisTurn: boolean;
  /** 「ターン中1回使用」効果を、このターン既に使ったか */
  usedThisTurn: boolean;
  /** 闇金庫用：カードの上に置かれた「お金」トークンの数（victoryPointsFormula: tokensOnCard で参照）。 */
  tokens?: number;
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
  /**
   * 所持しているサイコロパンカードの出目一覧（1枚＝配列1要素）。
   * 「奇跡のサイコロパン（Any）」のような特殊札はドロー処理が未実装のため今のところ生成されず、
   * 通常のダイス目（1〜6）のみが入る。
   */
  diceBreadCards: readonly DieFace[];
  connected: boolean;
  /** 値切りの指輪の使用効果：次に設置するカードに充てられる未消費のパワー軽減残量（最大3）。 */
  pendingBargainRingReduction?: number | undefined;
  /** フランの固有能力（同名カード2枚同時設置）を、このターンに既に使ったか。 */
  flanBonusUsedThisTurn?: boolean;
  /** クロワの固有能力（ゲーム中1度だけのターンスキップ直接設置）を、ゲーム中に既に使ったか。 */
  croixSkipAbilityUsed?: boolean;
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

/**
 * 「他プレイヤーの選択」が必要な効果（パネテリア遊園地のカード種別選択、二ツ星のブレスレット／
 * 五ツ星のネックレスの権/魔選択）を、選択が必要な本人が後から RESOLVE_PENDING_CHOICE で
 * 解決できるようにするためのキュー。applyAction は単一アクションから同期的に次状態を返す
 * 純関数のため、行動者本人ではない「他プレイヤーの選択」はこの形で保留し、ターン進行は
 * ブロックしない（選択が解決されないまま放置されても、他の操作には影響しない）。
 */
export interface PendingChoice {
  readonly id: string;
  /** この選択を行うべきプレイヤー。 */
  readonly playerId: string;
  readonly kind: "paneteriaCardType" | "twoStarBraceletPower" | "fiveStarNecklacePower";
  /** twoStarBraceletPower／fiveStarNecklacePower 用：解決時に付与するパワーの個数。 */
  readonly amount?: number;
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

  /**
   * レジェンドⅠ・Ⅱの対応関係（3列）。ゲーム開始時に決定され、以後変化しない。
   * 各列のⅡは、対応するⅠが誰かに設置されるまで設置できない。
   */
  legendColumns: readonly LegendColumn[];
  /** 現在設置可能なレジェンドⅠ（まだ誰にも設置されていないもの）。 */
  legend1Row: string[];
  /** 現在設置可能なレジェンドⅡ（対応するⅠが設置済みで、かつ自身がまだ未設置のもの）。 */
  legend2Row: string[];
  /** 手番プレイヤーが今ターンに既にレジェンドカードを設置したか */
  legendPlacedThisTurn: boolean;

  diceBreadDeckCount: number;
  diceBreadDiscardCount: number;

  turnNumber: number;
  /** 誰かが20VP以上に到達した時点のプレイヤーID。以降は最終周回に入る。 */
  finalRoundTriggeredBy: string | null;
  winnerIds: string[] | null;

  /** 他プレイヤーの選択待ちキュー（PendingChoice参照）。 */
  pendingChoices: readonly PendingChoice[];

  log: GameEvent[];
}
