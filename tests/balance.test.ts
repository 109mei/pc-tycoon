import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BalanceSchema, GameDataSchema } from '../src/data/schema';

const stage1 = JSON.parse(readFileSync(new URL('../docs/balance.stage1.json', import.meta.url), 'utf8'));
const game = JSON.parse(readFileSync(new URL('../src/data/balance.json', import.meta.url), 'utf8'));

describe('数値（balance）', () => {
  it('docs/balance.stage1.json が Zod の検査を通る', () => {
    expect(() => BalanceSchema.parse(stage1)).not.toThrow();
  });

  it('src/data/balance.json が Zod の検査を通る', () => {
    expect(() => GameDataSchema.parse(game)).not.toThrow();
  });

  it('src/data/balance.json は元の数値を変えていない（足した項目のほかは同じ）', () => {
    const shared = Object.fromEntries(Object.keys(stage1).map((k) => [k, game[k]]));
    expect(shared).toEqual(stage1);
  });

  it('おかしな数値は検査で落ちる', () => {
    const bad = structuredClone(stage1);
    bad.junk.partsYield[0].probability = 0.5;
    expect(() => BalanceSchema.parse(bad)).toThrow();
    const bad2 = structuredClone(stage1);
    bad2.tickSeconds = -1;
    expect(() => BalanceSchema.parse(bad2)).toThrow();
  });
});
