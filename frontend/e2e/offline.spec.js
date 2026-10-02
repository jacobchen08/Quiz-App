import { expect, test } from '@playwright/test';
import { answer, visiblePanel } from './helpers';

test('offline: solo plays from saved questions, and the online-only modes say so', async ({ page, context }) => {
  await page.goto('/');

  // While online, the app quietly saves a pack of questions for later
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('quizzr-offline-pack') ?? '{"questions":[]}').questions.length))
    .toBeGreaterThan(0);

  await context.setOffline(true);
  const notice = page.getByRole('status', { name: "You're offline" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Solo still works with');

  // Solo deals a round from the saved pack
  const panel = visiblePanel(page);
  await expect(panel.getByText('Offline: questions come from the ones saved in this browser.')).toBeVisible();
  await panel.getByLabel('Number of questions (1–50)').fill('2');
  await panel.getByRole('button', { name: 'Generate Questions' }).click();
  const first = panel.locator('.question');
  await expect(first).toHaveText(/^Test question \d+$/);
  const n = (await first.textContent()).match(/\d+/)[0];
  await answer(page, `Right ${n}`);
  await expect(panel.locator('.feedback')).toHaveText(/Correct!/);

  // The daily challenge and multiplayer can't start without a connection
  await page.getByRole('tab', { name: 'Daily' }).click();
  await expect(visiblePanel(page).getByRole('button', { name: "Start today's challenge" })).toBeDisabled();
  await page.getByRole('tab', { name: 'Multiplayer' }).click();
  await expect(visiblePanel(page).getByRole('button', { name: 'Create room' })).toBeDisabled();

  // Back online, the notice goes and everything is available again
  await context.setOffline(false);
  await expect(notice).toBeHidden();
  await expect(visiblePanel(page).getByRole('button', { name: 'Create room' })).toBeEnabled();
});
