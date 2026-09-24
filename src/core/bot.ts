import type { Balance } from '../data/schema';
import { acceptSubcontract, hire, setScreen } from './commands';
import { countAssembled, step } from './step';
import { cloneState, orderRate } from './state';
import { canStart, startPlayerTask } from './tasks';
import type { GameEvent, GameState, Lane } from './types';

/** ボットの遊び方。刻みごとに、世界の出来事のあと・手が動く前に act が呼ばれる */
export interface Policy {
  name: string;
  init?(s: GameState, bal: Balance): void;
  act(s: GameState, bal: Balance, ev: GameEvent[]): void;
}

export interface Choice {
  lane: Lane;
  kit: boolean;
}

/**
 * Smart（想定の遊び方）の手の使い方。docs/sim_stage1.py の Smart.choose の移植。
 * 発送できるなら発送 → 下請けの納期が迫っていれば下請けの組み立て → 完成品が少なければ組み立て → 部品が少なければ分解 → そのほか材料があるもの。
 */
export function smartChoose(s: GameState, bal: Balance): Choice | null {
  const b = bal.bot;
  const P = bal.pc.partsPerPc;
  const wl = s.workers.filter((w) => !w.resting).map((w) => w.lane);
  const asmWorker = wl.includes('asm');
  const canAsm = canStart(s, bal, 'asm', 'parts');
  const canDis = canStart(s, bal, 'dis');
  const kits = s.sub !== null ? s.sub.kits : 0;

  if (canStart(s, bal, 'ship')) return { lane: 'ship', kit: false };
  if (s.sub !== null && kits > 0 && s.sub.deadline - s.t < kits * bal.taskSeconds.assemble * b.subUrgencyFactor) {
    return { lane: 'asm', kit: true };
  }
  const stockHigh = s.pcs >= b.stockHighPcs;
  if (!stockHigh && canAsm && !asmWorker) return { lane: 'asm', kit: false };
  if (kits > 0 && (asmWorker || stockHigh || !canAsm)) {
    if (!asmWorker || stockHigh) return { lane: 'asm', kit: true };
  }
  if (!stockHigh && canDis && !wl.includes('dis') && s.parts < P * b.disassembleBelowPcSets) {
    return { lane: 'dis', kit: false };
  }
  if (canAsm && !stockHigh) return { lane: 'asm', kit: false };
  if (canDis && s.parts < P * b.disassembleUpToPcSets && !stockHigh) return { lane: 'dis', kit: false };
  if (kits > 0) return { lane: 'asm', kit: true };
  return null;
}

/**
 * Smart の雇い方：所持金が 雇用費＋雇ったあとの次の支払い額＋ジャンク1台分 以上なら雇う。
 * 1人目は制作、2人目は生産。2人目は組み立ての速さが注文に追いついていないときだけ。
 */
export function smartHireLane(s: GameState, bal: Balance): Lane | null {
  const n = s.workers.length;
  if (n >= bal.workers.maxCount) return null;
  const nextBill = bal.payments.utility + bal.workers.wage * (n + 1);
  const cost = bal.workers.hireCost + bal.bot.reserveWages * nextBill + bal.junk.price;
  if (s.cash < cost) return null;
  if (n === 1) {
    const w = bal.bot.secondHireWindowSeconds;
    let built = 0;
    for (const [at, kit] of s.recent.asm) if (kit === 0 && at > s.t - w) built += 1;
    if (built / w >= orderRate(s, bal) * bal.bot.secondHireDemandRatio) return null;
  }
  const lanes = bal.bot.hireLanes;
  const taken = new Set(s.workers.map((x) => x.lane));
  return lanes.find((l) => !taken.has(l)) ?? lanes[lanes.length - 1] ?? null;
}

export interface SmartOptions {
  /** 下請けを来た瞬間に受ける */
  useSub?: boolean;
  /** 条件を満たしたら雇う */
  hire?: boolean;
}

/** Smart（想定の遊び方）。長押し相当で休まず作業し、作業のたびに画面を自由に移る */
export function smartPolicy(opts: SmartOptions = {}): Policy {
  const useSub = opts.useSub ?? true;
  const doHire = opts.hire ?? true;
  return {
    name: useSub ? 'smart' : 'smart_nosub',
    init(s) {
      s.autoBuy = true;
    },
    act(s, bal, ev) {
      if (doHire) {
        const lane = smartHireLane(s, bal);
        if (lane !== null) ev.push(...hire(s, bal, lane));
      }
      if (useSub && s.offer !== null) ev.push(...acceptSubcontract(s, bal));
      if (s.player.task === null) {
        const c = smartChoose(s, bal);
        if (c !== null) {
          setScreen(s, c.lane);
          startPlayerTask(s, bal, c.lane, c.kit ? 'kit' : 'parts', ev);
        }
      }
    },
  };
}

/** policy で seconds 秒進める。onEvents が true を返したら止める */
export function runPolicy(
  s: GameState,
  bal: Balance,
  seconds: number,
  policy: Policy,
  onEvents?: (ev: GameEvent[], s: GameState) => boolean | void,
): void {
  const steps = Math.round(seconds / bal.tickSeconds);
  const beforeWork = (st: GameState, ev: GameEvent[]) => policy.act(st, bal, ev);
  for (let i = 0; i < steps; i++) {
    if (s.status !== 'playing') break;
    const ev = step(s, bal, { beforeWork });
    if (onEvents?.(ev, s) === true) break;
  }
}

export interface HireForecast {
  /** 雇わない場合の組み立て台数（台/分） */
  now: number;
  /** 雇う場合の組み立て台数（台/分） */
  after: number;
}

/**
 * 雇ったあとの予想。状態を複製し、Smart の遊び方で決まった秒数先まで進めて、
 * 雇う場合と雇わない場合の組み立て台数（下請けの分も含む）を比べる。
 */
export function forecastHire(s: GameState, bal: Balance, lane: Lane): HireForecast {
  const horizon = bal.display.hireForecastSeconds;
  const perMinute = (st: GameState) => {
    const start = st.t;
    const policy = smartPolicy({ useSub: true, hire: false });
    let built = 0;
    runPolicy(st, bal, horizon, policy, (ev) => {
      for (const e of ev) if (e.type === 'assembled') built += 1;
    });
    const span = Math.max(bal.tickSeconds, st.t - start);
    return (built * 60) / Math.max(span, horizon);
  };
  if (s.status !== 'playing') return { now: 0, after: 0 };
  const without = cloneState(s);
  const withHire = cloneState(s);
  hire(withHire, bal, lane, { force: true });
  return { now: perMinute(without), after: perMinute(withHire) };
}

/** 雇った直後の伸びの表示に出す値。予想の期間のあとは実測に置き換え、さらに決まった秒数で消す */
export function hireBadge(
  s: GameState,
  bal: Balance,
): { now: number; after: number; measured: boolean } | null {
  const h = s.hireEffect;
  if (h === null) return null;
  const d = bal.display;
  if (h.measuredAfter === null || h.measuredNow === null) {
    return { now: h.forecastNow, after: h.forecastAfter, measured: false };
  }
  if (s.t > h.at + d.hireMeasurePostSeconds + d.hireBadgeMeasuredSeconds) return null;
  return { now: h.measuredNow, after: h.measuredAfter, measured: true };
}

export { countAssembled };
