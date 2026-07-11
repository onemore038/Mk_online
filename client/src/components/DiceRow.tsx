import { useEffect, useRef, useState } from "react";
import { DIE_FACE_TO_POWER, type DieFace, type GameState } from "@mk-online/shared";

interface Props {
  dice: GameState["dice"];
  selectedIndex: number | null;
  selectable: boolean;
  onSelect: (index: number) => void;
}

/** 出目1〜6を3x3グリッド上のドット位置（行,列）で表す（一般的なサイコロの目のレイアウト）。 */
const PIP_LAYOUT: Record<DieFace, [number, number][]> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  5: [
    [1, 1],
    [1, 3],
    [2, 2],
    [3, 1],
    [3, 3],
  ],
  6: [
    [1, 1],
    [1, 3],
    [2, 1],
    [2, 3],
    [3, 1],
    [3, 3],
  ],
};

function DiePips({ face }: { face: DieFace }) {
  return (
    <>
      {PIP_LAYOUT[face].map(([row, col], i) => (
        <span key={i} className="pip" style={{ gridRow: row, gridColumn: col }} />
      ))}
    </>
  );
}

/** 直前と出目の並びが変わったら true を短時間返す（振り直しアニメーション用）。 */
function useJustRolled(dice: GameState["dice"]): boolean {
  const signature = dice.map((d) => d.face).join(",");
  const prevSignature = useRef<string | null>(null);
  const [justRolled, setJustRolled] = useState(false);

  useEffect(() => {
    if (prevSignature.current !== null && prevSignature.current !== signature && signature !== "") {
      setJustRolled(true);
      const timer = setTimeout(() => setJustRolled(false), 450);
      prevSignature.current = signature;
      return () => clearTimeout(timer);
    }
    prevSignature.current = signature;
    return undefined;
  }, [signature]);

  return justRolled;
}

export function DiceRow({ dice, selectedIndex, selectable, onSelect }: Props) {
  const justRolled = useJustRolled(dice);
  if (dice.length === 0) return <p className="hint">まだダイスを振っていません</p>;
  return (
    <div className="row">
      {dice.map((d, i) => (
        <div
          key={i}
          className={[
            "die",
            DIE_FACE_TO_POWER[d.face],
            d.used ? "used" : "",
            selectable && !d.used ? "selectable" : "",
            selectedIndex === i ? "selected" : "",
            justRolled ? "rolling" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => selectable && !d.used && onSelect(i)}
        >
          <DiePips face={d.face} />
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
            DIE_FACE_TO_POWER[d.face],
            d.used ? "used" : "",
            !d.used ? "selectable" : "",
            selectedIndices.includes(i) ? "selected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => !d.used && onToggle(i)}
        >
          <DiePips face={d.face} />
        </div>
      ))}
    </div>
  );
}
