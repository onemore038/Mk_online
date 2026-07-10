import type { DiceFaceGroup, DieFace } from "../types.js";

/**
 * 選択したダイスの出目一覧が、カードコストの出目グループ条件を満たせるかを判定する。
 * 「各グループを異なるダイスで満たす」という制約があるため、単純な集合の包含判定ではなく
 * 二部グラフの最大マッチング（Kuhnのアルゴリズム）で判定する。
 *
 * groups が未指定なら出目を問わないため常に true。
 * ダイスの個数がグループ合計要求数より少ない場合（マリーの割引適用時など）でも、
 * 提供された出目「全て」をそれぞれ異なるスロットに割り当てられれば true（一部のスロットが
 * 満たされないのは、マリーの割引で不要になった分として許容する）。
 */
export function diceFacesSatisfyGroups(
  faces: readonly DieFace[],
  groups: readonly DiceFaceGroup[] | undefined,
): boolean {
  if (!groups || groups.length === 0) return true;

  const slots: readonly (readonly DieFace[])[] = groups.flatMap((g) => Array.from({ length: g.count }, () => g.faces));
  const slotAssignedDie: (number | null)[] = new Array(slots.length).fill(null);

  function tryAssign(dieIdx: number, visitedSlot: boolean[]): boolean {
    for (let s = 0; s < slots.length; s++) {
      if (visitedSlot[s]) continue;
      if (!slots[s]!.includes(faces[dieIdx]!)) continue;
      visitedSlot[s] = true;
      if (slotAssignedDie[s] === null || tryAssign(slotAssignedDie[s]!, visitedSlot)) {
        slotAssignedDie[s] = dieIdx;
        return true;
      }
    }
    return false;
  }

  for (let i = 0; i < faces.length; i++) {
    const visitedSlot: boolean[] = new Array(slots.length).fill(false);
    if (!tryAssign(i, visitedSlot)) return false;
  }
  return true;
}
