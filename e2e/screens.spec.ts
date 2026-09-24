import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { debug, ready } from './helpers';

/**
 * npm run screens：主な画面のスクリーンショットを docs/screens/ に保存する。
 * 時間を止め（?speed=0）、Smart ボットで docs/rough/ と同じくらいの場面まで進めてから撮る。
 */
const OUT = 'docs/screens';
mkdirSync(OUT, { recursive: true });

/** 数字の写しとシートの出入りが落ち着くのを待って撮る。wait は「+¥」が消えるまで待つとき長くする */
async function shot(page: Page, name: string, wait = 420): Promise<void> {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

/** 「+¥」が飛び終わるまで */
const POPUP_DONE = 1500;

test.describe.configure({ mode: 'serial' });

test('生産・制作・販売（開始46秒ごろ、制作が詰まっている）', async ({ page }) => {
  await page.goto('./?seed=3&debug=1&speed=0');
  await ready(page);
  await debug(page, "setTheme('day')");
  // ボットで遊び、最後に分解を続けて制作に部品をためる
  await debug(page, 'runBot(38, { hire: false, acceptSub: false })');
  await debug(page, "setScreen('dis')");
  await debug(page, 'hold(8)');
  await expect(page.getByTestId('stuck-asm')).toBeVisible();
  await shot(page, '01_production', POPUP_DONE);

  // 制作：自分が組み立て中
  await page.getByTestId('switch-asm').click();
  await page.getByTestId('work').click();
  await debug(page, 'step(1.6)');
  await shot(page, '02_assembly', POPUP_DONE);

  // 販売：注文・逃した注文・下請けの依頼。売れた瞬間の「+¥」
  await page.getByTestId('switch-ship').click();
  await debug(page, 'step(0.4)');
  const s = await debug<{ pcs: number; orders: unknown[] }>(page, 'state()');
  if (s.pcs > 0 && s.orders.length > 0) {
    await page.getByTestId('work').click();
    await debug(page, 'step(1.5)');
  }
  await shot(page, '03_sales');
});

test('社員タブのアルバイトを雇うシート', async ({ page }) => {
  await page.goto('./?seed=3&debug=1&speed=0');
  await ready(page);
  await debug(page, "setTheme('day')");
  await debug(page, 'runUntilCash(76000, 300)');
  await page.getByTestId('switch-asm').click();
  await page.getByTestId('tab-staff').click();
  await page.getByTestId('hire-lane-asm').click();
  await expect(page.getByTestId('forecast')).toContainText('台/分');
  await shot(page, '04_hire_sheet');

  // 雇った直後の制作の画面（夜の配色）
  await page.getByTestId('hire').click();
  await debug(page, "setTheme('night')");
  await debug(page, 'runBot(6, { hire: false })');
  await page.getByTestId('switch-asm').click();
  await expect(page.getByTestId('hire-badge')).toBeVisible();
  await shot(page, '05_after_hire_night');
});
