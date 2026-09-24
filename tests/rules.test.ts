import { describe, expect, it } from 'vitest';
import {
  acceptSubcontract,
  buyJunk,
  createState,
  hire,
  moveToWarehouse,
  reassignWorker,
  setAutoBuy,
  setScreen,
  setSubcontractPriority,
  step,
  workHold,
  workTap,
  type GameEvent,
  type GameState,
} from '../src/core';
import { saleNet } from '../src/core/state';
import { drawYield } from '../src/core/tasks';
import { balance as bal } from '../src/data';

/** seconds 秒ぶん刻みを進め、出来事をまとめて返す */
function run(s: GameState, seconds: number): GameEvent[] {
  const out: GameEvent[] = [];
  const n = Math.round(seconds / bal.tickSeconds);
  for (let i = 0; i < n; i++) out.push(...step(s, bal));
  return out;
}

/** 注文も支払いも来ない、止まった世界 */
function quiet(seed = 1): GameState {
  const s = createState(bal, seed);
  s.autoBuy = false;
  s.nextOrderAt = 1e9;
  s.nextPayAt = 1e9;
  s.nextOfferAt = 1e9;
  return s;
}

describe('作業', () => {
  it('分解：ジャンク1台 → 2.5秒で部品1〜4個', () => {
    const s = quiet();
    s.junk = 1;
    expect(workTap(s, bal, 'dis').some((e) => e.type === 'taskStarted')).toBe(true);
    expect(s.junk).toBe(0);
    run(s, 2.4);
    expect(s.parts).toBe(0);
    run(s, 0.1);
    expect(s.parts).toBeGreaterThanOrEqual(1);
    expect(s.parts).toBeLessThanOrEqual(4);
  });

  it('部品の数の分布は balance の確率どおり（平均2.4個）', () => {
    const s = quiet(7);
    const counts = [0, 0, 0, 0, 0];
    const N = 20000;
    for (let i = 0; i < N; i++) counts[drawYield(s, bal)]! += 1;
    for (const row of bal.junk.partsYield) {
      expect(counts[row.parts]! / N).toBeCloseTo(row.probability, 1);
    }
  });

  it('組み立て：部品4個 → 4秒で完成品1台。材料は始めた時点で取る', () => {
    const s = quiet();
    setScreen(s, 'asm');
    s.parts = 5;
    workTap(s, bal, 'asm');
    expect(s.parts).toBe(1);
    run(s, 3.9);
    expect(s.pcs).toBe(0);
    run(s, 0.1);
    expect(s.pcs).toBe(1);
  });

  it('発送：完成品1台と注文1件 → 1.5秒で 16,320円', () => {
    const s = quiet();
    setScreen(s, 'ship');
    s.pcs = 1;
    s.orders.push({ id: 99, arrivedAt: 0 });
    const cash = s.cash;
    workTap(s, bal, 'ship');
    expect(s.orders.length).toBe(0);
    run(s, 1.5);
    expect(saleNet(bal)).toBe(16320);
    expect(s.cash).toBe(cash + 16320);
    expect(s.stats.sold).toBe(1);
  });

  it('今いる画面の列の作業しかできない', () => {
    const s = quiet();
    s.junk = 1;
    setScreen(s, 'asm');
    expect(workTap(s, bal, 'dis')).toEqual([]);
    expect(s.junk).toBe(1);
  });

  it('長押しは材料がある限り続け、画面を移ると作業中の分は完了して次は始めない', () => {
    const s = quiet();
    s.junk = 3;
    workHold(s, bal, 'dis', true);
    // 1台目は2.5秒で終わり、次の刻みで2台目を始める
    run(s, 2.6);
    expect(s.junk).toBe(1);
    expect(s.player.task).not.toBeNull();
    setScreen(s, 'asm');
    expect(s.player.holding).toBe(false);
    run(s, 5);
    expect(s.junk).toBe(1);
    expect(s.player.task).toBeNull();
    expect(s.stats.disassembled).toBe(2);
  });

  it('アルバイトは自分の0.9倍の速さで、材料がある限り続ける。自分と並行して作業する', () => {
    const s = quiet();
    s.cash = 1e6;
    s.junk = 10;
    hire(s, bal, 'dis');
    workHold(s, bal, 'dis', true);
    run(s, 2.5);
    expect(s.stats.disassembled).toBe(1);
    run(s, 0.3);
    expect(s.stats.disassembled).toBe(2);
  });
});

