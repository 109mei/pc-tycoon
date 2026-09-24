import type { Balance } from '../data/schema';
import { expovariate } from './rng';
import { countAssembled } from './step';
import { createState, missingCost, missingTypes, orderRate, priceLevelUnlocked } from './state';
import { spend, startPlayerTask, type Material } from './tasks';
import type { GameEvent, GameState, Lane } from './types';

/**
 * 画面からルール本体へ渡す命令。どれも刻みと刻みのあいだに呼ぶ。
 * 起きた出来事を返す（効果の表示やボットの記録に使う）。
 */

function playing(s: GameState): boolean {
  return s.status === 'playing';
}

/**
 * 作業ボタンのタップ：今いる画面の列で1回だけ作業する。手が作業中なら1回だけ予約し、空いたら始める。
 * material はボット用（画面からは渡さない）
 */
export function workTap(s: GameState, bal: Balance, lane: Lane, material: Material = 'auto'): GameEvent[] {
  const ev: GameEvent[] = [];
  if (!playing(s) || lane !== s.player.screen) return ev;
  if (s.player.task !== null) s.player.queued = true;
  else startPlayerTask(s, bal, lane, material, ev);
  return ev;
}

/** 作業ボタンの長押し：押しているあいだ、材料がある限り続ける */
export function workHold(s: GameState, bal: Balance, lane: Lane, pressed: boolean): GameEvent[] {
  const ev: GameEvent[] = [];
  if (!playing(s)) return ev;
  if (lane !== s.player.screen) {
    s.player.holding = false;
    return ev;
  }
  s.player.holding = pressed;
  if (pressed) {
    if (s.player.task !== null) s.player.queued = true;
    else startPlayerTask(s, bal, lane, 'auto', ev);
  }
  return ev;
}

/** 今いる画面（自分の手がある列）を変える。作業中の作業は完了まで進み、次は始めない */
export function setScreen(s: GameState, lane: Lane): void {
  if (s.player.screen === lane) return;
  s.player.screen = lane;
  s.player.holding = false;
  s.player.queued = false;
}

/** ジャンクを手動で買う。所持金が足りる分だけ買う */
export function buyJunk(s: GameState, bal: Balance, count: number): GameEvent[] {
  const ev: GameEvent[] = [];
  if (!playing(s)) return ev;
  const price = bal.junk.price;
  const n = Math.max(0, Math.min(Math.floor(count), Math.floor(s.cash / price)));
  if (n === 0) return ev;
  spend(s, price * n);
  s.junk += n;
  s.stats.junkBought += n;
  ev.push({ type: 'bought', count: n, auto: false });
  return ev;
}

export function setAutoBuy(s: GameState, on: boolean): void {
  s.autoBuy = on;
}

/** 1台分そろえるのに足りない部品を新品で買う。お金が足りなければ何もしない */
export function buyMissingParts(s: GameState, bal: Balance): GameEvent[] {
  const ev: GameEvent[] = [];
  if (!playing(s)) return ev;
  const types = missingTypes(s.parts);
  if (types.length === 0) return ev;
  const cost = missingCost(s, bal);
  if (s.cash < cost) return ev;
  spend(s, cost);
  for (const t of types) s.parts[t] += 1;
  s.stats.newPartsBought += types.length;
  s.stats.newPartsSpent += cost;
  ev.push({ type: 'partsBought', types, cost });
  return ev;
}

/** 出品価格の段階を変える。評価が足りない段階は選べない。次の注文までの間隔は新しい値段で引き直す */
export function setPriceLevel(s: GameState, bal: Balance, level: number): GameEvent[] {
  const ev: GameEvent[] = [];
  if (!playing(s) || level === s.priceLevel || !priceLevelUnlocked(s, bal, level)) return ev;
  s.priceLevel = level;
  s.stats.priceChanges += 1;
  s.nextOrderAt = s.t + expovariate(s, orderRate(s, bal));
  ev.push({ type: 'priceChanged', level });
  return ev;
}

export function canHire(s: GameState, bal: Balance): boolean {
  return playing(s) && s.workers.length < bal.workers.maxCount && s.cash >= bal.workers.hireCost;
}

export interface HireOptions {
  /** 雇うシートで出した予想（台/分）。雇った直後の表示に使う */
  forecast?: { now: number; after: number };
  /** 所持金が足りなくても雇う（予想の計算用） */
  force?: boolean;
}

export function hire(s: GameState, bal: Balance, lane: Lane, opts: HireOptions = {}): GameEvent[] {
  const ev: GameEvent[] = [];
  if (!playing(s) || s.workers.length >= bal.workers.maxCount) return ev;
  if (!opts.force && s.cash < bal.workers.hireCost) return ev;
  spend(s, bal.workers.hireCost);
  const id = s.nextWorkerId++;
  s.workers.push({ id, lane, task: null, resting: false, hiredAt: s.t });
  s.stats.hires += 1;
  if (s.stats.firstHireAt === null) s.stats.firstHireAt = s.t;
  const d = bal.display;
  s.hireEffect = {
    at: s.t,
    lane,
    forecastNow: opts.forecast?.now ?? 0,
    forecastAfter: opts.forecast?.after ?? 0,
    preCount: countAssembled(s, s.t - d.hireMeasurePreSeconds, s.t),
    measuredNow: null,
    measuredAfter: null,
  };
  ev.push({ type: 'hired', lane, id });
  return ev;
}

/** アルバイトの担当の列を変える。作業中の作業は元の列で完了まで進む */
export function reassignWorker(s: GameState, id: number, lane: Lane): void {
  const w = s.workers.find((x) => x.id === id);
  if (w) w.lane = lane;
}

export function acceptSubcontract(s: GameState, bal: Balance): GameEvent[] {
  const ev: GameEvent[] = [];
  if (!playing(s) || s.offer === null || s.sub !== null) return ev;
  const sc = bal.subcontract;
  s.sub = {
    id: s.offer.id,
    units: sc.units,
    kits: sc.units,
    left: sc.units,
    acceptedAt: s.t,
    deadline: s.t + sc.deadlineSeconds,
    fee: sc.feePerUnit,
    penalty: sc.penaltyPerUnit,
  };
  s.offer = null;
  ev.push({ type: 'subAccepted' });
  return ev;
}

export function setSubcontractPriority(s: GameState, on: boolean): void {
  s.subPriority = on;
}

export function canMoveToWarehouse(s: GameState, bal: Balance): boolean {
  return playing(s) && s.cash >= bal.stage1.clearCash;
}

/** 段階1のクリア（貸し倉庫へ移る）。試作1はここで終わり */
export function moveToWarehouse(s: GameState, bal: Balance): GameEvent[] {
  const ev: GameEvent[] = [];
  if (!canMoveToWarehouse(s, bal)) return ev;
  s.status = 'cleared';
  s.stats.clearedAt = s.t;
  ev.push({ type: 'cleared' });
  return ev;
}

/** 最初からやり直す（新しい状態を返す） */
export function restart(bal: Balance, seed: number): GameState {
  return createState(bal, seed);
}
