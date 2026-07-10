import type { PowerType } from "./types.js";

/** ドラフトフェイズ：現在のパケットから1枚キープする */
export interface DraftPickAction {
  readonly type: "DRAFT_PICK";
  readonly playerId: string;
  readonly cardId: string;
}

/** フェイズ1（ターン開始時）の処理をすべて終え、フェイズ2へ進む合図 */
export interface ResolveTurnStartAction {
  readonly type: "RESOLVE_TURN_START";
  readonly playerId: string;
  /** 「金/権/魔のいずれか1種類のパワーを獲得する」ターン開始時能力（コロネリア・ショコラ）の選択。 */
  readonly characterPowerChoice?: PowerType;
  /** 闇市（instanceIdごと）の3択と、power選択時のパワー種別。 */
  readonly blackMarketChoices?: Record<
    string,
    { readonly option: "market" | "diceBread" | "power"; readonly powerType?: PowerType | undefined }
  >;
}

/**
 * A. カード獲得：ダイス1個を払い、場または山札からカードを1枚手札に加える。
 * 場（openMarket）から取る場合はカードを選べる（同名が積んであれば全て獲得）。
 * 山札（deck）から取る場合は中身を見ずに引くため、cardId は不要（サーバー側で決定する）。
 */
export type AcquireCardAction =
  | {
      readonly type: "ACQUIRE_CARD";
      readonly playerId: string;
      readonly dieIndex: number;
      readonly source: "openMarket";
      readonly cardId: string;
    }
  | {
      readonly type: "ACQUIRE_CARD";
      readonly playerId: string;
      readonly dieIndex: number;
      readonly source: "deck";
    };

/** B. カード設置：手札のカードをコストを払って場に出す */
export interface InstallCardAction {
  readonly type: "INSTALL_CARD";
  readonly playerId: string;
  readonly cardId: string;
  readonly dieIndices: number[];
  /**
   * 値切りの指輪の未消費軽減分（pendingBargainRingReduction）をこの設置に充てる場合、
   * どのパワー種別に何点分充てるか（合計は残量以下、かつ各種別はこのカードのコスト以下）。
   */
  readonly bargainRingAllocation?: Partial<Record<PowerType, number>>;
  /**
   * フランの固有能力：手札にある同名カードをもう1枚、無コストで同時設置する場合に指定する
   * （このカードと同じ cardId のカードが手札にもう1枚必要。1ターンに1回まで）。
   */
  readonly flanBonusCopy?: boolean;
}

/** C. 設置済みカードの「ターン中1回使用」効果を使う */
export interface UseInstalledCardAction {
  readonly type: "USE_INSTALLED_CARD";
  readonly playerId: string;
  readonly instanceId: string;
  /** リーン・リッチの魔導書用：出目を変更する対象のダイス番号。 */
  readonly targetDieIndex?: number;
  /** ミキサーの魔導書用：振り直す対象のダイス番号（複数可、0個も可）。 */
  readonly rerollDieIndices?: number[];
  /** フィンガーテストの魔導書用：+1 か -1 か。 */
  readonly fingerTestDelta?: 1 | -1;
  /** 闇金庫用：カードの上に載せる「お金」の数（1〜3）。 */
  readonly darkVaultTokenCount?: number;
}

/** D. レジェンドカード設置（1ターン1回まで） */
export interface PlaceLegendCardAction {
  readonly type: "PLACE_LEGEND_CARD";
  readonly playerId: string;
  readonly cardId: string;
  readonly row: "legend1" | "legend2";
  /**
   * cost.dice（必要数固定）用のダイス指定。
   * cost.requiredPipSum が設定されているカードでは、出目合計に使うダイスの指定として使う
   * （その場合 cost.dice は使われない）。
   */
  readonly dieIndices: number[];
  /** cost.requiredPipSum 用に、出目合計に使う所持サイコロパンのインデックス指定。 */
  readonly diceBreadIndices?: number[];
  /** cost.requiredAnyHandDiscardCount 用に、捨てる手札カードIDを指定する。 */
  readonly anyDiscardCardIds?: string[];
  /** 値切りの指輪の未消費軽減分をこの設置に充てる場合の配分（InstallCardAction 参照）。 */
  readonly bargainRingAllocation?: Partial<Record<PowerType, number>>;
}

