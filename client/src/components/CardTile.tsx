import { useEffect, useState } from "react";
import { getMarketCard } from "@mk-online/shared";
import { describeCost, describeVictoryPoints } from "../lib/cardText";

interface Props {
  cardId: string;
  count?: number | undefined;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  selected?: boolean | undefined;
  extra?: string | undefined;
}

export function CardTile({ cardId, count, onClick, disabled, selected, extra }: Props) {
  const card = getMarketCard(cardId);
  const classes = ["card", card.category];
  if (selected) classes.push("selected");
  if (disabled || !onClick) classes.push("disabled");

  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!showDetail) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowDetail(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showDetail]);

  return (
    <div style={{ position: "relative" }}>
      <button
        className={classes.join(" ")}
        onClick={onClick}
        disabled={disabled || !onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowDetail(true);
        }}
      >
        <div className="name">
          {card.name}
          {count && count > 1 ? ` ×${count}` : ""}
        </div>
        <div className="meta">{card.effectSummary}</div>
        {card.cost === null && <div className="meta">（コスト未確認・設置不可）</div>}
        {extra && <div className="meta">{extra}</div>}
      </button>

      {showDetail && (
        <div className="card-detail-backdrop" onClick={() => setShowDetail(false)}>
          <div className="card-detail-popover" onClick={(e) => e.stopPropagation()}>
            <button className="card-detail-close" onClick={() => setShowDetail(false)} aria-label="閉じる">
              ×
            </button>
            <div className="name">
              {card.name}
              {count && count > 1 ? ` ×${count}` : ""}
            </div>
            <p className="hint">{card.effectSummary}</p>
            <p className="hint">VP: {describeVictoryPoints(card)}</p>
            <p className="hint">コスト: {describeCost(card.cost)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
