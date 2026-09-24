import { beforeAll, describe, expect, it } from 'vitest';
import { balance } from '../src/data';
import { formatSummary, measure, type FeelSummary } from './helpers/feel';

/** SPEC 5章：手触りの目安（ボットを種を変えて100回動かした中央値） */
describe('手触りの目安（SPEC 5章）', () => {
  let smart: FeelSummary;
  let nosub: FeelSummary;
  let rotation: FeelSummary;

  beforeAll(() => {
    smart = measure(balance, 'smart');
    nosub = measure(balance, 'smart_nosub');
    rotation = measure(balance, 'rotation');
    console.log(['', formatSummary(smart), formatSummary(nosub), formatSummary(rotation)].join('\n'));
    console.log(`下請けを受けないボットのクリアの遅れ: ${((nosub.clear / smart.clear - 1) * 100).toFixed(1)}%`);
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
    const slower = nosub.clear / smart.clear - 1;
    expect(slower).toBeGreaterThanOrEqual(0.05);
    expect(slower).toBeLessThanOrEqual(0.2);
  });

  it('状況を見ない対照ボットは、想定の遊び方より大きく遅い（15分でクリアできない）', () => {
    expect(rotation.clear).toBe(Infinity);
  });
});
