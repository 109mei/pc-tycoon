import { test, type Page } from '@playwright/test';
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

/** 「+¥」や飛ぶ部品が落ち着くまで */
const SETTLE = 1500;

interface ShipLike {
  pcs: number;
  orders: unknown[];
  player: { task: unknown };
}

/** 注文が count 件並び、自分の手が空くまで時間を進める（最大 maxSeconds 秒） */
async function waitOrders(page: Page, count: number, maxSeconds = 30): Promise<void> {
  for (let t = 0; t < maxSeconds; t += 0.5) {
    const s = await debug<ShipLike>(page, 'state()');
    if (s.orders.length >= count && s.pcs >= 1 && s.player.task === null) return;
    await debug(page, 'step(0.5)');
  }
}

test.describe.configure({ mode: 'serial' });

test('生産・制作・販売（開始45秒ごろ）', async ({ page }) => {
  await page.goto('./?seed=3&debug=1&speed=0');
  await ready(page);
  await debug(page, "setTheme('day')");
  await debug(page, 'runBot(40, { hire: false, acceptSub: false })');
  await debug(page, "setScreen('dis')");
  await debug(page, 'hold(5)');
  await shot(page, '01_production', SETTLE);
  await debug(page, 'step(2.6)');

  // 制作：自分が組み立て中
  await page.getByTestId('switch-asm').click();
  await page.getByTestId('work').click();
  await debug(page, 'step(1.6)');
  await shot(page, '02_assembly', SETTLE);

  // 販売：注文が並んだところで1件発送し、売れた瞬間の「+¥」を撮る
  await page.getByTestId('switch-ship').click();
  await waitOrders(page, 2);
  await page.getByTestId('work').click();
  await debug(page, 'step(1.6)');
  await shot(page, '03_sales');
});

test('社員タブのアルバイトを雇うシートと、雇った直後の夜の配色', async ({ page }) => {
  await page.goto('./?seed=3&debug=1&speed=0');
  await ready(page);
  await debug(page, "setTheme('day')");
  await debug(page, 'runUntilCash(72000, 300)');
  await page.getByTestId('switch-asm').click();
  await page.getByTestId('tab-staff').click();
  await page.getByTestId('hire-lane-asm').click();
  await page.getByTestId('forecast').getByText('台/分').first().waitFor();
  await shot(page, '04_hire_sheet');

  await page.getByTestId('hire').click();
  await debug(page, "setTheme('night')");
  await debug(page, 'runBot(6, { hire: false })');
  await page.getByTestId('switch-asm').click();
  await page.getByTestId('hire-badge').waitFor();
  await shot(page, '05_after_hire_night', SETTLE);
});

test('夜の販売と生産', async ({ page }) => {
  await page.goto('./?seed=5&debug=1&speed=0');
  await ready(page);
  await debug(page, "setTheme('night')");
  await debug(page, 'runBot(150, { hire: true })');
  await debug(page, "setScreen('ship')");
  await waitOrders(page, 2);
  await shot(page, '06_sales_night', SETTLE);
  await debug(page, "setScreen('dis')");
  await shot(page, '07_production_night', SETTLE);
});
