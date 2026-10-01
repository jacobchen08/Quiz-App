import { expect, test } from '@playwright/test';
import { answer, visiblePanel } from './helpers';

test('the daily challenge: ten questions, then your rank on the leaderboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Daily' }).click();
  const panel = visiblePanel(page);

  // Nothing is revealed before you start
  await expect(panel.getByText("Today's questions stay hidden until you start.")).toBeVisible();
  await panel.getByLabel('Your name for the leaderboard').fill('Dana');
  await panel.getByRole('button', { name: "Start today's challenge" }).click();

  for (let n = 1; n <= 10; n++) {
    await expect(panel.getByText(`Test question ${n}`, { exact: true })).toBeVisible();
    await answer(page, n === 3 ? 'Wrong 3a' : `Right ${n}`);
    if (n < 10) await panel.getByRole('button', { name: /^Next/ }).click();
  }

  await panel.getByRole('button', { name: /See results/ }).click();
  const results = panel.locator('.results');
  await expect(results.getByText('9 out of 10 correct')).toBeAttached();
  await expect(results.locator('.results-stats')).toContainText('1st of 1');
  await expect(panel.locator('.daily-board')).toContainText('Dana');
  await expect(panel.locator('.daily-board .me')).toContainText('9/10');

  // Coming back picks up where you were: finished, with the same result
  await page.reload();
  await page.getByRole('tab', { name: 'Daily' }).click();
  await expect(visiblePanel(page).locator('.results').getByText('9 out of 10 correct')).toBeAttached();
});
