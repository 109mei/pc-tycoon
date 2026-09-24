import { hireBadge, suggestLane } from '../core/bot';
import { canStart } from '../core/tasks';
import {
  expectedGoodParts,
  missingCost,
  missingTypes,
  nextBill,
  orderRate,
  priceLevelOf,
  priceLevelUnlocked,
  saleNet,
  setsOf,
} from '../core/state';
import type { GameState, Lane, Parts, PartType, Status } from '../core/types';
import type { Balance } from '../data/schema';

/**
 * 画面に見せる写し。ルール本体の状態から、表示に要る数だけを取り出す（1秒に10回ほど作り直す）。
 */

export interface OrderView {
  id: number;
  /** 残り秒数 */
  left: number;
  /** 残り時間の割合（1→0） */
  fraction: number;
  urgent: boolean;
  price: number;
}

export interface WorkerView {
  id: number;
  lane: Lane;
  progress: number | null;
  resting: boolean;
}

export interface PeriodView {
  revenue: number;
  costs: number;
  profit: number;
  sold: number;
  current: boolean;
}

export interface PriceLevelView {
  price: number;
  minReviews: number;
  locked: boolean;
}

/** 作業ボタンが押せない理由（足りない物） */
export type WorkBlock =
  | { kind: 'junk' }
  | { kind: 'parts'; missing: PartType[] }
  | { kind: 'pcs' }
  | { kind: 'orders' }
  | null;

export interface ViewModel {
  t: number;
  status: Status;
  screen: Lane;
  cash: number;
  incomePerSec: number;
  warehousePct: number;
  clearReady: boolean;
  payIn: number;
  payAmount: number;
  /** 次の支払いに足りず、支払いが近い */
  payShort: boolean;
  graceLeft: number | null;
  /** 切り替えバーの量（生産＝ジャンク、制作＝組める台数、販売＝完成品） */
  counts: Record<Lane, number>;
  bottleneck: Lane | null;
  workersByLane: Record<Lane, number>;
  canWork: Record<Lane, boolean>;
  block: Record<Lane, WorkBlock>;
  holding: boolean;
  /** 自分の作業の進み具合（その列の作業をしているときだけ） */
  playerProgress: Record<Lane, number | null>;
  playerBusy: boolean;
  /** 序盤の導き：想定の遊び方なら次に手を使う列 */
  hintLane: Lane | null;
  autoBuy: boolean;
  junk: number;
  junkPrice: number;
  goodParts: number;
  affordableJunk: number;
  parts: Parts;
  sets: number;
  missing: PartType[];
  missingCost: number;
  /** 組める台数の代わりに、足りない部品と新品で補うボタンを出す */
  offerBuyMissing: boolean;
  canBuyMissing: boolean;
  brokenParts: number;
  pcs: number;
  priceLevel: number;
  price: number;
  saleNet: number;
  priceLevels: PriceLevelView[];
  /** 今の値段・評価での注文の平均間隔（秒） */
  orderInterval: number;
  reviews: number;
  orders: OrderView[];
  lost: number;
  offer: { units: number; fee: number; penalty: number; deadline: number; left: number; fraction: number } | null;
  sub: {
    units: number;
    left: number;
    kits: number;
    deadlineLeft: number;
    fraction: number;
    fee: number;
    penalty: number;
  } | null;
  subPriority: boolean;
  workers: WorkerView[];
  maxWorkers: number;
  hireCost: number;
  wage: number;
  workerSpeed: number;
  payInterval: number;
  canHire: boolean;
  billAfterHire: number;
  hireBadge: { now: number; after: number; measured: boolean } | null;
  periods: PeriodView[];
  stats: {
    sold: number;
    hires: number;
    clearedAt: number | null;
    bankruptAt: number | null;
    bankruptCash: number | null;
  };
}

const LANES: Lane[] = ['dis', 'asm', 'ship'];

function incomePerSecond(s: GameState, bal: Balance): number {
  const w = bal.display.incomeWindowSeconds;
  const from = s.t - w;
  let sum = 0;
  for (const [t, amount] of s.recent.income) if (t > from) sum += amount;
  const span = Math.min(w, Math.max(s.t, bal.tickSeconds));
  return sum / span;
}

function blockOf(s: GameState, bal: Balance, lane: Lane): WorkBlock {
  if (canStart(s, bal, lane)) return null;
  if (lane === 'dis') return { kind: 'junk' };
  if (lane === 'asm') return { kind: 'parts', missing: missingTypes(s.parts) };
  return s.pcs <= 0 ? { kind: 'pcs' } : { kind: 'orders' };
}

