import { describe, expect, it } from 'vitest';
import {
  cloneState,
  createState,
  hire,
  nextBill,
  reassignWorker,
  returnFromAway,
  runPolicy,
  setScreen,
  simulateAway,
  smartPolicy,
  step,
  PART_TYPES,
  type GameState,
} from '../src/core';
import { balance as bal } from '../src/data';

/** ボットでしばらく遊び、アルバイトが2人いる状態を作る */
function midGame(seed: number): GameState {
  const s = createState(bal, seed);
  runPolicy(s, bal, 200, smartPolicy());
  s.cash += 1_000_000;
  while (s.workers.length < bal.workers.maxCount) hire(s, bal, 'asm');
  // 制作と販売に1人ずつ。部品を多めに渡しておき、組み立て→発送→入金が不在中も回るようにする
  // （不在中の稼ぎで支払いが払えないと、不在の進行ではアルバイトが休み、実際の進行とは決まりが分かれる）
  reassignWorker(s, s.workers[0]!.id, 'asm');
  reassignWorker(s, s.workers[1]!.id, 'ship');
  for (const t of PART_TYPES) s.parts[t] += 300;
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
      const sum = simulateAway(away, bal, seconds);
      expect(away).toEqual(online);
      expect(sum.workersRested).toBe(false);
      expect(sum.paid).toBeGreaterThan(0);
      expect(away.stats.sold).toBeGreaterThan(base.stats.sold);
      expect(away.stats.ordersArrived).toBeGreaterThan(base.stats.ordersArrived);
    }
  });

  it('稼ぎで支払いが払えている間は、何回かに分けて閉じても、まとめて閉じたのと同じになる', () => {
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
    // 稼ぎのない形：部品も完成品もなく、所持金は支払い1回分に足りない
    const s = midGame(6);
    for (const t of PART_TYPES) s.parts[t] = 0;
    s.pcs = 0;
    s.junk = 0;
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

  it('長く閉じていても、支払いで減る所持金は閉じたときから支払い1回分まで（戻ったら続けられる）', () => {
    // 始めたばかりで閉じる
    const s = createState(bal, 11);
    s.autoBuy = false;
    const before = s.cash;
    const bill = nextBill(s, bal);
    const sum = simulateAway(s, bal, bal.save.offlineMaxSeconds);
    expect(s.cash).toBe(Math.max(0, before - bill));
    expect(sum.paid).toBe(before - s.cash);

    // 稼ぎのない形で2人雇ったまま閉じる：1回目は給料まで払い、2回目からはアルバイトが休む
    const m = midGame(12);
    reassignWorker(m, m.workers[0]!.id, 'dis');
    reassignWorker(m, m.workers[1]!.id, 'asm');
    for (const t of PART_TYPES) m.parts[t] = 0;
    m.junk = 0;
    m.pcs = 0;
    m.autoBuy = false;
    const mBefore = m.cash;
    const mBill = nextBill(m, bal);
    const mSum = simulateAway(m, bal, bal.save.offlineMaxSeconds);
    expect(m.cash).toBe(mBefore - mBill);
    expect(mSum.workersRested).toBe(true);
    expect(m.status).toBe('playing');
  });

  it('不在中は自分の手が動かない', () => {
    const s = createState(bal, 8);
    s.junk = 5;
    s.player.holding = true;
    simulateAway(s, bal, 60);
    expect(s.stats.disassembled).toBe(0);
  });
});