describe('仕入れ', () => {
  it('手動：所持金が足りる分だけ買う', () => {
    const s = quiet();
    s.cash = 10000;
    buyJunk(s, bal, 5);
    expect(s.junk).toBe(3);
    expect(s.cash).toBe(1000);
  });

  it('自動：ジャンクが2台未満なら、次の支払い額を残せる分だけ買う', () => {
    const s = quiet();
    setAutoBuy(s, true);
    s.cash = 10000;
    run(s, 0.1);
    expect(s.junk).toBe(2);
    expect(s.cash).toBe(4000);
  });

  it('自動：部品12個以上か完成品3台以上なら止まる', () => {
    const s = quiet();
    setAutoBuy(s, true);
    s.parts = 12;
    run(s, 0.1);
    expect(s.junk).toBe(0);
    s.parts = 0;
    s.pcs = 3;
    run(s, 0.1);
    expect(s.junk).toBe(0);
  });

  it('自動：作業が止まっているときは取り置きを崩して1台買う', () => {
    const s = quiet();
    setAutoBuy(s, true);
    s.cash = 3500;
    run(s, 0.1);
    expect(s.junk).toBe(1);
    expect(s.cash).toBe(500);
  });
});

describe('注文', () => {
  it('15秒以内に発送が始まらないと失われる', () => {
    const s = quiet();
    s.orders.push({ id: 1, arrivedAt: 0 });
    run(s, 15);
    expect(s.orders.length).toBe(1);
    run(s, 0.1);
    expect(s.orders.length).toBe(0);
    expect(s.stats.ordersLost).toBe(1);
  });

  it('届く間隔の平均は 7秒（売った台数で増える）', () => {
    const s = createState(bal, 3);
    s.autoBuy = false;
    s.nextPayAt = 1e9;
    s.nextOfferAt = 1e9;
    let arrived = 0;
    const seconds = 7000;
    for (const e of run(s, seconds)) if (e.type === 'orderArrived') arrived += 1;
    expect(seconds / arrived).toBeGreaterThan(6.5);
    expect(seconds / arrived).toBeLessThan(7.5);
  });

  it('発送は古い注文から当てる', () => {
    const s = quiet();
    setScreen(s, 'ship');
    s.pcs = 1;
    s.orders.push({ id: 1, arrivedAt: 0 }, { id: 2, arrivedAt: 0.05 });
    workTap(s, bal, 'ship');
    expect(s.orders.map((o) => o.id)).toEqual([2]);
  });
});

describe('支払い', () => {
  it('60秒ごとに電気代＋給料×人数', () => {
    const s = createState(bal, 1);
    s.autoBuy = false;
    s.nextOrderAt = 1e9;
    s.nextOfferAt = 1e9;
    s.cash = 100000;
    hire(s, bal, 'asm');
    run(s, 59.9);
    expect(s.cash).toBe(40000);
    run(s, 0.1);
    expect(s.cash).toBe(40000 - 1500 - 12000);
  });

  it('払えなければ30秒の猶予。戻らなければ倒産、戻れば解除', () => {
    const s = createState(bal, 1);
    s.autoBuy = false;
    s.nextOrderAt = 1e9;
    s.nextOfferAt = 1e9;
    s.cash = 1000;
    run(s, 60);
    expect(s.cash).toBe(-500);
    expect(s.graceUntil).toBeCloseTo(90, 5);
    run(s, 29.9);
    expect(s.status).toBe('playing');
    run(s, 0.1);
    expect(s.status).toBe('bankrupt');

    const r = createState(bal, 1);
    r.autoBuy = false;
    r.nextOrderAt = 1e9;
    r.nextOfferAt = 1e9;
    r.cash = 1000;
    run(r, 60);
    r.cash += 600;
    run(r, 0.1);
    expect(r.graceUntil).toBeNull();
    run(r, 40);
    expect(r.status).toBe('playing');
  });
});

