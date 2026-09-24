import { describe, expect, it } from 'vitest';
import {
  acceptSubcontract,
  buyJunk,
  buyMissingParts,
  createState,
  hire,
  moveToWarehouse,
  orderRate,
  reassignWorker,
  returnFromAway,
  setAutoBuy,
  setPriceLevel,
  setScreen,
  setSubcontractPriority,
  setsOf,
  step,
  workHold,
  workTap,
  type GameEvent,
  type GameState,
  type Parts,
} from '../src/core';
import { saleNet } from '../src/core/state';
import { inspect } from '../src/core/tasks';
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

function parts(n: number, over: Partial<Parts> = {}): Parts {
  return { board: n, memory: n, storage: n, power: n, ...over };
}

const DEFAULT_PRICE = bal.market.priceLevels[bal.market.defaultLevel]!.price;

describe('作業', () => {
  it('分解：ジャンク1台 → 2.5秒で4種類を検品し、使える部品だけ増える', () => {
    const s = quiet();
    s.junk = 1;
    expect(workTap(s, bal, 'dis').some((e) => e.type === 'taskStarted')).toBe(true);
    expect(s.junk).toBe(0);
    run(s, 2.4);
    expect(s.stats.disassembled).toBe(0);
    const ev = run(s, 0.1);
    const done = ev.find((e) => e.type === 'disassembled');
    expect(done).toBeDefined();
    if (done?.type !== 'disassembled') return;
    expect(done.good.length + done.broken.length).toBe(4);
    for (const t of done.good) expect(s.parts[t]).toBe(1);
    for (const t of done.broken) expect(s.parts[t]).toBe(0);
    expect(s.stats.brokenParts).toBe(done.broken.length);
  });

  it('検品で使える確率は種類ごとに balance のとおり', () => {
    const s = quiet(7);
    const good = { board: 0, memory: 0, storage: 0, power: 0 };
    const N = 20000;
    for (let i = 0; i < N; i++) for (const t of inspect(s, bal).good) good[t] += 1;
    for (const t of ['board', 'memory', 'storage', 'power'] as const) {
      expect(good[t] / N).toBeCloseTo(bal.junk.goodRate[t], 1);
    }
  });

  it('組み立て：4種類を1個ずつ使って、4秒で完成品1台', () => {
    const s = quiet();
    setScreen(s, 'asm');
    s.parts = parts(1, { memory: 3 });
    workTap(s, bal, 'asm');
    expect(s.parts).toEqual(parts(0, { memory: 2 }));
    run(s, 3.9);
    expect(s.pcs).toBe(0);
    run(s, 0.1);
    expect(s.pcs).toBe(1);
  });

  it('1種類でも足りなければ組み立てられない', () => {
    const s = quiet();
    setScreen(s, 'asm');
    s.parts = parts(3, { storage: 0 });
    expect(setsOf(s.parts)).toBe(0);
    expect(workTap(s, bal, 'asm')).toEqual([]);
  });

  it('発送：注文したときの値段で入金する（19,800円なら 16,320円）', () => {
    const s = quiet();
    setScreen(s, 'ship');
    s.pcs = 2;
    s.orders.push({ id: 1, arrivedAt: 0, price: 19800 }, { id: 2, arrivedAt: 0, price: 17800 });
    const cash = s.cash;
    workTap(s, bal, 'ship');
    run(s, 1.5);
    expect(saleNet(bal, 19800)).toBe(16320);
    expect(s.cash).toBe(cash + 16320);
    workTap(s, bal, 'ship');
    run(s, 1.5);
    expect(s.cash).toBe(cash + 16320 + saleNet(bal, 17800));
    expect(s.stats.sold).toBe(2);
  });

  it('作業中のタップは1回だけ予約し、手が空いたら始める。画面を移ると取り消す', () => {
    const s = quiet();
    s.junk = 3;
    workTap(s, bal, 'dis');
    workTap(s, bal, 'dis');
    workTap(s, bal, 'dis');
    expect(s.player.queued).toBe(true);
    run(s, 2.6);
    expect(s.junk).toBe(1);
    expect(s.player.task).not.toBeNull();
    expect(s.player.queued).toBe(false);
    run(s, 2.6);
    expect(s.stats.disassembled).toBe(2);
    expect(s.player.task).toBeNull();
    workTap(s, bal, 'dis');
    workTap(s, bal, 'dis');
    setScreen(s, 'asm');
    expect(s.player.queued).toBe(false);
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

  it('アルバイトは速さの倍率で作業し、材料がある限り続ける。自分と並行して作業する', () => {
    const s = quiet();
    s.cash = 1e6;
    s.junk = 10;
    hire(s, bal, 'dis');
    workHold(s, bal, 'dis', true);
    const workerSeconds = bal.taskSeconds.disassemble / bal.workers.speed;
    run(s, Math.ceil(workerSeconds * 10) / 10);
    expect(s.stats.disassembled).toBe(workerSeconds < bal.taskSeconds.disassemble ? 1 : 2);
    run(s, 2.5);
    expect(s.stats.disassembled).toBeGreaterThanOrEqual(2);
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

  it('自動：ジャンクが2台未満なら買う。支払いが遠いうちは取り置きしない', () => {
    const s = createState(bal, 1);
    s.nextOrderAt = 1e9;
    s.nextOfferAt = 1e9;
    s.cash = 8000;
    run(s, 0.1);
    expect(s.junk).toBe(2);
    expect(s.cash).toBe(2000);
  });

  it('自動：支払いが近いときは、支払い額を残せる分だけ買う', () => {
    const s = createState(bal, 1);
    s.nextOrderAt = 1e9;
    s.nextOfferAt = 1e9;
    s.nextPayAt = bal.junk.autoBuy.reserveWithinSeconds - 1;
    const bill = bal.payments.utility + bal.payments.rent;
    s.cash = bill + bal.junk.price + 100;
    run(s, 0.1);
    expect(s.junk).toBe(1);
  });

  it('自動：組める台数が3台以上か完成品が3台以上なら止まる', () => {
    const s = quiet();
    setAutoBuy(s, true);
    s.parts = parts(3);
    run(s, 0.1);
    expect(s.junk).toBe(0);
    s.parts = parts(0);
    s.pcs = 3;
    run(s, 0.1);
    expect(s.junk).toBe(0);
  });

  it('自動：作業が止まっているときは取り置きを崩して1台買う', () => {
    const s = quiet();
    setAutoBuy(s, true);
    s.nextPayAt = s.t + 1;
    s.cash = 3500;
    run(s, 0.1);
    expect(s.junk).toBe(1);
    expect(s.cash).toBe(500);
  });

  it('足りない部品を新品で補う：足りない種類だけ買い、値段は種類ごと', () => {
    const s = quiet();
    s.parts = parts(2, { storage: 0, power: 0 });
    s.cash = 100000;
    const ev = buyMissingParts(s, bal);
    const cost = bal.newParts.price.storage + bal.newParts.price.power;
    expect(ev).toEqual([{ type: 'partsBought', types: ['storage', 'power'], cost }]);
    expect(s.parts).toEqual(parts(2, { storage: 1, power: 1 }));
    expect(s.cash).toBe(100000 - cost);
    expect(buyMissingParts(s, bal)).toEqual([]);
  });

  it('新品で補う：お金が足りなければ買わない', () => {
    const s = quiet();
    s.parts = parts(1, { board: 0 });
    s.cash = bal.newParts.price.board - 1;
    expect(buyMissingParts(s, bal)).toEqual([]);
    expect(s.parts.board).toBe(0);
  });
});

describe('出品価格と注文', () => {
  it('高い段階は評価（売った件数）が足りないと選べない', () => {
    const s = quiet();
    const high = bal.market.priceLevels.findIndex((l) => l.minReviews > 0);
    expect(setPriceLevel(s, bal, high)).toEqual([]);
    s.stats.sold = bal.market.priceLevels[high]!.minReviews;
    expect(setPriceLevel(s, bal, high)).toEqual([{ type: 'priceChanged', level: high }]);
  });

  it('値段が高いほど注文が少なく、評価が増えると多くなる', () => {
    const s = quiet();
    const base = orderRate(s, bal);
    setPriceLevel(s, bal, 0);
    expect(orderRate(s, bal)).toBeGreaterThan(base);
    s.stats.sold = 30;
    expect(orderRate(s, bal)).toBeCloseTo((base * bal.market.priceLevels[0]!.demand) * (1 + 30 * bal.orders.growthPerSale), 9);
  });

  it('注文は届いたときの値段を持つ', () => {
    const s = createState(bal, 2);
    s.autoBuy = false;
    s.nextPayAt = 1e9;
    s.nextOfferAt = 1e9;
    setPriceLevel(s, bal, 1);
    run(s, 60);
    expect(s.stats.ordersArrived).toBeGreaterThan(0);
    for (const o of s.orders) expect(o.price).toBe(bal.market.priceLevels[1]!.price);
  });

  it('15秒以内に発送が始まらないと失われる', () => {
    const s = quiet();
    s.orders.push({ id: 1, arrivedAt: 0, price: DEFAULT_PRICE });
    run(s, 15);
    expect(s.orders.length).toBe(1);
    run(s, 0.1);
    expect(s.orders.length).toBe(0);
    expect(s.stats.ordersLost).toBe(1);
  });

  it('届く間隔の平均は baseIntervalSeconds（元の値段・評価なし）', () => {
    const s = createState(bal, 3);
    s.autoBuy = false;
    s.nextPayAt = 1e9;
    s.nextOfferAt = 1e9;
    let arrived = 0;
    const seconds = 7000;
    for (const e of run(s, seconds)) if (e.type === 'orderArrived') arrived += 1;
    const mean = seconds / arrived;
    expect(mean).toBeGreaterThan(bal.orders.baseIntervalSeconds * 0.92);
    expect(mean).toBeLessThan(bal.orders.baseIntervalSeconds * 1.08);
  });

  it('発送は古い注文から当てる', () => {
    const s = quiet();
    setScreen(s, 'ship');
    s.pcs = 1;
    s.orders.push({ id: 1, arrivedAt: 0, price: DEFAULT_PRICE }, { id: 2, arrivedAt: 0.05, price: DEFAULT_PRICE });
    workTap(s, bal, 'ship');
    expect(s.orders.map((o) => o.id)).toEqual([2]);
  });
});

describe('支払い', () => {
  const fixed = bal.payments.utility + bal.payments.rent;

  it('60秒ごとに電気代＋家賃＋給料×人数', () => {
    const s = createState(bal, 1);
    s.autoBuy = false;
    s.nextOrderAt = 1e9;
    s.nextOfferAt = 1e9;
    s.cash = 100000;
    hire(s, bal, 'asm');
    const afterHire = 100000 - bal.workers.hireCost;
    run(s, 59.9);
    expect(s.cash).toBe(afterHire);
    run(s, 0.1);
    expect(s.cash).toBe(afterHire - fixed - bal.workers.wage);
  });

  it('払えなければ30秒の猶予。戻らなければ倒産、戻れば解除', () => {
    const s = createState(bal, 1);
    s.autoBuy = false;
    s.nextOrderAt = 1e9;
    s.nextOfferAt = 1e9;
    s.cash = fixed - 500;
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
    r.cash = fixed - 500;
    run(r, 60);
    r.cash += 600;
    run(r, 0.1);
    expect(r.graceUntil).toBeNull();
  });

  it('長く閉じていて次の支払いに足りないなら、戻ってすぐには払わせない', () => {
    const s = quiet();
    s.cash = 100;
    s.nextPayAt = s.t + 5;
    returnFromAway(s, bal, 5);
    expect(s.nextPayAt).toBeCloseTo(s.t + 5, 5);
    returnFromAway(s, bal, bal.payments.intervalSeconds);
    expect(s.nextPayAt).toBeCloseTo(s.t + bal.payments.intervalSeconds, 5);
  });
});

describe('アルバイト', () => {
  it('雇用費を払い、段階1は2人まで、所持金が足りなければ雇えない', () => {
    const s = quiet();
    s.cash = bal.workers.hireCost - 1;
    expect(hire(s, bal, 'asm')).toEqual([]);
    s.cash = bal.workers.hireCost * 3;
    hire(s, bal, 'asm');
    hire(s, bal, 'dis');
    hire(s, bal, 'ship');
    expect(s.workers.length).toBe(bal.workers.maxCount);
    expect(s.cash).toBe(bal.workers.hireCost);
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

  it('制作のアルバイトは、優先OFFでも部品がそろっていなければキットを使う', () => {
    const s = quiet();
    s.cash = 100000;
    s.nextOfferAt = 0.1;
    run(s, 0.1);
    acceptSubcontract(s, bal);
    hire(s, bal, 'asm');
    run(s, 0.1);
    expect(s.sub!.kits).toBe(bal.subcontract.units - 1);
    expect(s.workers[0]!.task!.kit).toBe(true);
  });

  it('「下請けを優先」ONなら部品がそろっていてもキットを使う', () => {
    const s = quiet();
    s.cash = 100000;
    s.parts = parts(2);
    s.nextOfferAt = 0.1;
    run(s, 0.1);
    acceptSubcontract(s, bal);
    setSubcontractPriority(s, true);
    setScreen(s, 'asm');
    workTap(s, bal, 'asm');
    expect(s.player.task!.kit).toBe(true);
    expect(s.parts).toEqual(parts(2));
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
});

describe('詰まりの判定', () => {
  it('制作：組める台数−1 が1以上の状態が3秒続くと表示する', () => {
    const s = quiet();
    s.parts = parts(2);
    run(s, 2.9);
    expect(s.bottleneck.shown).toBeNull();
    run(s, 0.2);
    expect(s.bottleneck.shown).toBe('asm');
  });

  it('生産：制作に手があるのに組み立てを始められない秒数÷3', () => {
    const s = quiet();
    setScreen(s, 'asm');
    s.parts = parts(5, { power: 0 });
    run(s, 3);
    expect(s.bottleneck.starvedSeconds).toBeCloseTo(3, 5);
    run(s, 3.1);
    expect(s.bottleneck.shown).toBe('dis');
  });

  it('販売：完成品−1。待っている注文の数は使わない', () => {
    const s = quiet();
    s.pcs = 3;
    s.orders.push({ id: 1, arrivedAt: 0, price: DEFAULT_PRICE });
    run(s, 3.1);
    expect(s.bottleneck.shown).toBe('ship');
  });
});

describe('クリア', () => {
  it('所持金が40万円に届いたら貸し倉庫へ移れる', () => {
    const s = quiet();
    expect(moveToWarehouse(s, bal)).toEqual([]);
    s.cash = bal.stage1.clearCash;
    run(s, 0.1);
    expect(s.stats.clearReachedAt).not.toBeNull();
    moveToWarehouse(s, bal);
    expect(s.status).toBe('cleared');
  });
});
