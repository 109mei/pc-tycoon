/**
 * 種つきの疑似乱数（mulberry32）。内部状態は GameState.rng に持たせ、セーブにもそのまま入る。
 * core では Math.random を使わない。
 */

/** 種から最初の内部状態を作る（近い種でも離れた列になるよう混ぜる） */
export function seedRng(seed: number): number {
  return Math.imul((seed | 0) ^ 0x5bd1e995, 0x9e3779b1) | 0;
}

/** [0, 1) の一様乱数を1つ取り出し、内部状態を進める */
export function nextRandom(holder: { rng: number }): number {
  const a = (holder.rng = (holder.rng + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 平均 1/rate の指数分布（Python の random.expovariate と同じ式） */
export function expovariate(holder: { rng: number }, rate: number): number {
  return -Math.log(1 - nextRandom(holder)) / rate;
}
