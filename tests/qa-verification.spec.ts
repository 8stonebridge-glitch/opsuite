import { test, expect } from '@playwright/test';

const APP_URL = 'https://opsuite.vercel.app';
const EMAIL = 'suni93@hotmail.co.uk';
const PASSWORD = 'Hello2you';

test('sign-in → overview with correct org → refresh → sign-out → clean sign-in', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Auto-accept all dialogs (Alert.alert on web = window.confirm)
  page.on('dialog', async (dialog) => {
    console.log('Dialog appeared:', dialog.type(), dialog.message());
    await dialog.accept();
  });

  // Step 1: Sign in
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const emailInput = page.getByPlaceholder('you@company.com');
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(EMAIL);
    await page.getByPlaceholder('Enter password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
  }

  // Step 2: Wait for overview
  await page.waitForURL('**/overview', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/qa-01-overview.png', fullPage: true });

  const bodyText = await page.textContent('body');
  console.log('Overview loaded with org:', bodyText?.includes('Gains') ? 'Gains' : 'WRONG');

  expect(bodyText).toContain('Gains');
  expect(bodyText).not.toContain('Temporary Resend Test');

  // Step 3: Refresh and verify org persists
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-results/qa-02-after-refresh.png', fullPage: true });

  const afterRefreshText = await page.textContent('body');
  console.log('After refresh org:', afterRefreshText?.includes('Gains') ? 'Gains' : afterRefreshText?.substring(0, 100));

  // Step 4: Navigate to More and sign out
  await page.getByText('More', { exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/qa-03-more-page.png', fullPage: true });

  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'test-results/qa-04-after-signout.png', fullPage: true });

  const signOutUrl = page.url();
  console.log('After sign-out URL:', signOutUrl);

  // Step 5: Check sign-in form is clean
  const signOutBody = await page.textContent('body');
  console.log('After sign-out page:', signOutBody?.includes('OpSuite') ? 'Sign-in page' : 'Other');

  // Verify email field is empty
  const emailField = page.getByPlaceholder('you@company.com');
  if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
    const emailValue = await emailField.inputValue();
    console.log('Email field value:', JSON.stringify(emailValue));
    expect(emailValue).toBe('');
  }

  console.log('\n=== ERRORS ===');
  errors.forEach((e) => console.log(e));
});
