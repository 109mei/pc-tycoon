import { beforeAll, describe, expect, it } from 'vitest';
import { balance } from '../src/data';
import { formatSummary, measure, type FeelSummary } from './helpers/feel';

/** SPEC 5章：手触りの目安（ボットを種を変えて100回動かした中央値） */
describe('手触りの目安（SPEC 5章）', () => {
  let smart: FeelSummary;
  let nosub: FeelSummary;
  let fixed: FeelSummary;
  let noparts: FeelSummary;
  let reckless: FeelSummary;
  let rotation: FeelSummary;
  const slower = (f: FeelSummary) => f.clear / smart.clear - 1;

  beforeAll(() => {
    smart = measure(balance, 'smart');
    nosub = measure(balance, 'smart_nosub');
    fixed = measure(balance, 'smart_fixedprice');
    noparts = measure(balance, 'smart_noparts');
    reckless = measure(balance, 'reckless');
    rotation = measure(balance, 'rotation');
    console.log(['', ...[smart, nosub, fixed, noparts, reckless, rotation].map(formatSummary)].join('\n'));
    console.log(
      `クリアの遅れ：下請けなし ${(slower(nosub) * 100).toFixed(1)}% / 値段を変えない ${(slower(fixed) * 100).toFixed(1)}% / 新品で補わない ${(slower(noparts) * 100).toFixed(1)}%`,
    );
    console.log(`無謀な遊び方：猶予に入った ${(reckless.rows.filter((r) => r.grace).length)}% / 倒産 ${(reckless.bankruptRate * 100).toFixed(0)}%`);
  });

  it('初めて売れるまで 8〜15秒', () => {
    expect(smart.firstSale).toBeGreaterThanOrEqual(8);
    expect(smart.firstSale).toBeLessThanOrEqual(15);
  });

  it('初めて雇うまで 60〜100秒', () => {
    expect(smart.firstHire).toBeGreaterThanOrEqual(60);
    expect(smart.firstHire).toBeLessThanOrEqual(100);
  });

  it('注文の取りこぼし：雇う前 10〜35%、雇った後120秒は雇う前の半分以下', () => {
    expect(smart.lostPre).toBeGreaterThanOrEqual(0.1);
    expect(smart.lostPre).toBeLessThanOrEqual(0.35);
    expect(smart.lostPost).toBeLessThanOrEqual(smart.lostPre / 2);
  });

  it('雇う前後の収入の伸び 1.6倍以上', () => {
    expect(smart.incomeJump).toBeGreaterThanOrEqual(1.6);
  });

  it('クリアまで 240〜360秒', () => {
    expect(smart.clear).toBeGreaterThanOrEqual(240);
    expect(smart.clear).toBeLessThanOrEqual(360);
  });

  it('倒産 0%', () => {
    expect(smart.bankruptRate).toBe(0);
  });

  it('下請けを受けないボットは、クリアが5〜20%遅い', () => {
    expect(slower(nosub)).toBeGreaterThanOrEqual(0.05);
    expect(slower(nosub)).toBeLessThanOrEqual(0.2);
  });

  it('状況を見ない対照ボットは、想定の遊び方より大きく遅い（15分でクリアできない）', () => {
    expect(rotation.clear).toBe(Infinity);
  });

  it('値段を変えないボットは、クリアが5%以上遅い（値段の判断に意味がある）', () => {
    expect(slower(fixed)).toBeGreaterThanOrEqual(0.05);
  });

  it('後半（2人目を雇った後）にも値段を変える判断がある', () => {
    expect(smart.priceChangesLate).toBeGreaterThanOrEqual(1);
  });

  it('足りない部品を新品で補わないボットは、クリアが3%以上遅い', () => {
    expect(slower(noparts)).toBeGreaterThanOrEqual(0.03);
  });

  it('後半の支払いは収入の15〜30%（支払いに重さがある）', () => {
    expect(smart.payShareLate).toBeGreaterThanOrEqual(0.15);
    expect(smart.payShareLate).toBeLessThanOrEqual(0.3);
  });

  it('支払いを考えない無謀な遊び方は、30%以上の回で猶予に入る', () => {
    const graced = reckless.rows.filter((r) => r.grace).length / reckless.rows.length;
    expect(graced).toBeGreaterThanOrEqual(0.3);
  });
});
