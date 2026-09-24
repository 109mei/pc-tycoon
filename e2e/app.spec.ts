import { expect, test } from '@playwright/test';
import { countOf, debug, expectScreen, numberOf, ready, swipe } from './helpers';

interface StateLike {
  tick: number;
  stats: { sold: number; hires: number };
  workers: unknown[];
}

test('開いて3つの画面を切り替えられる（タップとスワイプ）', async ({ page }) => {
  await page.goto('./?seed=1');
  await ready(page);
  await expectScreen(page, 'dis');
  await expect(page.getByTestId('work')).toContainText('分解');

  await page.getByTestId('switch-asm').click();
  await expectScreen(page, 'asm');
  await expect(page.getByTestId('work')).toContainText('組み立て');

  await page.getByTestId('switch-ship').click();
  await expectScreen(page, 'ship');
  await expect(page.getByTestId('work')).toContainText('発送');

  await swipe(page, 'right');
  await expectScreen(page, 'asm');
  await swipe(page, 'right');
  await expectScreen(page, 'dis');
  await swipe(page, 'left');
  await expectScreen(page, 'asm');
  await swipe(page, 'left');
  await expectScreen(page, 'ship');
});

test('作業ボタンで分解・組み立て・発送ができ、所持金が増える', async ({ page }) => {
  await page.goto('./?seed=1&speed=4');
  await ready(page);
  const work = page.getByTestId('work');

  // 分解：長押しで部品が4個以上になるまで続ける（ジャンクは自動仕入れで届く）
  await expect.poll(() => countOf(page, 'count-dis')).toBeGreaterThan(0);
  const box = (await work.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => countOf(page, 'count-asm'), { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
  await page.mouse.up();

  // 組み立て：タップで1回
  await page.getByTestId('switch-asm').click();
  await expect(work).toContainText('組み立て');
  await work.click();
  await expect.poll(() => countOf(page, 'count-ship'), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);

  // 発送：注文が来たらタップ
  await page.getByTestId('switch-ship').click();
  await expect
    .poll(() => page.getByTestId('orders').getAttribute('data-count').then(Number), { timeout: 30_000 })
    .toBeGreaterThan(0);
  const before = await numberOf(page, 'cash');
  await work.click();
  await expect.poll(() => numberOf(page, 'cash'), { timeout: 10_000 }).toBeGreaterThan(before);
  await expect(page.locator('.popup.sale').first()).toBeVisible();
});

test('アルバイトを雇える', async ({ page }) => {
  await page.goto('./?seed=2&debug=1&speed=0');
  await ready(page);
  await debug(page, 'runUntilCash(80000, 400)');
  await expect.poll(() => numberOf(page, 'cash')).toBeGreaterThanOrEqual(80000);

  await page.getByTestId('tab-staff').click();
  await expect(page.getByTestId('sheet-staff')).toBeVisible();
  await page.getByTestId('hire-lane-asm').click();
  await expect(page.getByTestId('forecast')).toContainText('台/分');
  await expect(page.getByTestId('pay-check')).toContainText('支払いOK');
  const before = await numberOf(page, 'cash');
  await page.getByTestId('hire').click();

  await expect(page.getByTestId('sheet-staff')).toBeHidden();
  await expect(page.getByTestId('switch-asm').locator('.worker-mark')).toBeVisible();
  await expect(page.getByTestId('hire-badge')).toBeVisible();
  expect(await numberOf(page, 'cash')).toBe(before - 60000);
  await page.getByTestId('switch-asm').click();
  await expect(page.getByTestId('work')).toContainText('バイト');
  await expect(page.locator('.name-tag.worker')).toHaveText('バイト');
});

test('再読み込みしてもセーブが残る', async ({ page }) => {
  await page.goto('./?seed=4&debug=1&speed=0');
  await ready(page);
  await debug(page, 'runUntilCash(80000, 400)');
  await page.getByTestId('tab-staff').click();
  await page.getByTestId('hire-lane-dis').click();
  await page.getByTestId('hire').click();
  await page.getByTestId('switch-ship').click();
  const before = await debug<StateLike>(page, 'state()');
  expect(before.stats.hires).toBe(1);

  await page.reload();
  await ready(page);
  await expectScreen(page, 'ship');
  await expect(page.getByTestId('switch-dis').locator('.worker-mark')).toBeVisible();
  const after = await debug<StateLike>(page, 'state()');
  expect(after.stats.hires).toBe(1);
  expect(after.workers.length).toBe(1);
  expect(after.stats.sold).toBeGreaterThanOrEqual(before.stats.sold);
  expect(after.tick).toBeGreaterThanOrEqual(before.tick);
});

test('閉じていた間を進め、戻ってきたときにまとめを出す', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('./?seed=8&debug=1&speed=0');
  await ready(first);
  await debug(first, 'runUntilCash(80000, 400)');
  await first.getByTestId('tab-staff').click();
  await first.getByTestId('hire-lane-asm').click();
  await first.getByTestId('hire').click();
  const before = await debug<StateLike>(first, 'state()');
  await first.close();

  // 保存した時刻を1時間前にずらしてから開き直す（アプリより先に動く）
  const second = await context.newPage();
  await second.addInitScript(() => {
    const key = 'pc-tycoon/save';
    const text = window.localStorage.getItem(key);
    if (text === null || window.sessionStorage.getItem('shifted') !== null) return;
    const data = JSON.parse(text);
    data.savedAt -= 3600 * 1000;
    window.localStorage.setItem(key, JSON.stringify(data));
    window.sessionStorage.setItem('shifted', '1');
  });
  await second.goto('./?seed=8&debug=1&speed=0');
  await ready(second);
  const away = second.getByTestId('away');
  await expect(away).toBeVisible();
  await expect(away).toContainText('1時間');
  await expect(away).toContainText('売上');
  const after = await debug<StateLike>(second, 'state()');
  expect(after.tick - before.tick).toBeGreaterThanOrEqual(36000);
  expect(after.stats.hires).toBe(1);
  await second.getByTestId('away-ok').click();
  await expect(away).toBeHidden();
});

test('セーブを書き出して、最初からやり直したあと読み込める', async ({ page }) => {
  await page.goto('./?seed=6&debug=1&speed=0');
  await ready(page);
  await debug(page, 'runBot(90, { hire: true })');
  const before = await debug<StateLike>(page, 'state()');
  expect(before.stats.sold).toBeGreaterThan(0);

  await page.getByRole('button', { name: '設定' }).click();
  await page.getByTestId('export').click();
  const text = await page.getByTestId('save-text').inputValue();
  expect(text.startsWith('PCT1.')).toBe(true);

  await page.getByTestId('restart').click();
  await page.getByTestId('restart-yes').click();
  await expect.poll(async () => (await debug<StateLike>(page, 'state()')).stats.sold).toBe(0);

  await page.getByRole('button', { name: '設定' }).click();
  await page.getByTestId('save-text').fill(text);
  await page.getByTestId('import').click();
  await expect.poll(async () => (await debug<StateLike>(page, 'state()')).stats.sold).toBe(before.stats.sold);
});

test('所持金が40万円に届くと貸し倉庫へ移れて、クリア画面が出る', async ({ page }) => {
  await page.goto('./?seed=7&debug=1&speed=0');
  await ready(page);
  await debug(page, 'runBot(600, { hire: true })');
  await expect(page.getByTestId('move-warehouse')).toBeVisible();
  await page.getByTestId('move-warehouse').click();
  await expect(page.getByTestId('cleared')).toBeVisible();
  await expect(page.getByTestId('cleared')).toContainText('段階1クリア');
  await page.getByTestId('restart-cleared').click();
  await expect(page.getByTestId('cleared')).toBeHidden();
  await expect.poll(() => numberOf(page, 'cash')).toBeLessThan(20000);
});
