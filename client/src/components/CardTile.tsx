import { getMarketCard } from "@mk-online/shared";

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
  const classes = ["card"];
  if (selected) classes.push("selected");
  if (disabled || !onClick) classes.push("disabled");

  return (
    <button className={classes.join(" ")} onClick={onClick} disabled={disabled || !onClick}>
      <div className="name">
        {card.name}
        {count && count > 1 ? ` ×${count}` : ""}
      </div>
      <div className="meta">{card.effectSummary}</div>
      {card.cost === null && <div className="meta">（コスト未確認・設置不可）</div>}
      {extra && <div className="meta">{extra}</div>}
    </button>
  );
}
