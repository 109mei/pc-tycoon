import type { Balance } from '../data/schema';
import { expovariate } from './rng';
import { activeWorkerCount, newPeriod, nextBill, orderRate } from './state';
import { progressTask, spend, startPlayerTask, startWorkerTask } from './tasks';
import type { GameEvent, GameState, Lane } from './types';

export interface StepOptions {
  /** 不在中の進行：自分の手は動かず、倒産もしない（払えなければアルバイトが休む） */
  away?: boolean;
  /** 世界の出来事のあと、手が動く前に呼ぶ（ボット用） */
  beforeWork?: (s: GameState, ev: GameEvent[]) => void;
}

/**
 * ルール本体を1刻み（tickSeconds）進める。起きた出来事を返す。
 * 順番は docs/sim_stage1.py の run() に合わせてある：
 * 注文の到着 → 注文の失効 → 下請けの依頼 → 下請けの納期 → 支払い → 猶予 → 自動仕入れ →（ボット）→ 自分の手 → アルバイト
 */
export function step(s: GameState, bal: Balance, opts: StepOptions = {}): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.status !== 'playing') return ev;
  const away = opts.away === true;

  s.tick += 1;
  s.t = s.tick * bal.tickSeconds;
  const t = s.t;

  // 注文が届く（ポアソン到着）
  while (t >= s.nextOrderAt) {
    const id = s.nextOrderId++;
    s.orders.push({ id, arrivedAt: s.nextOrderAt });
    s.stats.ordersArrived += 1;
    ev.push({ type: 'orderArrived', id });
    s.nextOrderAt += expovariate(s, orderRate(s, bal));
  }

  // 待ち時間を過ぎた注文は、ほかの出品者から買われる
  while (s.orders.length > 0 && t - s.orders[0]!.arrivedAt > bal.orders.patienceSeconds) {
    const lost = s.orders.shift()!;
    s.stats.ordersLost += 1;
    ev.push({ type: 'orderLost', id: lost.id });
  }

  // 下請けの依頼（受けている下請けがあるときは来ない）
  const sc = bal.subcontract;
  if (t >= s.nextOfferAt) {
    s.nextOfferAt += sc.offerEverySeconds;
    if (s.sub === null && s.offer === null) {
      s.offer = { id: s.nextSubId++, offeredAt: t, expiresAt: t + sc.offerExpiresSeconds };
      ev.push({ type: 'offer' });
    }
  }
  if (s.offer !== null && t >= s.offer.expiresAt) {
    s.offer = null;
    ev.push({ type: 'offerExpired' });
  }

  // 下請けの納期：残った台数分の違約金を払って終わる
  if (s.sub !== null && t >= s.sub.deadline) {
    const penalty = s.sub.left * s.sub.penalty;
    spend(s, penalty);
    s.stats.penaltiesPaid += penalty;
    s.stats.subsFailed += 1;
    s.sub = null;
    ev.push({ type: 'subFailed', penalty });
  }

  // 支払い
  if (t >= s.nextPayAt) {
    s.nextPayAt += bal.payments.intervalSeconds;
    pay(s, bal, away, ev);
  }

  // 猶予：0以上に戻れば解除、戻らなければ倒産（不在中は倒産させない）
  if (s.graceUntil !== null) {
    if (s.cash >= 0) {
      s.graceUntil = null;
      ev.push({ type: 'graceCleared' });
    } else if (!away && t >= s.graceUntil) {
      s.status = 'bankrupt';
      s.stats.bankruptAt = t;
      s.stats.bankruptCash = s.cash;
      ev.push({ type: 'bankrupt' });
      return ev;
    }
  }

  if (s.autoBuy) autoBuy(s, bal, ev);

  opts.beforeWork?.(s, ev);

  // 自分の手（今いる画面の列だけ。長押し中は材料がある限り続ける）
  if (!away) {
    if (s.player.task === null && s.player.holding) {
      startPlayerTask(s, bal, s.player.screen, 'auto', ev);
    }
    progressTask(s, bal, s.player, 'player', ev);
  }

  // アルバイト（担当の列で材料がある限り続ける）
  for (const w of s.workers) {
    if (w.resting) continue;
    if (w.task === null) startWorkerTask(s, bal, w, ev);
    progressTask(s, bal, w, w.id, ev);
  }

  updateBottleneck(s, bal, away);
  updateHireEffect(s, bal, ev);

  if (s.cash < s.stats.minCash) s.stats.minCash = s.cash;
  if (s.stats.clearReachedAt === null && s.cash >= bal.stage1.clearCash) {
    s.stats.clearReachedAt = t;
    ev.push({ type: 'clearReady' });
  }
  trimRecent(s, bal);
  return ev;
}

function pay(s: GameState, bal: Balance, away: boolean, ev: GameEvent[]): void {
  let bill = nextBill(s, bal);
  if (away && s.cash < bill) {
    // 不在中は倒産させない：アルバイトを休ませ（作業も給料も止める）、払える分だけ払う
    if (activeWorkerCount(s) > 0) {
      for (const w of s.workers) w.resting = true;
      ev.push({ type: 'workersRested' });
    }
    bill = Math.min(bal.payments.utility, Math.max(0, s.cash));
  }
  spend(s, bill);
  ev.push({ type: 'paid', amount: bill });
  closePeriod(s, bal);
  if (!away && s.cash < 0 && s.graceUntil === null) {
    s.graceUntil = s.t + bal.payments.graceSeconds;
    ev.push({ type: 'graceStarted' });
  }
}

