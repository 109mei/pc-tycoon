import { hireBadge } from '../core/bot';
import { canStart } from '../core/tasks';
import { expectedYield, nextBill, saleNet } from '../core/state';
import type { GameState, Lane, Status } from '../core/types';
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
  graceLeft: number | null;
  /** 切り替えバーの量（生産＝ジャンク、制作＝部品、販売＝完成品） */
  counts: Record<Lane, number>;
  bottleneck: Lane | null;
  workersByLane: Record<Lane, number>;
  canWork: Record<Lane, boolean>;
  holding: boolean;
  /** 自分の作業の進み具合（その列の作業をしているときだけ） */
  playerProgress: Record<Lane, number | null>;
  autoBuy: boolean;
  junkPrice: number;
  avgYield: number;
  affordableJunk: number;
  partsPerPc: number;
  salePrice: number;
  saleNet: number;
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

export function buildView(s: GameState, bal: Balance): ViewModel {
  const workersByLane: Record<Lane, number> = { dis: 0, asm: 0, ship: 0 };
  for (const w of s.workers) if (!w.resting) workersByLane[w.lane] += 1;
  const canWork = {} as Record<Lane, boolean>;
  const playerProgress = {} as Record<Lane, number | null>;
  for (const lane of LANES) {
    canWork[lane] = canStart(s, bal, lane);
    const task = s.player.task;
    playerProgress[lane] = task !== null && task.lane === lane ? 1 - task.remaining / task.total : null;
  }
  const patience = bal.orders.patienceSeconds;
  const orders: OrderView[] = s.orders.map((o) => {
    const left = Math.max(0, patience - (s.t - o.arrivedAt));
    return { id: o.id, left, fraction: left / patience, urgent: left <= bal.display.orderUrgentSeconds };
  });
  const sc = bal.subcontract;
  const periods: PeriodView[] = [
    ...s.finance.history.map((p) => ({ ...pick(p), current: false })),
    { ...pick(s.finance.current), current: true },
  ];
  return {
    t: s.t,
    status: s.status,
    screen: s.player.screen,
    cash: s.cash,
    incomePerSec: incomePerSecond(s, bal),
    warehousePct: Math.max(0, Math.min(100, (s.cash / bal.stage1.clearCash) * 100)),
    clearReady: s.status === 'playing' && s.cash >= bal.stage1.clearCash,
    payIn: Math.max(0, s.nextPayAt - s.t),
    payAmount: nextBill(s, bal),
    graceLeft: s.graceUntil !== null ? Math.max(0, s.graceUntil - s.t) : null,
    counts: { dis: s.junk, asm: s.parts, ship: s.pcs },
    bottleneck: s.bottleneck.shown,
    workersByLane,
    canWork,
    holding: s.player.holding,
    playerProgress,
    autoBuy: s.autoBuy,
    junkPrice: bal.junk.price,
    avgYield: expectedYield(bal),
    affordableJunk: Math.floor(Math.max(0, s.cash) / bal.junk.price),
    partsPerPc: bal.pc.partsPerPc,
    salePrice: bal.pc.salePrice,
    saleNet: saleNet(bal),
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
