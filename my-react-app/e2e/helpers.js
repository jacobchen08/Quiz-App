import { expect } from '@playwright/test';

// Every mode keeps its board mounted, so always look inside the tab that's showing
export function visiblePanel(page) {
  return page.locator('.mode-panel:not([hidden])');
}

// The offline questions always have "Right N" as the answer to "Test question N"
export async function answer(page, text) {
  const panel = visiblePanel(page);
  await panel.getByRole('button', { name: new RegExp(`\\b${text}$`) }).click();
  await panel.getByRole('button', { name: 'Submit answer' }).click();
  await expect(panel.locator('.feedback')).toBeVisible();
}

// The letter key (A–D) for an answer, wherever the shuffle put it
export async function letterFor(page, text) {
  const options = await visiblePanel(page).locator('.answer .answer-text').allTextContents();
  const index = options.indexOf(text);
  expect(index, `"${text}" should be one of the options`).toBeGreaterThan(-1);
  return 'abcd'[index];
}
