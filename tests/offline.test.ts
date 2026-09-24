import { describe, expect, it } from 'vitest';
import {
  cloneState,
  createState,
  hire,
  reassignWorker,
  returnFromAway,
  runPolicy,
  setScreen,
  simulateAway,
  smartPolicy,
  step,
  type GameState,
} from '../src/core';
import { balance as bal } from '../src/data';

/** ボットでしばらく遊び、アルバイトが2人いる状態を作る */
function midGame(seed: number): GameState {
  const s = createState(bal, seed);
  runPolicy(s, bal, 200, smartPolicy());
  // 比べる間に支払いで困らない額（困ると、実際の進行は猶予、不在の進行は休みと、決まりが分かれる）
  s.cash += 1_000_000;
  while (s.workers.length < bal.workers.maxCount) hire(s, bal, 'asm');
  // 制作と販売に1人ずつ。部品を渡しておき、組み立て→発送→入金が不在中も回るようにする
  reassignWorker(s, s.workers[0]!.id, 'asm');
  reassignWorker(s, s.workers[1]!.id, 'ship');
  s.parts += 40;
  // 自分の手は動かさない（長押しなし・作業なし）。制作の画面にいないので「手」としても数えない
  s.player.holding = false;
  s.player.task = null;
  setScreen(s, 'ship');
  return s;
}

describe('閉じていた間の進行', () => {
  it('まとめて計算した結果が、同じ時間を実際に進めた結果と一致する（自分の手を動かさない条件で）', () => {
    for (const seed of [1, 2, 3]) {
      const base = midGame(seed);
      const online = cloneState(base);
      const seconds = 900;
      for (let i = 0; i < Math.round(seconds / bal.tickSeconds); i++) step(online, bal);
      const away = cloneState(base);
      simulateAway(away, bal, seconds);
      expect(away).toEqual(online);
      expect(away.stats.sold).toBeGreaterThan(base.stats.sold);
      expect(away.stats.ordersLost).toBeGreaterThan(base.stats.ordersLost);
    }
  });

  it('何回かに分けて閉じても、まとめて閉じたのと同じになる', () => {
    const a = midGame(5);
    const b = cloneState(a);
    simulateAway(a, bal, 600);
    simulateAway(b, bal, 250);
    simulateAway(b, bal, 350);
    expect(b).toEqual(a);
  });

  it('上限は2時間', () => {
    const s = midGame(4);
    const t0 = s.t;
    const sum = simulateAway(s, bal, 5 * 3600);
    expect(sum.requestedSeconds).toBe(5 * 3600);
    expect(s.t - t0).toBeCloseTo(bal.save.offlineMaxSeconds, 5);
  });

  it('不在中は倒産させない。払えないときはアルバイトを休ませ、戻ったら休みを解く', () => {
    const s = midGame(6);
    s.cash = 20000;
    s.autoBuy = false;
    const sum = simulateAway(s, bal, 3600);
    expect(s.status).toBe('playing');
    expect(s.cash).toBeGreaterThanOrEqual(0);
    expect(sum.workersRested).toBe(true);
    expect(s.workers.every((w) => w.resting)).toBe(true);
    returnFromAway(s, bal);
    expect(s.workers.every((w) => !w.resting)).toBe(true);
  });

  it('不在中は自分の手が動かない', () => {
    const s = createState(bal, 8);
    s.junk = 5;
    s.player.holding = true;
    simulateAway(s, bal, 60);
    expect(s.stats.disassembled).toBe(0);
  });
});