export function buildView(s: GameState, bal: Balance): ViewModel {
  const workersByLane: Record<Lane, number> = { dis: 0, asm: 0, ship: 0 };
  for (const w of s.workers) if (!w.resting) workersByLane[w.lane] += 1;
  const canWork = {} as Record<Lane, boolean>;
  const block = {} as Record<Lane, WorkBlock>;
  const playerProgress = {} as Record<Lane, number | null>;
  for (const lane of LANES) {
    canWork[lane] = canStart(s, bal, lane);
    block[lane] = blockOf(s, bal, lane);
    const task = s.player.task;
    playerProgress[lane] = task !== null && task.lane === lane ? 1 - task.remaining / task.total : null;
  }
  const patience = bal.orders.patienceSeconds;
  const orders: OrderView[] = s.orders.map((o) => {
    const left = Math.max(0, patience - (s.t - o.arrivedAt));
    return {
      id: o.id,
      left,
      fraction: left / patience,
      urgent: left <= bal.display.orderUrgentSeconds,
      price: o.price,
    };
  });
  const sc = bal.subcontract;
  const periods: PeriodView[] = [
    ...s.finance.history.map((p) => ({ ...pick(p), current: false })),
    { ...pick(s.finance.current), current: true },
  ];
  const level = priceLevelOf(s, bal);
  const payAmount = nextBill(s, bal);
  const payIn = Math.max(0, s.nextPayAt - s.t);
  const cost = missingCost(s, bal);
  const missing = missingTypes(s.parts);
  const hintLane =
    s.status === 'playing' && s.stats.sold < bal.display.hintUntilSales && s.player.task === null
      ? suggestLane(s, bal)
      : null;
  return {
    t: s.t,
    status: s.status,
    screen: s.player.screen,
    cash: s.cash,
    incomePerSec: incomePerSecond(s, bal),
    warehousePct: Math.max(0, Math.min(100, (s.cash / bal.stage1.clearCash) * 100)),
    clearReady: s.status === 'playing' && s.cash >= bal.stage1.clearCash,
    payIn,
    payAmount,
    payShort: s.cash < payAmount && payIn <= bal.display.payWarnSeconds,
    graceLeft: s.graceUntil !== null ? Math.max(0, s.graceUntil - s.t) : null,
    counts: { dis: s.junk, asm: setsOf(s.parts), ship: s.pcs },
    bottleneck: s.bottleneck.shown,
    workersByLane,
    canWork,
    block,
    holding: s.player.holding,
    playerProgress,
    playerBusy: s.player.task !== null,
    hintLane,
    autoBuy: s.autoBuy,
    junk: s.junk,
    junkPrice: bal.junk.price,
    goodParts: expectedGoodParts(bal),
    affordableJunk: Math.floor(Math.max(0, s.cash) / bal.junk.price),
    parts: { ...s.parts },
    sets: setsOf(s.parts),
    missing,
    missingCost: cost,
    offerBuyMissing: setsOf(s.parts) === 0 && missing.length <= bal.display.buyMissingMaxTypes,
    canBuyMissing: s.status === 'playing' && missing.length > 0 && s.cash >= cost,
    brokenParts: s.stats.brokenParts,
    pcs: s.pcs,
    priceLevel: s.priceLevel,
    price: level.price,
    saleNet: saleNet(bal, level.price),
    priceLevels: bal.market.priceLevels.map((l, i) => ({
      price: l.price,
      minReviews: l.minReviews,
      locked: !priceLevelUnlocked(s, bal, i),
    })),
    orderInterval: 1 / orderRate(s, bal),
    reviews: s.stats.sold,
    orders,
    lost: s.stats.ordersLost,
    offer:
      s.offer !== null
        ? {
            units: sc.units,
            fee: sc.feePerUnit,
            penalty: sc.penaltyPerUnit,
            deadline: sc.deadlineSeconds,
            left: Math.max(0, s.offer.expiresAt - s.t),
            fraction: Math.max(0, (s.offer.expiresAt - s.t) / sc.offerExpiresSeconds),
          }
        : null,
    sub:
      s.sub !== null
        ? {
            units: s.sub.units,
            left: s.sub.left,
            kits: s.sub.kits,
            deadlineLeft: Math.max(0, s.sub.deadline - s.t),
            fraction: Math.max(0, (s.sub.deadline - s.t) / sc.deadlineSeconds),
            fee: s.sub.fee,
            penalty: s.sub.penalty,
          }
        : null,
    subPriority: s.subPriority,
    workers: s.workers.map((w) => ({
      id: w.id,
      lane: w.lane,
      progress: w.task !== null ? 1 - w.task.remaining / w.task.total : null,
      resting: w.resting,
    })),
    maxWorkers: bal.workers.maxCount,
    hireCost: bal.workers.hireCost,
    wage: bal.workers.wage,
    workerSpeed: bal.workers.speed,
    payInterval: bal.payments.intervalSeconds,
    canHire: s.status === 'playing' && s.workers.length < bal.workers.maxCount && s.cash >= bal.workers.hireCost,
    billAfterHire: nextBill(s, bal, 1),
    hireBadge: hireBadge(s, bal),
    periods,
    stats: {
      sold: s.stats.sold,
      hires: s.stats.hires,
      clearedAt: s.stats.clearedAt,
      bankruptAt: s.stats.bankruptAt,
      bankruptCash: s.stats.bankruptCash,
    },
  };
}

function pick(p: { revenue: number; costs: number; sold: number }) {
  return { revenue: p.revenue, costs: p.costs, profit: p.revenue - p.costs, sold: p.sold };
}
