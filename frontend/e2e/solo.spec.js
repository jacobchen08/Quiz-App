import { expect, test } from '@playwright/test';
import { answer, letterFor, visiblePanel } from './helpers';

test('a solo round, played from the keyboard, ends on results you can share', async ({ page }) => {
  await page.goto('/');
  const panel = visiblePanel(page);

  await panel.getByLabel('Number of questions (1–50)').fill('2');
  await panel.getByRole('button', { name: 'Generate Questions' }).click();
  await expect(panel.getByText('Test question 1')).toBeVisible();

  // Question 1 by keyboard: the answer's letter, Enter to submit, arrow to move on
  await page.keyboard.press(await letterFor(page, 'Right 1'));
  await page.keyboard.press('Enter');
  await expect(panel.locator('.feedback')).toHaveText(/Correct!/);
  await page.keyboard.press('ArrowRight');

  // Question 2 by mouse, and wrong on purpose
  await expect(panel.getByText('Test question 2')).toBeVisible();
  await answer(page, 'Wrong 2a');
  await expect(panel.locator('.feedback')).toHaveText(/Not quite. The answer is Right 2./);

  await panel.getByRole('button', { name: /See results/ }).click();
  const results = panel.locator('.results');
  await expect(results.getByRole('heading', { name: 'Your results' })).toBeFocused();
  await expect(results.getByText('1 out of 2 correct')).toBeAttached();
  await expect(results.locator('.missed')).toContainText('Test question 2');
  await expect(results.locator('.missed')).toContainText('Right 2');
  await expect(results.locator('.share-card')).toContainText('Quizzr · Solo · 1/2');
  // the preview shows each question as a tile with a tick or cross, not colour alone
  await expect(results.locator('.share-mark')).toHaveCount(2);
  await expect(results.locator('.share-mark').nth(0)).toHaveClass(/correct/);
  await expect(results.locator('.share-mark').nth(1)).toHaveClass(/wrong/);
  await expect(results.getByText('Question 2: wrong')).toBeAttached();
});

test('a timed solo question runs out and shows the answer', async ({ page }) => {
  await page.goto('/');
  const panel = visiblePanel(page);

  await panel.getByLabel('Number of questions (1–50)').fill('1');
  await panel.getByRole('radio', { name: '10 sec' }).check();
  await panel.getByRole('button', { name: 'Generate Questions' }).click();
  await expect(panel.getByText('Test question 1')).toBeVisible();
  await expect(panel.getByText('Answer before the time runs out.')).toBeVisible();

  await expect(panel.locator('.feedback')).toHaveText("Time's up. The answer is Right 1.", { timeout: 15_000 });
  await expect(panel.getByRole('button', { name: 'Question 1, ran out of time' })).toBeVisible();
});