describe('アルバイト', () => {
  it('雇用費60,000円、段階1は2人まで、所持金が足りなければ雇えない', () => {
    const s = quiet();
    s.cash = 59999;
    expect(hire(s, bal, 'asm')).toEqual([]);
    s.cash = 200000;
    hire(s, bal, 'asm');
    hire(s, bal, 'dis');
    hire(s, bal, 'ship');
    expect(s.workers.length).toBe(2);
    expect(s.cash).toBe(80000);
  });

  it('担当の列を変えられる（作業中の分は元の列で完了する）', () => {
    const s = quiet();
    s.cash = 100000;
    s.junk = 5;
    hire(s, bal, 'dis');
    run(s, 0.1);
    const id = s.workers[0]!.id;
    reassignWorker(s, id, 'ship');
    run(s, 3);
    expect(s.stats.disassembled).toBe(1);
    expect(s.junk).toBe(4);
  });

  it('制作のアルバイトは、優先OFFでも部品がなくキットがあればキットを使う', () => {
    const s = quiet();
    s.cash = 100000;
    s.nextOfferAt = 0.1;
    run(s, 0.1);
    acceptSubcontract(s, bal);
    hire(s, bal, 'asm');
    run(s, 0.1);
    expect(s.sub!.kits).toBe(5);
    expect(s.workers[0]!.task!.kit).toBe(true);
  });

  it('「下請けを優先」ONなら部品があってもキットを使う', () => {
    const s = quiet();
    s.cash = 100000;
    s.parts = 8;
    s.nextOfferAt = 0.1;
    run(s, 0.1);
    acceptSubcontract(s, bal);
    setSubcontractPriority(s, true);
    setScreen(s, 'asm');
    workTap(s, bal, 'asm');
    expect(s.player.task!.kit).toBe(true);
    expect(s.parts).toBe(8);
  });
});

describe('下請け', () => {
  it('45秒後に依頼、20秒で消える。受けていなければ75秒ごと', () => {
    const s = createState(bal, 1);
    s.autoBuy = false;
    s.nextOrderAt = 1e9;
    s.nextPayAt = 1e9;
    run(s, 44.9);
    expect(s.offer).toBeNull();
    run(s, 0.1);
    expect(s.offer).not.toBeNull();
    run(s, 20);
    expect(s.offer).toBeNull();
    run(s, 54.9);
    expect(s.offer).toBeNull();
    run(s, 0.1);
    expect(s.offer).not.toBeNull();
  });

  it('受けるとキット6台分・納期90秒。1台4,000円。残りは1台4,000円の違約金', () => {
    const s = quiet();
    s.cash = 50000;
    s.nextOfferAt = 0.1;
    run(s, 0.1);
    acceptSubcontract(s, bal);
    expect(s.sub).toMatchObject({ kits: 6, left: 6 });
    setScreen(s, 'asm');
    workTap(s, bal, 'asm');
    run(s, 4);
    expect(s.cash).toBe(54000);
    expect(s.sub!.left).toBe(5);
    run(s, 86);
    expect(s.sub).toBeNull();
    expect(s.cash).toBe(54000 - 5 * 4000);
    expect(s.stats.subsFailed).toBe(1);
  });

  it('受けている下請けがあるときは依頼が来ない', () => {
    const s = quiet();
    s.cash = 50000;
    s.nextOfferAt = 0.1;
    run(s, 0.1);
    acceptSubcontract(s, bal);
    s.nextOfferAt = s.t + 0.1;
    run(s, 0.1);
    expect(s.offer).toBeNull();
  });
});

describe('詰まりの判定', () => {
  it('制作：部品÷4−1 が1以上の状態が3秒続くと表示する', () => {
    const s = quiet();
    s.parts = 8;
    run(s, 2.9);
    expect(s.bottleneck.shown).toBeNull();
    run(s, 0.2);
    expect(s.bottleneck.shown).toBe('asm');
  });

  it('生産：制作に手があるのに組み立てを始められない秒数÷3', () => {
    const s = quiet();
    setScreen(s, 'asm');
    run(s, 3);
    expect(s.bottleneck.starvedSeconds).toBeCloseTo(3, 5);
    run(s, 3.1);
    expect(s.bottleneck.shown).toBe('dis');
  });

  it('販売：完成品−1。待っている注文の数は使わない', () => {
    const s = quiet();
    s.pcs = 3;
    s.orders.push({ id: 1, arrivedAt: 0 });
    run(s, 3.1);
    expect(s.bottleneck.shown).toBe('ship');
  });
});

describe('クリア', () => {
  it('所持金が40万円に届いたら貸し倉庫へ移れる', () => {
    const s = quiet();
    expect(moveToWarehouse(s, bal)).toEqual([]);
    s.cash = 400000;
    run(s, 0.1);
    expect(s.stats.clearReachedAt).not.toBeNull();
    moveToWarehouse(s, bal);
    expect(s.status).toBe('cleared');
  });
});
