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
}

/** C. 設置済みカードの「ターン中1回使用」効果を使う */
export interface UseInstalledCardAction {
  readonly type: "USE_INSTALLED_CARD";
  readonly playerId: string;
  readonly instanceId: string;
}

/** D. レジェンドカード設置（1ターン1回まで） */
export interface PlaceLegendCardAction {
  readonly type: "PLACE_LEGEND_CARD";
  readonly playerId: string;
  readonly cardId: string;
  readonly row: "legend1" | "legend2";
  readonly dieIndices: number[];
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

/** 手番プレイヤーが行動を終え、ターン終了処理へ進む */
export interface EndTurnAction {
  readonly type: "END_TURN";
  readonly playerId: string;
}

/** ターン終了時の手札上限超過分を捨てる */
export interface DiscardToHandLimitAction {
  readonly type: "DISCARD_TO_HAND_LIMIT";
  readonly playerId: string;
  readonly cardIds: string[];
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
  | EndTurnAction
  | DiscardToHandLimitAction;