/** E. オープンマーケット入替：3種のパワーを1個ずつ払い、場札8種を全て入れ替える */
export interface RefreshMarketAction {
  readonly type: "REFRESH_MARKET";
  readonly playerId: string;
}

/**
 * F. パワー獲得：ダイスまたはサイコロパン1個を払い、対応するパワーを1個得る。
 * ダイスの場合は出目からパワー種別が決まる。サイコロパンは出目を持たないため、
 * 得たいパワー種別を明示的に指定する（万能パン、という扱い）。
 */
export interface GainPowerAction {
  readonly type: "GAIN_POWER";
  readonly playerId: string;
  readonly source:
    | { kind: "die"; dieIndex: number }
    | { kind: "diceBread"; powerType: PowerType };
}

/** G. パワー変換：同種パワー2個を異種パワー1個に変換する */
export interface ConvertPowerAction {
  readonly type: "CONVERT_POWER";
  readonly playerId: string;
  readonly from: PowerType;
  readonly to: PowerType;
}

/**
 * ソフィ専用のターン中行動：手札からマーケットカードを1枚捨て、金/権/魔のいずれか1種類のパワーを1つ得る。
 * 自分のターン中に何度でも使用できる。
 */
export interface SophieDiscardForPowerAction {
  readonly type: "SOPHIE_DISCARD_FOR_POWER";
  readonly playerId: string;
  readonly cardId: string;
  readonly powerType: PowerType;
}

/**
 * ショコラ専用のターン中行動：自分が所有する1つのパワーをパワー置き場に戻し、
 * パワー置き場から別のパワー1つを得る（1:1交換）。自分のターン中に何度でも使用できる。
 */
export interface ChocolatConvertPowerAction {
  readonly type: "CHOCOLAT_CONVERT_POWER";
  readonly playerId: string;
  readonly from: PowerType;
  readonly to: PowerType;
}

/**
 * クロワ専用：ゲーム中1度だけ、自分のターンに何もしない代わりに、オープンマーケットに
 * 並んでいる中から好きなマーケットカードを1枚、一切のコストを支払わずに直接設置する。
 * このターンは他の行動を一切行わず、実行後ただちにターンが終了する。
 */
export interface CroixSkipTurnInstallAction {
  readonly type: "CROIX_SKIP_TURN_INSTALL";
  readonly playerId: string;
  readonly cardId: string;
}

/**
 * 保留中の選択（PendingChoice、GameState参照）を解決する。手番プレイヤーでなくても、
 * 選択の対象者本人であればいつでも実行できる（パネテリア遊園地のカード種別選択、
 * 二ツ星のブレスレット／五ツ星のネックレスの権/魔選択）。
 */
export interface ResolvePendingChoiceAction {
  readonly type: "RESOLVE_PENDING_CHOICE";
  readonly playerId: string;
  readonly choiceId: string;
  /** kind: "paneteriaCardType" 用：獲得したいカードID（現在のオープンマーケットに存在するもの）。 */
  readonly cardId?: string;
  /** kind: "twoStarBraceletPower" | "fiveStarNecklacePower" 用：権力か魔力かの選択。 */
  readonly powerType?: "authority" | "magic";
}

/** 手番プレイヤーが行動を終え、ターン終了処理へ進む */
export interface EndTurnAction {
  readonly type: "END_TURN";
  readonly playerId: string;
}

/**
 * ターン終了時の手札上限超過分を捨てる。
 * 手札上限はマーケットカード（cardIds）とサイコロパンカード（discardDiceBreadCount）の合計に対して適用される。
 */
export interface DiscardToHandLimitAction {
  readonly type: "DISCARD_TO_HAND_LIMIT";
  readonly playerId: string;
  readonly cardIds: string[];
  readonly discardDiceBreadCount?: number;
}

export type GameAction =
  | DraftPickAction
  | ResolveTurnStartAction
  | AcquireCardAction
  | InstallCardAction
  | UseInstalledCardAction
  | PlaceLegendCardAction
  | RefreshMarketAction
  | GainPowerAction
  | ConvertPowerAction
  | SophieDiscardForPowerAction
  | ChocolatConvertPowerAction
  | CroixSkipTurnInstallAction
  | ResolvePendingChoiceAction
  | EndTurnAction
  | DiscardToHandLimitAction;
