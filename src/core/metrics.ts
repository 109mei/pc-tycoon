import type { Balance } from '../data/schema';
import type { Policy } from './bot';
import { step } from './step';
import { createState } from './state';
import type { GameState } from './types';

/**
 * 手触りの目安を測るための記録と指標。docs/sim_stage1.py の run() / metrics() の移植。
 * ゲームの画面からは使わない（テストと scripts/sim.ts 用）。
 */

export interface EpisodeLog {
  seed: number;
  policy: string;
  sales: number[];
  hires: number[];
  income: [number, number][];
  arrived: number[];
  lost: number[];
  /** 所持金がクリア額に初めて届いた時刻 */
  reach: number | null;
  bankrupt: boolean;
  endT: number;
}

export interface EpisodeOptions {
  horizonSeconds: number;
  /** 雇ってから lost_post を測り終えるまでの秒数（これを過ぎ、かつクリアしたら止める） */
  postHireSeconds: number;
}

export function runEpisode(
  bal: Balance,
  seed: number,
  policy: Policy,
  opts: EpisodeOptions,
): { log: EpisodeLog; state: GameState } {
  const s = createState(bal, seed);
  policy.init?.(s, bal);
  const log: EpisodeLog = {
    seed,
    policy: policy.name,
    sales: [],
    hires: [],
    income: [],
    arrived: [],
    lost: [],
    reach: null,
    bankrupt: false,
    endT: 0,
  };
  const steps = Math.round(opts.horizonSeconds / bal.tickSeconds);
  const beforeWork = (st: GameState, ev: Parameters<Policy['act']>[2]) => policy.act(st, bal, ev);
  for (let i = 0; i < steps; i++) {
    const ev = step(s, bal, { beforeWork });
    for (const e of ev) {
      switch (e.type) {
        case 'orderArrived':
          log.arrived.push(s.t);
          break;
        case 'orderLost':
          log.lost.push(s.t);
          break;
        case 'sold':
          log.sales.push(s.t);
          log.income.push([s.t, e.amount]);
          break;
        case 'subFee':
          log.income.push([s.t, e.amount]);
          break;
        case 'hired':
          log.hires.push(s.t);
          break;
        case 'bankrupt':
          log.bankrupt = true;
          break;
        default:
          break;
      }
    }
    if (log.reach === null && s.cash >= bal.stage1.clearCash) log.reach = s.t;
    if (s.status !== 'playing') break;
    const h = log.hires[0];
    if (log.reach !== null && h !== undefined && s.t >= h + opts.postHireSeconds) break;
  }
  log.endT = s.t;
  return { log, state: s };
}

export interface EpisodeMetrics {
  firstSale: number;
  firstHire: number;
  secondHire: number;
  lostPre: number;
  lostPost: number;
  incomeJump: number;
  clear: number;
  bankrupt: boolean;
}

function incomeRate(log: EpisodeLog, t0: number, t1: number): number {
  const a = Math.max(0, t0);
  if (t1 <= a) return NaN;
  let sum = 0;
  for (const [t, amount] of log.income) if (t >= a && t < t1) sum += amount;
  return sum / (t1 - a);
}

export interface MetricWindows {
  /** 取りこぼし（雇った後）を数える秒数 */
  lostPostSeconds: number;
  /** 収入の伸び：雇う前の秒数 */
  incomePreSeconds: number;
  /** 収入の伸び：雇った後の区間 [h+from, h+to) */
  incomePostFrom: number;
  incomePostTo: number;
}

export function episodeMetrics(log: EpisodeLog, w: MetricWindows): EpisodeMetrics {
  const h = log.hires[0] ?? Infinity;
  const m: EpisodeMetrics = {
    firstSale: log.sales[0] ?? Infinity,
    firstHire: h,
    secondHire: log.hires[1] ?? Infinity,
    lostPre: NaN,
    lostPost: NaN,
    incomeJump: NaN,
    clear: log.reach ?? Infinity,
    bankrupt: log.bankrupt,
  };
  if (Number.isFinite(h)) {
    const pre = incomeRate(log, h - w.incomePreSeconds, h);
    const post = incomeRate(log, h + w.incomePostFrom, h + w.incomePostTo);
    m.incomeJump = pre > 0 ? post / pre : NaN;
    const arrPre = log.arrived.filter((t) => t < h).length;
    m.lostPre = arrPre > 0 ? log.lost.filter((t) => t < h).length / arrPre : 0;
    const end = h + w.lostPostSeconds;
    const arrPost = log.arrived.filter((t) => t >= h && t < end).length;
    m.lostPost = arrPost > 0 ? log.lost.filter((t) => t >= h && t < end).length / arrPost : 0;
  }
  return m;
}

/** 中央値（sim_stage1.py の med と同じ：NaN を除いて並べ、len//2 番目） */
export function median(values: number[]): number {
  const v = values.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  return v[Math.floor(v.length / 2)]!;
}
