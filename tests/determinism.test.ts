import { describe, expect, it } from 'vitest';
import { createState, runPolicy, smartPolicy, step, workHold, type GameState } from '../src/core';
import { balance as bal } from '../src/data';

function play(seed: number, seconds: number): GameState {
  const s = createState(bal, seed);
  runPolicy(s, bal, seconds, smartPolicy());
  return s;
}

describe('同じ種なら同じ結果', () => {
  it('ボットで5分進めた状態が完全に一致する', () => {
    const a = play(42, 300);
    const b = play(42, 300);
    expect(a).toEqual(b);
    expect(a.stats.sold).toBeGreaterThan(0);
    expect(a.workers.length).toBeGreaterThan(0);
  });

  it('種が違えば結果も変わる', () => {
    const a = play(1, 120);
    const b = play(2, 120);
    expect(a.rng).not.toBe(b.rng);
    expect(a).not.toEqual(b);
  });

  it('命令を同じ刻みで渡せば、画面の操作も同じ結果になる', () => {
    const drive = () => {
      const s = createState(bal, 9);
      for (let i = 0; i < 600; i++) {
        if (i === 5) workHold(s, bal, 'dis', true);
        if (i === 200) workHold(s, bal, 'dis', false);
        step(s, bal);
      }
      return s;
    };
    expect(drive()).toEqual(drive());
  });
});
