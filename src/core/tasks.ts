import type { Balance } from '../data/schema';
import { nextRandom } from './rng';
import { saleNet, setsOf, taskSeconds } from './state';
import {
  PART_TYPES,
  type Actor,
  type GameEvent,
  type GameState,
  type Lane,
  type PartType,
  type Task,
  type Worker,
} from './types';

/** 残り時間がこれ以下なら作業は終わり（小数の誤差よけ） */
const DONE_EPSILON = 1e-9;

/** 組み立ての材料。'auto' は「下請けを優先」の設定と在庫で決める */
export type Material = 'auto' | 'parts' | 'kit';

export function earn(s: GameState, amount: number): void {
  s.cash += amount;
  s.stats.revenue += amount;
  s.finance.current.revenue += amount;
  s.recent.income.push([s.t, amount]);
}

export function spend(s: GameState, amount: number): void {
  s.cash -= amount;
  s.finance.current.costs += amount;
}

/** 検品：部品ごとに、使えるか壊れているかを決める（乱数を種類の順に1つずつ使う） */
export function inspect(s: GameState, bal: Balance): { good: PartType[]; broken: PartType[] } {
  const good: PartType[] = [];
  const broken: PartType[] = [];
  for (const t of PART_TYPES) {
    if (nextRandom(s) < bal.junk.goodRate[t]) good.push(t);
    else broken.push(t);
  }
  return { good, broken };
}

export function kitsLeft(s: GameState): number {
  return s.sub ? s.sub.kits : 0;
}

/** 組み立てに何を使うか。始められなければ null */
export function pickAssemblyMaterial(
  s: GameState,
  _bal: Balance,
  material: Material,
): 'parts' | 'kit' | null {
  const hasParts = setsOf(s.parts) >= 1;
  const hasKit = kitsLeft(s) > 0;
  if (material === 'parts') return hasParts ? 'parts' : null;
  if (material === 'kit') return hasKit ? 'kit' : null;
  if (s.subPriority && hasKit) return 'kit';
  if (hasParts) return 'parts';
  return hasKit ? 'kit' : null;
}

export function canStart(s: GameState, bal: Balance, lane: Lane, material: Material = 'auto'): boolean {
  if (lane === 'dis') return s.junk > 0;
  if (lane === 'asm') return pickAssemblyMaterial(s, bal, material) !== null;
  return s.pcs > 0 && s.orders.length > 0;
}

/** 作業を始める。始める時点で材料を取る（同じ材料を2人が使わないため） */
export function beginTask(
  s: GameState,
  bal: Balance,
  lane: Lane,
  speed: number,
  material: Material,
): Task | null {
  let kit = false;
  let subId: number | null = null;
  let price: number | null = null;
  if (lane === 'dis') {
    if (s.junk <= 0) return null;
    s.junk -= 1;
  } else if (lane === 'asm') {
    const use = pickAssemblyMaterial(s, bal, material);
    if (use === null) return null;
    if (use === 'kit') {
      s.sub!.kits -= 1;
      kit = true;
      subId = s.sub!.id;
    } else {
      for (const t of PART_TYPES) s.parts[t] -= 1;
    }
  } else {
    if (s.pcs <= 0 || s.orders.length === 0) return null;
    s.pcs -= 1;
    price = s.orders.shift()!.price;
  }
  const total = taskSeconds(bal, lane, speed);
  return { lane, remaining: total, total, kit, subId, price };
}

export function finishTask(s: GameState, bal: Balance, task: Task, by: Actor, ev: GameEvent[]): void {
  if (task.lane === 'dis') {
    const { good, broken } = inspect(s, bal);
    for (const t of good) s.parts[t] += 1;
    s.stats.disassembled += 1;
    s.stats.brokenParts += broken.length;
    ev.push({ type: 'disassembled', good, broken, by });
  } else if (task.lane === 'asm') {
    s.recent.asm.push([s.t, task.kit ? 1 : 0]);
    if (task.kit) {
      s.stats.kitsAssembled += 1;
      ev.push({ type: 'assembled', kit: true, by });
      const sub = s.sub;
      if (sub !== null && sub.id === task.subId) {
        sub.left -= 1;
        earn(s, sub.fee);
        ev.push({ type: 'subFee', amount: sub.fee, by });
        if (sub.left <= 0) {
          s.stats.subsDone += 1;
          s.sub = null;
          ev.push({ type: 'subDone' });
        }
      }
    } else {
      s.pcs += 1;
      s.stats.assembled += 1;
      ev.push({ type: 'assembled', kit: false, by });
    }
  } else {
    const price = task.price ?? 0;
    const amount = saleNet(bal, price);
    earn(s, amount);
    s.stats.sold += 1;
    s.finance.current.sold += 1;
    s.recent.sold.push(s.t);
    if (s.stats.firstSaleAt === null) s.stats.firstSaleAt = s.t;
    ev.push({ type: 'sold', amount, price, by });
  }
}

/** 自分の手で作業を始める（今いる画面の列だけ） */
export function startPlayerTask(
  s: GameState,
  bal: Balance,
  lane: Lane,
  material: Material,
  ev: GameEvent[],
): boolean {
  if (s.player.task !== null || lane !== s.player.screen) return false;
  const task = beginTask(s, bal, lane, 1, material);
  if (task === null) return false;
  s.player.task = task;
  ev.push({ type: 'taskStarted', lane, by: 'player' });
  return true;
}

export function startWorkerTask(s: GameState, bal: Balance, w: Worker, ev: GameEvent[]): boolean {
  const task = beginTask(s, bal, w.lane, bal.workers.speed, 'auto');
  if (task === null) return false;
  w.task = task;
  ev.push({ type: 'taskStarted', lane: w.lane, by: w.id });
  return true;
}

/** 作業を dt 秒進め、終わったら結果を出す。終わったら true */
export function progressTask(
  s: GameState,
  bal: Balance,
  holder: { task: Task | null },
  by: Actor,
  ev: GameEvent[],
): boolean {
  const task = holder.task;
  if (task === null) return false;
  task.remaining -= bal.tickSeconds;
  if (task.remaining > DONE_EPSILON) return false;
  holder.task = null;
  finishTask(s, bal, task, by, ev);
  return true;
}
