import { expect, Page } from '@playwright/test';

export const TEST_URL = '/index.test.html?mode=test&seed=1337&speed=0.1';

export async function startGame(page: Page, url: string = TEST_URL) {
  await page.goto(url);
  await page.getByRole('button', { name: /iniciar jornada/i }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /iniciar jornada/i }).click();
  await waitForScene(page, 'floresta');
}

export async function waitForChoices(page: Page, expectedCount: number, timeout = 8000) {
  await page.waitForFunction(
    (count) => {
      const container = document.getElementById('choices-container');
      if (!container) return false;
      return Number(container.dataset.choicesCount || '0') === count;
    },
    expectedCount,
    { timeout }
  );
  await expect(page.locator('#choices-container button')).toHaveCount(expectedCount);
}

export async function chooseByIndex(page: Page, index: number) {
  const choiceLocator = page.locator(`[data-testid="choice-${index}"]`).first();
  await choiceLocator.waitFor({ state: 'visible' });
  await choiceLocator.click();
}

export async function chooseProgrammatically(page: Page, index: number) {
  await page.evaluate((idx) => window.SrBodeTest?.choose(idx), index);
}

export async function getChoiceCount(page: Page) {
  return page.evaluate(
    () => Number(document.getElementById('choices-container')?.dataset?.choicesCount || 0),
  );
}

export async function expectDialogContains(page: Page, text: RegExp | string, timeout = 8000) {
  const dialog = page.locator('#dialog-box');
  await expect(dialog).toBeVisible({ timeout });
  await expect(dialog).toContainText(text, { timeout });
}

export async function waitForScene(page: Page, scene: string, timeout = 8000) {
  await page.evaluate(
    ([target, maxWait]) => window.SrBodeTest?.waitForScene?.(target, maxWait),
    [scene, timeout] as [string, number]
  );
}

export async function getGameState<T = any>(page: Page): Promise<T> {
  return page.evaluate(() => window.SrBodeTest?.getState());
}

declare global {
  interface Window {
    SrBodeTest: {
      waitForScene(scene: string, timeout?: number): Promise<void>;
      waitForChoicesCount(expected: number, timeout?: number): Promise<void>;
      waitForDialogIncludes(text: string, timeout?: number): Promise<void>;
      choose(index: number): void;
      getState(): any;
      setSpeed(multiplier: number): void;
    };
  }
}


