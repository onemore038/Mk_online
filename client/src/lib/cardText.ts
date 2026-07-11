import { getMarketCard, type CardCost, type DiceFaceGroup, type MarketCardDefinition } from "@mk-online/shared";

/** 出目条件を人間が読める形式にする（例:「出目1or2を1個、出目5or6を1個」）。 */
export function describeFaceGroups(groups: readonly DiceFaceGroup[] | undefined): string | null {
  if (!groups || groups.length === 0) return null;
  return groups.map((g) => `出目${g.faces.join("or")}を${g.count}個`).join("、");
}

/** 設置コストの全条件を1つの読みやすい文字列にまとめる。 */
export function describeCost(cost: CardCost | null): string {
  if (cost === null) return "コスト未確認";

  const parts: string[] = [];

  if (cost.dice) {
    const faceHint = describeFaceGroups(cost.diceFaceGroups);
    parts.push(`ダイス${cost.dice}個${faceHint ? `（${faceHint}）` : ""}`);
  }
  if (cost.money) parts.push(`お金${cost.money}`);
  if (cost.authority) parts.push(`権力${cost.authority}`);
  if (cost.magic) parts.push(`魔力${cost.magic}`);

  if (cost.requiredDiscards && cost.requiredDiscards.length > 0) {
    const discardText = cost.requiredDiscards
      .map((d) => `${getMarketCard(d.cardId).name}×${d.count}（${d.from === "hand" ? "手札" : "設置済み"}）`)
      .join("、");
    parts.push(`捨て札: ${discardText}`);
  }
  if (cost.requiredDiceBreadCount) parts.push(`サイコロパン${cost.requiredDiceBreadCount}枚`);
  if (cost.requiredAnyHandDiscardCount) parts.push(`手札から任意${cost.requiredAnyHandDiscardCount}枚を捨て札`);
  if (cost.requiredPipSum) parts.push(`出目合計${cost.requiredPipSum}以上`);

  return parts.length > 0 ? parts.join("、") : "コスト無し";
}

/** VP（固定値または計算式）を人間が読める形式にする。 */
export function describeVictoryPoints(card: MarketCardDefinition): string {
  if (card.victoryPoints !== null) return `${card.victoryPoints}VP`;
  if (!card.victoryPointsFormula) return "VP不明";

  const formula = card.victoryPointsFormula;
  switch (formula.kind) {
    case "perInstalledCardCount": {
      const targetName = getMarketCard(formula.cardId).name;
      const baseText = formula.base ? `基本${formula.base}VP + ` : "";
      return `${baseText}[${targetName}]の設置枚数 × ${formula.pointsPerCard}VP（変動）`;
    }
    case "perPowerCostEvery":
      return `自分が設置したカードの${formula.powerType}コスト合計${formula.divisor}につき1VP（変動）`;
    case "tokensOnCard":
      return "カード上に載っているトークンの数がそのままVP（変動）";
  }
}
