import type { Balance } from '../data/schema';
import type { Policy } from './bot';
import { step } from './step';
import { createState } from './state';
import type { GameEvent, GameState } from './types';

/**
 * 手触りの目安を測るための記録と指標。docs/sim_stage1.py の run() / metrics() の移植に、
 * 版2で足した指標（支払いの重さ・後半の値段の見直し）を加えたもの。
 * ゲームの画面からは使わない（テストと scripts/sim.ts 用）。
 */

export interface EpisodeLog {
  seed: number;
  policy: string;
  sales: number[];
  hires: number[];
  income: [number, number][];
  paid: [number, number][];
  priceChanges: number[];
  arrived: number[];
  lost: number[];
  /** 所持金がクリア額に初めて届いた時刻 */
  reach: number | null;
  bankrupt: boolean;
  /** 猶予に入った回数 */
  graces: number;
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
    paid: [],
    priceChanges: [],
    arrived: [],
    lost: [],
    reach: null,
    bankrupt: false,
    graces: 0,
    endT: 0,
  };
  const steps = Math.round(opts.horizonSeconds / bal.tickSeconds);
  const beforeWork = (st: GameState, ev: GameEvent[]) => policy.act(st, bal, ev);
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
        case 'paid':
          log.paid.push([s.t, e.amount]);
          break;
        case 'priceChanged':
          log.priceChanges.push(s.t);
          break;
        case 'hired':
          log.hires.push(s.t);
          break;
        case 'bankrupt':
          log.bankrupt = true;
          break;
        case 'graceStarted':
          log.graces += 1;
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
  /** 猶予に入ったことがある */
  grace: boolean;
  /** 2人目を雇ってからクリアまでの、支払い ÷ 収入 */
  payShareLate: number;
  /** 雇う前の、支払い ÷ 収入 */
  payShareEarly: number;
  /** 2人目を雇ってからクリアまでに値段を変えた回数 */
  priceChangesLate: number;
}

function incomeRate(log: EpisodeLog, t0: number, t1: number): number {
  const a = Math.max(0, t0);
  if (t1 <= a) return NaN;
  let sum = 0;
  for (const [t, amount] of log.income) if (t >= a && t < t1) sum += amount;
  return sum / (t1 - a);
}

function sumIn(rows: [number, number][], t0: number, t1: number): number {
  let sum = 0;
  for (const [t, v] of rows) if (t >= t0 && t < t1) sum += v;
  return sum;
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
  const h2 = log.hires[1] ?? Infinity;
  const end = log.reach ?? log.endT;
  const m: EpisodeMetrics = {
    firstSale: log.sales[0] ?? Infinity,
    firstHire: h,
    secondHire: h2,
    lostPre: NaN,
    lostPost: NaN,
    incomeJump: NaN,
    clear: log.reach ?? Infinity,
    bankrupt: log.bankrupt,
    grace: log.graces > 0,
    payShareLate: NaN,
    payShareEarly: NaN,
    priceChangesLate: NaN,
  };
  if (Number.isFinite(h)) {
    const pre = incomeRate(log, h - w.incomePreSeconds, h);
    const post = incomeRate(log, h + w.incomePostFrom, h + w.incomePostTo);
    m.incomeJump = pre > 0 ? post / pre : NaN;
    const arrPre = log.arrived.filter((t) => t < h).length;
    m.lostPre = arrPre > 0 ? log.lost.filter((t) => t < h).length / arrPre : 0;
    const postEnd = h + w.lostPostSeconds;
    const arrPost = log.arrived.filter((t) => t >= h && t < postEnd).length;
    m.lostPost = arrPost > 0 ? log.lost.filter((t) => t >= h && t < postEnd).length / arrPost : 0;
    const incEarly = sumIn(log.income, 0, h);
    m.payShareEarly = incEarly > 0 ? sumIn(log.paid, 0, h) / incEarly : NaN;
  }
  if (Number.isFinite(h2) && end > h2) {
    const incLate = sumIn(log.income, h2, end);
    m.payShareLate = incLate > 0 ? sumIn(log.paid, h2, end) / incLate : NaN;
    m.priceChangesLate = log.priceChanges.filter((t) => t >= h2 && t < end).length;
  }
  return m;
}

/** 中央値（sim_stage1.py の med と同じ：NaN を除いて並べ、len//2 番目） */
export function median(values: number[]): number {
  const v = values.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  return v[Math.floor(v.length / 2)]!;
}
