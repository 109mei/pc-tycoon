import { recklessPolicy, smartPolicy, type Policy } from '../../src/core/bot';
import { episodeMetrics, median, runEpisode, type EpisodeMetrics } from '../../src/core/metrics';
import type { Balance } from '../../src/data/schema';
import { rotationPolicy } from './rotation';

/** SPEC 5章の測り方 */
export const FEEL = {
  seeds: 100,
  /** sim_stage1.py の horizon（15分） */
  horizonSeconds: 900,
  windows: {
    lostPostSeconds: 120,
    incomePreSeconds: 30,
    incomePostFrom: 5,
    incomePostTo: 65,
  },
} as const;

export const POLICIES: Record<string, () => Policy> = {
  smart: () => smartPolicy(),
  smart_nosub: () => smartPolicy({ useSub: false }),
  smart_fixedprice: () => smartPolicy({ pricing: false }),
  smart_noparts: () => smartPolicy({ newParts: false }),
  reckless: () => recklessPolicy(),
  rotation: () => rotationPolicy(),
};

export interface FeelSummary {
  policy: string;
  firstSale: number;
  firstHire: number;
  secondHire: number;
  lostPre: number;
  lostPost: number;
  incomeJump: number;
  clear: number;
  bankruptRate: number;
  payShareEarly: number;
  payShareLate: number;
  priceChangesLate: number;
  rows: EpisodeMetrics[];
}

export function measure(bal: Balance, name: string, seeds: number = FEEL.seeds): FeelSummary {
  const make = POLICIES[name]!;
  const rows: EpisodeMetrics[] = [];
  for (let seed = 0; seed < seeds; seed++) {
    const { log } = runEpisode(bal, seed, make(), {
      horizonSeconds: FEEL.horizonSeconds,
      postHireSeconds: FEEL.windows.lostPostSeconds,
    });
    rows.push(episodeMetrics(log, FEEL.windows));
  }
  const col = (k: keyof EpisodeMetrics) => median(rows.map((r) => Number(r[k])));
  return {
    policy: name,
    firstSale: col('firstSale'),
    firstHire: col('firstHire'),
    secondHire: col('secondHire'),
    lostPre: col('lostPre'),
    lostPost: col('lostPost'),
    incomeJump: col('incomeJump'),
    clear: col('clear'),
    bankruptRate: rows.filter((r) => r.bankrupt).length / rows.length,
    payShareEarly: col('payShareEarly'),
    payShareLate: col('payShareLate'),
    priceChangesLate: col('priceChangesLate'),
    rows,
  };
}

export function formatSummary(f: FeelSummary): string {
  const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '—');
  const sec = (x: number) => (Number.isFinite(x) ? `${x.toFixed(1)}秒` : 'なし');
  return (
    `${f.policy}: 初めて売れる ${sec(f.firstSale)} / 雇う ${sec(f.firstHire)}・${sec(f.secondHire)} / ` +
    `取りこぼし ${pct(f.lostPre)} → ${pct(f.lostPost)} / 収入の伸び ${f.incomeJump.toFixed(2)}倍 / ` +
    `クリア ${sec(f.clear)} / 倒産 ${pct(f.bankruptRate)} / 支払い 序盤${pct(f.payShareEarly)}・後半${pct(f.payShareLate)} / ` +
    `後半の値段見直し ${Number.isFinite(f.priceChangesLate) ? f.priceChangesLate : '—'}回`
  );
}
