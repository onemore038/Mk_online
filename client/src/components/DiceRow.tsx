import type { GameState } from "@mk-online/shared";

interface Props {
  dice: GameState["dice"];
  selectedIndex: number | null;
  selectable: boolean;
  onSelect: (index: number) => void;
}

export function DiceRow({ dice, selectedIndex, selectable, onSelect }: Props) {
  if (dice.length === 0) return <p className="hint">まだダイスを振っていません</p>;
  return (
    <div className="row">
      {dice.map((d, i) => (
        <div
          key={i}
          className={[
            "die",
            d.used ? "used" : "",
            selectable && !d.used ? "selectable" : "",
            selectedIndex === i ? "selected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => selectable && !d.used && onSelect(i)}
        >
          {d.face}
        </div>
      ))}
    </div>
  );
}

interface MultiProps {
  dice: GameState["dice"];
  selectedIndices: number[];
  onToggle: (index: number) => void;
}

/** 複数のダイスを選択させるための入力（設置コストの出目合計・ミキサーの振り直し対象など）。 */
export function DiceMultiSelect({ dice, selectedIndices, onToggle }: MultiProps) {
  if (dice.length === 0) return <p className="hint">まだダイスを振っていません</p>;
  return (
    <div className="row">
      {dice.map((d, i) => (
        <div
          key={i}
          className={[
            "die",
            d.used ? "used" : "",
            !d.used ? "selectable" : "",
            selectedIndices.includes(i) ? "selected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => !d.used && onToggle(i)}
        >
          {d.face}
        </div>
      ))}
    </div>
  );
}
