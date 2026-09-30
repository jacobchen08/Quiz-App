import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { answer, visiblePanel } from './helpers';

// Automated WCAG 2.2 AA checks (axe-core) on each screen a player meets, in light and dark.
// Automated checks catch roughly a third of accessibility problems; keyboard play and screen
// reader announcements are covered by the other tests.

async function expectNoViolations(page, screen) {
  // Let entrance animations settle so contrast is measured on the final colours
  await page.waitForTimeout(800);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    where: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
  expect(summary, `accessibility problems on ${screen}`).toEqual([]);
}

for (const colorScheme of ['light', 'dark']) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('solo: settings, a question, and the results', async ({ page }) => {
      await page.goto('/');
      await expectNoViolations(page, 'the solo settings');

      const panel = visiblePanel(page);
      await panel.getByLabel('Number of questions (1–50)').fill('1');
      await panel.getByRole('button', { name: 'Generate Questions' }).click();
      await expect(panel.getByText('Test question 1')).toBeVisible();
      await expectNoViolations(page, 'an unanswered question');

      await answer(page, 'Wrong 1a');
      await expectNoViolations(page, 'an answered question');

      await panel.getByRole('button', { name: /See results/ }).click();
      await expect(panel.locator('.results')).toBeVisible();
      await expectNoViolations(page, 'the results');
    });

    test('daily and multiplayer entry screens', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('tab', { name: 'Daily' }).click();
      await expect(visiblePanel(page).getByText("Today's questions stay hidden until you start.")).toBeVisible();
      await expectNoViolations(page, 'the daily challenge');

      await page.getByRole('tab', { name: 'Multiplayer' }).click();
      await expect(visiblePanel(page).getByLabel('Your name')).toBeVisible();
      await expectNoViolations(page, 'the multiplayer menu');

      await visiblePanel(page).getByLabel('Your name').fill('Ann');
      await visiblePanel(page).getByRole('button', { name: 'Create room' }).click();
      await expect(visiblePanel(page).locator('.room-id')).toBeVisible();
      await expectNoViolations(page, 'the room lobby');
    });
  });
}
