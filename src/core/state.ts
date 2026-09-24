import type { Balance } from '../data/schema';
import { expovariate, seedRng } from './rng';
import { PART_TYPES, type GameState, type Parts, type PartType, type Period } from './types';

/** セーブに入る状態の形の版。形を変えたら上げて、save の変換関数を足す */
export const STATE_SCHEMA = 2;

export function newPeriod(start: number): Period {
  return { start, end: null, revenue: 0, costs: 0, sold: 0 };
}

export function emptyParts(): Parts {
  return { board: 0, memory: 0, storage: 0, power: 0 };
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
    parts: emptyParts(),
    pcs: 0,
    orders: [],
    nextOrderAt: 0,
    nextOrderId: 1,
    priceLevel: bal.market.defaultLevel,
    nextPayAt: bal.payments.intervalSeconds,
    graceUntil: null,
    nextOfferAt: bal.subcontract.firstOfferAtSeconds,
    offer: null,
    sub: null,
    nextSubId: 1,
    autoBuy: bal.junk.autoBuy.enabledByDefault,
    subPriority: false,
    player: { screen: 'dis', holding: false, queued: false, task: null },
    workers: [],
    nextWorkerId: 1,
    bottleneck: { shown: null, candidate: null, candidateSince: 0, starvedSeconds: 0 },
    recent: { income: [], asm: [], sold: [], lost: [] },
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
      brokenParts: 0,
      newPartsBought: 0,
      newPartsSpent: 0,
      priceChanges: 0,
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

/** 今の出品価格の段階 */
export function priceLevelOf(s: GameState, bal: Balance) {
  const levels = bal.market.priceLevels;
  return levels[Math.max(0, Math.min(levels.length - 1, s.priceLevel))]!;
}

/** 評価（売った件数）でその段階の値段を選べるか */
export function priceLevelUnlocked(s: GameState, bal: Balance, level: number): boolean {
  const l = bal.market.priceLevels[level];
  return l !== undefined && s.stats.sold >= l.minReviews;
}

/** 1秒あたりの注文の到着率（評価で増え、出品価格が高いほど減る） */
export function orderRate(s: GameState, bal: Balance): number {
  const o = bal.orders;
  const reputation = Math.min(o.maxMultiplier, 1 + o.growthPerSale * s.stats.sold);
  return (reputation * priceLevelOf(s, bal).demand) / o.baseIntervalSeconds;
}

/** 働いている（休んでいない）アルバイトの数 */
export function activeWorkerCount(s: GameState): number {
  let n = 0;
  for (const w of s.workers) if (!w.resting) n += 1;
  return n;
}

/** 次の支払い額（電気代＋家賃＋給料×人数） */
export function nextBill(s: GameState, bal: Balance, extraWorkers = 0): number {
  const p = bal.payments;
  return p.utility + p.rent + bal.workers.wage * (activeWorkerCount(s) + extraWorkers);
}

/** 発送1件の手取り（売値×(1−手数料率)−送料） */
export function saleNet(bal: Balance, price: number): number {
  return Math.round(price * (1 - bal.pc.marketFeeRate)) - bal.pc.shippingCost;
}

/** 今の部品で組める台数（種類ごとの数のうち一番少ないもの） */
export function setsOf(parts: Parts): number {
  let n = Infinity;
  for (const t of PART_TYPES) n = Math.min(n, parts[t]);
  return n;
}

export function totalParts(parts: Parts): number {
  let n = 0;
  for (const t of PART_TYPES) n += parts[t];
  return n;
}

/** 1台分そろえるのに足りない種類 */
export function missingTypes(parts: Parts): PartType[] {
  return PART_TYPES.filter((t) => parts[t] < 1);
}

/** 足りない種類を新品で補う値段 */
export function missingCost(s: GameState, bal: Balance): number {
  let cost = 0;
  for (const t of missingTypes(s.parts)) cost += bal.newParts.price[t];
  return cost;
}

/** ジャンク1台から取れる、使える部品の数の期待値 */
export function expectedGoodParts(bal: Balance): number {
  let n = 0;
  for (const t of PART_TYPES) n += bal.junk.goodRate[t];
  return n;
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
