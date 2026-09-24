import { expect, type Page } from '@playwright/test';

/** 画面の数字（data-value）を読む */
export async function numberOf(page: Page, testId: string): Promise<number> {
  const v = await page.getByTestId(testId).getAttribute('data-value');
  return Number(v);
}

/** 画面に出ている数（数字以外を取り除く） */
export async function countOf(page: Page, testId: string): Promise<number> {
  return Number((await page.getByTestId(testId).innerText()).replace(/[^0-9-]/g, ''));
}

/** 画面全体を包む要素の上で、横にスワイプする（部屋の canvas の上から始める） */
export async function swipe(page: Page, direction: 'left' | 'right'): Promise<void> {
  const y = 330;
  const [from, to] = direction === 'left' ? [320, 70] : [70, 320];
  await page.mouse.move(from, y);
  await page.mouse.down();
  await page.mouse.move((from + to) / 2, y + 4, { steps: 4 });
  await page.mouse.move(to, y + 6, { steps: 4 });
  await page.mouse.up();
}

export async function expectScreen(page: Page, lane: 'dis' | 'asm' | 'ship'): Promise<void> {
  await expect(page.getByTestId(`switch-${lane}`)).toHaveAttribute('aria-pressed', 'true');
}

/** ?debug=1 のときだけある窓口を呼ぶ */
export async function debug<T>(page: Page, call: string): Promise<T> {
  return page.evaluate(`(() => window.__pct.${call})()`) as Promise<T>;
}

/** フォントと部屋の canvas の準備を待つ */
export async function ready(page: Page): Promise<void> {
  await expect(page.getByTestId('work')).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    return true;
  });
  await expect(page.locator('.room-canvas canvas')).toBeVisible();
}
