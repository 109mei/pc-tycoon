import type { Balance } from '../data/schema';
import { nextBill } from './state';
import { step } from './step';
import type { GameState, Lane } from './types';

export interface AwaySummary {
  /** 実際に進めた秒数（上限 offlineMaxSeconds） */
  seconds: number;
  /** 閉じていた秒数（上限で切る前） */
  requestedSeconds: number;
  revenue: number;
  sold: number;
  lost: number;
  cashBefore: number;
  cashAfter: number;
  /** いちばん長く詰まっていた列 */
  bottleneck: Lane | null;
  /** 支払えずにアルバイトが休んだ */
  workersRested: boolean;
}

/**
 * 閉じていた間の進行。ルール本体を同じ刻みでまとめて回す。
 * 自分の手は動かない。アルバイト・自動仕入れ・注文・支払い・下請けの納期は進む。
 * 倒産はさせず、支払えないときはアルバイトを休ませる。
 */
export function simulateAway(s: GameState, bal: Balance, seconds: number): AwaySummary {
  const requested = Math.max(0, seconds);
  const capped = Math.min(requested, bal.save.offlineMaxSeconds);
  const steps = Math.floor(capped / bal.tickSeconds + 1e-9);
  const summary: AwaySummary = {
    seconds: 0,
    requestedSeconds: requested,
    revenue: 0,
    sold: 0,
    lost: 0,
    cashBefore: s.cash,
    cashAfter: s.cash,
    bottleneck: null,
    workersRested: false,
  };
  const stuck: Record<Lane, number> = { dis: 0, asm: 0, ship: 0 };
  s.player.holding = false;
  s.player.queued = false;
  for (let i = 0; i < steps && s.status === 'playing'; i++) {
    const ev = step(s, bal, { away: true });
    for (const e of ev) {
      if (e.type === 'sold') {
        summary.sold += 1;
        summary.revenue += e.amount;
      } else if (e.type === 'subFee') {
        summary.revenue += e.amount;
      } else if (e.type === 'orderLost') {
        summary.lost += 1;
      } else if (e.type === 'workersRested') {
        summary.workersRested = true;
      }
    }
    const shown = s.bottleneck.shown;
    if (shown !== null) stuck[shown] += 1;
    summary.seconds += bal.tickSeconds;
  }
  let best = 0;
  for (const lane of ['dis', 'asm', 'ship'] as const) {
    if (stuck[lane] > best) {
      best = stuck[lane];
      summary.bottleneck = lane;
    }
  }
  summary.cashAfter = s.cash;
  return summary;
}

/**
 * 戻ってきたとき：休みを解き、所持金がマイナスなら猶予を始める。
 * 支払いの間隔より長くいなかったのに次の支払いに足りないときは、戻ってすぐ払わされないよう、
 * 支払いを1回分の間隔まで待つ（短い不在で支払いを先延ばしにはできない）。
 */
export function returnFromAway(s: GameState, bal: Balance, awaySeconds = 0): void {
  for (const w of s.workers) w.resting = false;
  if (s.status !== 'playing') return;
  if (s.cash < 0 && (s.graceUntil === null || s.graceUntil < s.t)) {
    s.graceUntil = s.t + bal.payments.graceSeconds;
  }
  if (awaySeconds >= bal.payments.intervalSeconds && s.cash < nextBill(s, bal)) {
    s.nextPayAt = Math.max(s.nextPayAt, s.t + bal.payments.intervalSeconds);
  }
}
