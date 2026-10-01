import { expect, test } from '@playwright/test';
import { answer, visiblePanel } from './helpers';

test('two players in a timed room: shared settings, lockstep questions, and a reload mid-game', async ({ browser }) => {
  // Two separate browser profiles, like two people on two devices
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const hostPanel = visiblePanel(host);
  const guestPanel = visiblePanel(guest);

  // The host creates a room and picks the settings
  await host.goto('/');
  await host.getByRole('tab', { name: 'Multiplayer' }).click();
  await hostPanel.getByLabel('Your name').fill('Ann');
  await hostPanel.getByRole('button', { name: 'Create room' }).click();
  const code = (await hostPanel.locator('.room-id .sr-only').textContent()).replace(/\s/g, '');
  expect(code).toMatch(/^[A-Z2-9]{5}$/);
  await hostPanel.getByLabel('Number of questions (1–50)').fill('2');
  await hostPanel.getByRole('radio', { name: '20 sec' }).check();

  // The guest follows the invite link and sees the host's choices
  await guest.goto(`/?room=${code}`);
  await guestPanel.getByLabel('Your name').fill('Bob');
  await guestPanel.getByRole('button', { name: 'Join room' }).click();
  const summary = guestPanel.locator('.settings-summary');
  await expect(summary).toContainText('20 sec');
  await expect(summary).toContainText('Questions2');
  await expect(guestPanel.getByLabel('Number of questions (1–50)')).toHaveCount(0); // guests can't edit

  await hostPanel.getByRole('button', { name: 'Start game' }).click();

  // Question 1: everyone answering closes it early, then question 2 opens by itself
  await expect(guestPanel.getByText('Test question 1', { exact: true })).toBeVisible();
  await expect(guestPanel.getByText('Everyone is on this question together.')).toBeVisible();
  await answer(host, 'Right 1');
  await answer(guest, 'Wrong 1a');
  await expect(guestPanel.getByText('Test question 2', { exact: true })).toBeVisible({ timeout: 10_000 });

  // The guest's page reloads mid-game: they're back in their seat with their answer
  await guest.reload();
  await expect(guestPanel.getByText('Test question 2', { exact: true })).toBeVisible();
  await expect(guestPanel.getByRole('button', { name: 'Question 1, wrong' })).toBeVisible();

  await answer(guest, 'Right 2');
  await answer(host, 'Right 2');

  await expect(hostPanel.locator('.winner')).toContainText('Ann wins');
  await expect(guestPanel.locator('.leaderboard')).toContainText('Bob');
  await expect(guestPanel.locator('.share-card')).toContainText('2nd of 2');

  await hostContext.close();
  await guestContext.close();
});
