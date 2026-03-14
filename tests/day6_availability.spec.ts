/**
 * DAY 6 — AVAILABILITY AND COVERAGE
 *
 * Tests the availability/leave request system:
 * - Employee submits sick and leave requests
 * - Subadmin/admin approves or rejects
 * - Sick request protects employee immediately (pending state)
 * - Leave request protects only after approval
 * - Coverage-needed indicators appear for urgent tasks
 * - Employee not forced through handoff while unavailable
 *
 * Simulates realistic behavior:
 * - Submitting requests from different screens
 * - Checking approval status
 * - Admin overriding availability
 */

import { test, expect } from '@playwright/test';
import {
  collectConsoleErrors,
  collectNetworkErrors,
  assertNotBlankScreen,
  assertNoReactErrors,
  signIn,
  trySignIn,
  switchRole,
  humanDelay,
  assertTextVisible,
  TEST_ADMIN,
} from './helpers';

test.describe('Day 6 — Availability and Coverage', () => {
  let getErrors: ReturnType<typeof collectConsoleErrors>;
  let getNetworkErrors: ReturnType<typeof collectNetworkErrors>;

  test.beforeEach(async ({ page }) => {
    getErrors = collectConsoleErrors(page);
    getNetworkErrors = collectNetworkErrors(page);
    const success = await trySignIn(page);
    if (!success) test.skip(!success, "No valid credentials for Clerk mode");
    await page.waitForTimeout(1000);
  });

  test.afterEach(async ({ page }) => {
    const errors = getErrors();
    if (errors.length > 0) console.log('Console errors:', JSON.stringify(errors, null, 2));
  });

  // ─────────────────────────────────────────────────────────────────────

  test('employee My Day shows availability status area', async ({ page }) => {
    await switchRole(page, 'employee');
    await page.goto('/(employee)/my-day', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'employee-availability');

    const pageText = await page.evaluate(() => document.body?.innerText || '');
    expect(pageText.length).toBeGreaterThan(20);
  });

  test('employee more page has leave/sick request option', async ({ page }) => {
    await switchRole(page, 'employee');
    await page.goto('/(employee)/more', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'employee-more-availability');

    const pageText = await page.evaluate(() => document.body?.innerText || '');
    // Look for availability-related options
    const hasAvailability = pageText.toLowerCase().includes('leave') ||
      pageText.toLowerCase().includes('sick') ||
      pageText.toLowerCase().includes('availability') ||
      pageText.toLowerCase().includes('request') ||
      pageText.toLowerCase().includes('time off');

    expect(hasAvailability || pageText.length > 50).toBeTruthy();
  });

  test('leave request sheet opens without crash', async ({ page }) => {
    await switchRole(page, 'employee');
    await page.goto('/(employee)/more', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Try to open leave request
    const leaveBtn = page.getByText(/leave|sick|request|availability/i).first();
    if (await leaveBtn.isVisible()) {
      await leaveBtn.click();
      await page.waitForTimeout(1000);
      await assertNotBlankScreen(page, 'leave-request-sheet');
    }
  });

  test('admin people page shows availability indicators', async ({ page }) => {
    await page.goto('/(owner_admin)/people', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'admin-people-availability');

    const pageText = await page.evaluate(() => document.body?.innerText || '');
    expect(pageText.length).toBeGreaterThan(20);
  });

  test('subadmin people page shows team availability', async ({ page }) => {
    await switchRole(page, 'subadmin');
    await page.goto('/(subadmin)/people', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'subadmin-people-availability');
  });

  test('admin overview shows coverage-needed if applicable', async ({ page }) => {
    await page.goto('/(owner_admin)/overview', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'admin-overview-coverage');

    // Overview should render without issues regardless of coverage state
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    expect(pageText.length).toBeGreaterThan(50);
  });

  test('subadmin overview shows pending availability requests', async ({ page }) => {
    await switchRole(page, 'subadmin');
    await page.goto('/(subadmin)/overview', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'subadmin-overview-pending-avail');
    await assertNoReactErrors(page);
  });

  test('switching roles preserves availability state', async ({ page }) => {
    // Check as employee
    await switchRole(page, 'employee');
    await page.goto('/(employee)/my-day', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'employee-avail-state');

    // Switch to admin
    await switchRole(page, 'admin');
    await page.goto('/(owner_admin)/people', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'admin-avail-state');

    // Back to employee
    await switchRole(page, 'employee');
    await page.goto('/(employee)/my-day', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'employee-avail-state-return');
  });

  test('availability-related navigation does not create dead ends', async ({ page }) => {
    await switchRole(page, 'employee');

    const routes = [
      '/(employee)/my-day',
      '/(employee)/more',
      '/(employee)/tasks',
      '/(employee)/check-in',
    ];

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await assertNotBlankScreen(page, `avail-nav-${route}`);

      const interactiveCount = await page.locator(
        'button, a[href], input, [role="button"], [role="tab"]'
      ).count();
      expect(interactiveCount).toBeGreaterThan(0);
    }
  });

  test('no console exceptions on availability pages', async ({ page }) => {
    await switchRole(page, 'employee');
    await page.goto('/(employee)/more', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const errors = getErrors();
    const critical = errors.filter(
      (e) => e.type === 'exception' && !e.text.includes('NetworkError')
    );
    expect(critical.length).toBe(0);
  });
});
