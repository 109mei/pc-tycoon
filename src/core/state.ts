import type { Balance } from '../data/schema';
import { expovariate, seedRng } from './rng';
import type { GameState, Period } from './types';

/** セーブに入る状態の形の版。形を変えたら上げて、save の変換関数を足す */
export const STATE_SCHEMA = 1;

export function newPeriod(start: number): Period {
  return { start, end: null, revenue: 0, costs: 0, sold: 0 };
}

export function createState(bal: Balance, seed: number): GameState {
  const s: GameState = {
    schema: STATE_SCHEMA,
    seed,
    rng: seedRng(seed),
    tick: 0,
    t: 0,
    status: 'playing',
    cash: bal.startCash,
    junk: 0,
    parts: 0,
    pcs: 0,
    orders: [],
    nextOrderAt: 0,
    nextOrderId: 1,
    nextPayAt: bal.payments.intervalSeconds,
    graceUntil: null,
    nextOfferAt: bal.subcontract.firstOfferAtSeconds,
    offer: null,
    sub: null,
    nextSubId: 1,
    autoBuy: bal.junk.autoBuy.enabledByDefault,
    subPriority: false,
    player: { screen: 'dis', holding: false, task: null },
    workers: [],
    nextWorkerId: 1,
    bottleneck: { shown: null, candidate: null, candidateSince: 0, starvedSeconds: 0 },
    recent: { income: [], asm: [], sold: [] },
    finance: { current: newPeriod(0), history: [] },
    hireEffect: null,
    stats: {
      sold: 0,
      revenue: 0,
      ordersArrived: 0,
      ordersLost: 0,
      assembled: 0,
      kitsAssembled: 0,
      disassembled: 0,
      junkBought: 0,
      hires: 0,
      subsDone: 0,
      subsFailed: 0,
      penaltiesPaid: 0,
      firstSaleAt: null,
      firstHireAt: null,
      clearReachedAt: null,
      clearedAt: null,
      bankruptAt: null,
      bankruptCash: null,
      minCash: bal.startCash,
    },
  };
  s.nextOrderAt = expovariate(s, orderRate(s, bal));
  return s;
}

export function cloneState(s: GameState): GameState {
  return structuredClone(s);
}

/** 1秒あたりの注文の到着率 */
export function orderRate(s: GameState, bal: Balance): number {
  const o = bal.orders;
  return Math.min(o.maxMultiplier, 1 + o.growthPerSale * s.stats.sold) / o.baseIntervalSeconds;
}

/** 働いている（休んでいない）アルバイトの数 */
export function activeWorkerCount(s: GameState): number {
  let n = 0;
  for (const w of s.workers) if (!w.resting) n += 1;
  return n;
}

/** 次の支払い額（電気代＋給料×人数） */
export function nextBill(s: GameState, bal: Balance, extraWorkers = 0): number {
  return bal.payments.utility + bal.workers.wage * (activeWorkerCount(s) + extraWorkers);
}

/** 発送1件の手取り（売値×(1−手数料率)−送料） */
export function saleNet(bal: Balance): number {
  return Math.round(bal.pc.salePrice * (1 - bal.pc.marketFeeRate)) - bal.pc.shippingCost;
}

/** ジャンク1台から取れる部品の数の期待値 */
export function expectedYield(bal: Balance): number {
  return bal.junk.partsYield.reduce((a, r) => a + r.parts * r.probability, 0);
}

/** 作業にかかる秒数（速さの倍率で割る） */
export function taskSeconds(bal: Balance, lane: 'dis' | 'asm' | 'ship', speed: number): number {
  const base =
    lane === 'dis'
      ? bal.taskSeconds.disassemble
      : lane === 'asm'
        ? bal.taskSeconds.assemble
        : bal.taskSeconds.ship;
  return base / speed;
}
