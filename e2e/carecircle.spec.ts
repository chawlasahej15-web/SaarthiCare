import { test, expect } from '@playwright/test';

test('patient can review medicines, confirm a dose and add a visit', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /today’s medicines/i })).toBeVisible();
  const takenButtons = page.getByRole('button', { name: 'Taken' });
  if (await takenButtons.count()) await takenButtons.first().click();
  await expect(page.getByText(/Dose marked as taken/i)).toBeVisible();

  await page.getByRole('link', { name: /appointments/i }).click();
  await page.getByRole('button', { name: /add appointment/i }).click();
  await page.getByLabel(/doctor’s name/i).fill('Dr. Test Visit');
  await page.getByLabel(/specialty/i).fill('General Physician');
  await page.getByLabel(/date & time/i).fill('2027-01-20T11:30');
  await page.getByLabel(/clinic \/ location/i).fill('Demo Health Centre');
  await page.getByRole('button', { name: /save appointment/i }).click();
  await expect(page.getByText('Dr. Test Visit')).toBeVisible();
});

test('care circle can record a handoff note', async ({ page }) => {
  await page.goto('/care-circle');
  await page.getByRole('button', { name: /add a note/i }).click();
  await page.getByLabel(/note title/i).fill('Morning handoff');
  await page.getByLabel(/what should the circle know/i).fill('Medication refill collected.');
  await page.getByRole('button', { name: /share note/i }).click();
  await expect(page.getByText('Morning handoff')).toBeVisible();
});
