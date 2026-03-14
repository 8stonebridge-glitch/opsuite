import { test, expect } from '@playwright/test';

const APP_URL = 'https://opsuite.vercel.app';
const EMAIL = 'suni93@hotmail.co.uk';
const PASSWORD = 'Hello2you';

test('sign-in flow debug', async ({ page }) => {
  const consoleLogs: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  // Step 1: Go to app
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/01-initial-load.png', fullPage: true });
  console.log('--- Step 1: Initial load ---');
  console.log('URL:', page.url());
  console.log('Page text:', await page.textContent('body'));

  // Step 2: Fill in sign-in form
  const emailInput = page.getByPlaceholder('you@company.com');
  const passwordInput = page.getByPlaceholder('Enter password');

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);
    await page.screenshot({ path: 'test-results/02-form-filled.png', fullPage: true });

    // Step 3: Click sign in
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();
    console.log('--- Step 3: Clicked Sign In ---');

    // Step 4: Wait and observe what happens
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(2000);
      const url = page.url();
      const bodyText = await page.textContent('body').catch(() => '');
      console.log(`--- Check ${i + 1} (${(i + 1) * 2}s) ---`);
      console.log('URL:', url);
      console.log('Body snippet:', bodyText?.substring(0, 300));
      await page.screenshot({
        path: `test-results/03-after-signin-${String(i + 1).padStart(2, '0')}.png`,
        fullPage: true,
      });

      // Check if we made it to the home/overview page
      if (url.includes('overview') || url.includes('my-day') || url.includes('onboarding')) {
        console.log('SUCCESS: Reached app page');
        break;
      }
    }
  } else {
    console.log('Sign-in form not visible — may already be signed in');
    await page.screenshot({ path: 'test-results/02-no-form.png', fullPage: true });

    // Wait and observe
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(2000);
      const url = page.url();
      const bodyText = await page.textContent('body').catch(() => '');
      console.log(`--- Check ${i + 1} (${(i + 1) * 2}s) ---`);
      console.log('URL:', url);
      console.log('Body snippet:', bodyText?.substring(0, 300));
      await page.screenshot({
        path: `test-results/03-waiting-${String(i + 1).padStart(2, '0')}.png`,
        fullPage: true,
      });

      if (url.includes('overview') || url.includes('my-day') || url.includes('onboarding')) {
        console.log('SUCCESS: Reached app page');
        break;
      }
    }
  }

  // Final state
  console.log('\n=== CONSOLE LOGS ===');
  consoleLogs.forEach((log) => console.log(log));
  console.log('\n=== NETWORK ERRORS ===');
  networkErrors.forEach((err) => console.log(err));

  await page.screenshot({ path: 'test-results/04-final-state.png', fullPage: true });
});
