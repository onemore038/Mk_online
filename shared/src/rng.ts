import type { DieFace } from "./types.js";

/** テストで再現可能な乱数と、本番用の暗号学的乱数を同じインターフェースで扱う。 */
export interface Rng {
  /** [0, 1) の浮動小数点数を返す */
  next(): number;
}

/** mulberry32: シード可能な軽量PRNG。テスト・リプレイ用。 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** 本番用：Web Crypto の乱数を使う（Node.js / ブラウザ双方で利用可能）。 */
export function createCryptoRng(): Rng {
  return {
    next(): number {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0]! / 4294967296;
    },
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

export function rollDie(rng: Rng): DieFace {
  return (Math.floor(rng.next() * 6) + 1) as DieFace;
}

export function pickRandom<T>(items: readonly T[], count: number, rng: Rng): T[] {
  return shuffle(items, rng).slice(0, count);
}