function closePeriod(s: GameState, bal: Balance): void {
  const cur = s.finance.current;
  cur.end = s.t;
  s.finance.history.push(cur);
  while (s.finance.history.length > bal.display.financePeriods) s.finance.history.shift();
  s.finance.current = newPeriod(s.t);
}

/**
 * 自動仕入れ：ジャンクが keepJunk 未満、部品・完成品がためすぎでない、買ったあとも次の支払い額が残るときに1台ずつ買う。
 * ジャンク・部品（1台分）・完成品がすべてなく作業が止まっているときは、取り置きを崩してでも1台買う。
 */
export function autoBuy(s: GameState, bal: Balance, ev: GameEvent[]): void {
  const a = bal.junk.autoBuy;
  const price = bal.junk.price;
  const reserve = nextBill(s, bal);
  let need = a.keepJunk;
  if (s.pcs >= a.pauseWhenPcsAtLeast || s.parts >= a.pauseWhenPartsAtLeast) need = 0;
  let n = 0;
  while (s.junk < need && s.cash - price >= reserve) {
    spend(s, price);
    s.junk += 1;
    n += 1;
  }
  if (s.junk === 0 && s.parts < bal.pc.partsPerPc && s.pcs === 0 && s.cash >= price) {
    spend(s, price);
    s.junk += 1;
    n += 1;
  }
  if (n > 0) {
    s.stats.junkBought += n;
    ev.push({ type: 'bought', count: n, auto: true });
  }
}

/** 各列の詰まり具合（1.0以上で「詰まり」） */
export function bottleneckScores(s: GameState, bal: Balance): Record<Lane, number> {
  const P = bal.pc.partsPerPc;
  return {
    dis: s.bottleneck.starvedSeconds / bal.bottleneck.starvedSecondsPerPoint,
    asm: s.parts / P - 1,
    ship: s.pcs - 1,
  };
}

function updateBottleneck(s: GameState, bal: Balance, away: boolean): void {
  const b = s.bottleneck;
  const canAssemble = s.parts >= bal.pc.partsPerPc || (s.sub !== null && s.sub.kits > 0);
  const playerHand = !away && s.player.screen === 'asm' && s.player.task === null;
  const workerHand = s.workers.some((w) => w.lane === 'asm' && !w.resting && w.task === null);
  if ((playerHand || workerHand) && !canAssemble) b.starvedSeconds += bal.tickSeconds;
  else b.starvedSeconds = 0;

  const scores = bottleneckScores(s, bal);
  let top: Lane | null = null;
  let topScore = -Infinity;
  for (const lane of ['dis', 'asm', 'ship'] as const) {
    if (scores[lane] > topScore) {
      top = lane;
      topScore = scores[lane];
    }
  }
  const candidate = topScore >= bal.bottleneck.minScore ? top : null;
  if (candidate !== b.candidate) {
    b.candidate = candidate;
    b.candidateSince = s.t;
  }
  if (b.shown !== b.candidate && s.t - b.candidateSince >= bal.bottleneck.holdSeconds - 1e-9) {
    b.shown = b.candidate;
  }
}

/** 直近 seconds 秒（s.t − seconds より後）の組み立て台数 */
export function countAssembled(s: GameState, since: number, until = Infinity): number {
  let n = 0;
  for (const [at] of s.recent.asm) if (at > since && at <= until) n += 1;
  return n;
}

function updateHireEffect(s: GameState, bal: Balance, ev: GameEvent[]): void {
  const h = s.hireEffect;
  if (h === null || h.measuredAfter !== null) return;
  const d = bal.display;
  if (s.t < h.at + d.hireMeasurePostSeconds - 1e-9) return;
  h.measuredNow = (h.preCount * 60) / d.hireMeasurePreSeconds;
  h.measuredAfter = (countAssembled(s, h.at, h.at + d.hireMeasurePostSeconds) * 60) / d.hireMeasurePostSeconds;
  ev.push({ type: 'hireMeasured' });
}

/** 記録として残す秒数（表示・雇った後の実測・ボットの判断のうち一番長いもの） */
export function recentKeepSeconds(bal: Balance): number {
  const d = bal.display;
  return Math.max(
    d.incomeWindowSeconds,
    d.hireMeasurePreSeconds + d.hireMeasurePostSeconds,
    d.shippedBoxSeconds,
    bal.bot.secondHireWindowSeconds,
  );
}

function trimRecent(s: GameState, bal: Balance): void {
  const from = s.t - recentKeepSeconds(bal);
  const r = s.recent;
  while (r.income.length > 0 && r.income[0]![0] <= from) r.income.shift();
  while (r.asm.length > 0 && r.asm[0]![0] <= from) r.asm.shift();
  while (r.sold.length > 0 && r.sold[0]! <= from) r.sold.shift();
}
