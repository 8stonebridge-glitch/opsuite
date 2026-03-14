/**
 * DAY 7 — STRESS TEST AND EDGE CASES
 *
 * Attempts to break the system with:
 * - Rapid org switching
 * - Rapid role switching
 * - Many page navigations in sequence
 * - Long text inputs
 * - Empty state detection
 * - Cross-role page access
 * - Frequent reloads
 * - Invalid route access
 * - Large viewport and small viewport rendering
 *
 * This is the "try to break everything" day.
 */

import { test, expect } from '@playwright/test';
import {
  collectConsoleErrors,
  collectNetworkErrors,
  assertNotBlankScreen,
  assertNoReactErrors,
  assertNotDeadEnd,
  signIn,
  trySignIn,
  switchRole,
  humanDelay,
  frustratedReload,
  rapidTabSwitch,
  TEST_ADMIN,
} from './helpers';

test.describe('Day 7 — Stress Test and Edge Cases', () => {
  let getErrors: ReturnType<typeof collectConsoleErrors>;
  let getNetworkErrors: ReturnType<typeof collectNetworkErrors>;

  test.beforeEach(async ({ page }) => {
    getErrors = collectConsoleErrors(page);
    getNetworkErrors = collectNetworkErrors(page);
    const success = await trySignIn(page);
    if (!success) test.skip(!success, "No valid credentials for external auth mode");
    await page.waitForTimeout(1000);
  });

  test.afterEach(async ({ page }) => {
    const errors = getErrors();
    const netErrors = getNetworkErrors();
    if (errors.length > 0) console.log('Console errors:', JSON.stringify(errors, null, 2));
    if (netErrors.length > 0) console.log('Network errors:', JSON.stringify(netErrors, null, 2));
  });

  // ─────────────────────────────────────────────────────────────────────

  test('rapid role switching 10 times does not crash', async ({ page }) => {
    const roles: ('admin' | 'subadmin' | 'employee')[] = [
      'admin', 'subadmin', 'employee', 'admin', 'employee',
      'subadmin', 'admin', 'employee', 'subadmin', 'admin',
    ];

    for (const role of roles) {
      await switchRole(page, role);
      await page.waitForTimeout(200);
    }

    await page.waitForTimeout(1000);
    await assertNotBlankScreen(page, 'post-rapid-role-switch-10x');
  });

  test('visiting every route in the app sequentially', async ({ page }) => {
    const allRoutes = [
      // Admin routes
      '/(owner_admin)/overview',
      '/(owner_admin)/tasks',
      '/(owner_admin)/tasks/new',
      '/(owner_admin)/sites',
      '/(owner_admin)/people',
      '/(owner_admin)/more',
      // Subadmin routes
      '/(subadmin)/overview',
      '/(subadmin)/tasks',
      '/(subadmin)/people',
      '/(subadmin)/check-ins',
      '/(subadmin)/more',
      // Employee routes
      '/(employee)/my-day',
      '/(employee)/tasks',
      '/(employee)/check-in',
      '/(employee)/more',
    ];

    for (const route of allRoutes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await assertNotBlankScreen(page, `route-${route}`);
      await assertNoReactErrors(page);
    }
  });

  test('no route produces a dead-end page', async ({ page }) => {
    const keyRoutes = [
      '/(owner_admin)/overview',
      '/(owner_admin)/tasks',
      '/(owner_admin)/sites',
      '/(owner_admin)/people',
      '/(owner_admin)/more',
      '/(employee)/my-day',
      '/(employee)/tasks',
      '/(employee)/more',
    ];

    for (const route of keyRoutes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await assertNotDeadEnd(page);
    }
  });

  test('invalid route shows error or redirects (not blank)', async ({ page }) => {
    await page.goto('/nonexistent-page', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Should either show an error page, redirect, or at least not be blank
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('double reload on every main page', async ({ page }) => {
    const pages = [
      '/(owner_admin)/overview',
      '/(owner_admin)/tasks',
      '/(employee)/my-day',
    ];

    for (const p of pages) {
      await page.goto(p, { waitUntil: 'networkidle' });
      await frustratedReload(page);
    }
  });

  test('long text input does not break layout', async ({ page }) => {
    await page.goto('/(owner_admin)/tasks/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const titleInput = page.locator('input[placeholder*="title" i], input[placeholder*="task" i]').first();
    if (await titleInput.isVisible()) {
      // Type a very long title
      const longTitle = 'X'.repeat(200);
      await titleInput.fill(longTitle);

      // Type a very long description
      const noteInput = page.locator('textarea, input[placeholder*="note" i], input[placeholder*="description" i]').first();
      if (await noteInput.isVisible()) {
        const longNote = 'Long note content. '.repeat(50);
        await noteInput.fill(longNote);
      }

      await assertNotBlankScreen(page, 'long-text-input');
    }
  });

  test('special characters in inputs do not cause errors', async ({ page }) => {
    await page.goto('/(owner_admin)/tasks/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const titleInput = page.locator('input[placeholder*="title" i], input[placeholder*="task" i]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('Task with <script>alert("xss")</script> & "quotes" \'apostrophes\'');
      await assertNotBlankScreen(page, 'special-chars');
      await assertNoReactErrors(page);
    }
  });

  test('empty states render correctly (no tasks)', async ({ page }) => {
    // Check that pages handle empty data gracefully
    await switchRole(page, 'employee');
    await page.goto('/(employee)/tasks', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'empty-tasks');

    await page.goto('/(employee)/my-day', { waitUntil: 'networkidle' });
    await assertNotBlankScreen(page, 'empty-my-day');
  });

  test('switching view modes (card/table) if available', async ({ page }) => {
    await page.goto('/(owner_admin)/tasks', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Try to find view toggle buttons
    const viewToggles = page.locator('[aria-label*="view" i], [aria-label*="grid" i], [aria-label*="list" i]');
    const toggleCount = await viewToggles.count();

    if (toggleCount > 0) {
      for (let i = 0; i < toggleCount; i++) {
        await viewToggles.nth(i).click();
        await page.waitForTimeout(300);
        await assertNotBlankScreen(page, `view-toggle-${i}`);
      }
    }
  });

  test('site/team grouping toggles if available', async ({ page }) => {
    await page.goto('/(owner_admin)/tasks', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Try to find grouping toggles (Site, Team, etc.)
    const groupBtns = page.getByText(/by site|by team|group/i);
    const count = await groupBtns.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        await groupBtns.nth(i).click();
        await page.waitForTimeout(500);
        await assertNotBlankScreen(page, `grouping-toggle-${i}`);
      }
    }
  });

  test('inbox button renders and opens', async ({ page }) => {
    await page.goto('/(owner_admin)/overview', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Find inbox/notification button
    const inboxBtn = page.locator(
      '[aria-label*="inbox" i], [aria-label*="notification" i]'
    ).first();

    if (await inboxBtn.isVisible()) {
      await inboxBtn.click();
      await page.waitForTimeout(1000);
      await assertNotBlankScreen(page, 'inbox-open');

      // Close inbox
      const closeBtn = page.locator('[aria-label*="close" i]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('inbox opens and closes repeatedly without crash', async ({ page }) => {
    await page.goto('/(owner_admin)/overview', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const inboxBtn = page.locator(
      '[aria-label*="inbox" i], [aria-label*="notification" i]'
    ).first();

    if (await inboxBtn.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await inboxBtn.click();
        await page.waitForTimeout(300);

        // Try to close via backdrop or close button
        const closeBtn = page.locator('[aria-label*="close" i]').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          // Click backdrop
          await page.mouse.click(10, 10);
        }
        await page.waitForTimeout(200);
      }
      await assertNotBlankScreen(page, 'inbox-repeated-toggle');
    }
  });

  test('browser back/forward navigation stress test', async ({ page }) => {
    const routes = [
      '/(owner_admin)/overview',
      '/(owner_admin)/tasks',
      '/(owner_admin)/sites',
      '/(owner_admin)/people',
      '/(owner_admin)/more',
    ];

    // Navigate forward through all pages
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
    }

    // Go back through all pages
    for (let i = 0; i < routes.length - 1; i++) {
      await page.goBack();
      await page.waitForTimeout(500);
      await assertNotBlankScreen(page, `back-nav-${i}`);
    }

    // Go forward through all pages
    for (let i = 0; i < routes.length - 1; i++) {
      await page.goForward();
      await page.waitForTimeout(500);
      await assertNotBlankScreen(page, `forward-nav-${i}`);
    }
  });

  test('viewport resize does not crash (mobile to desktop)', async ({ page }) => {
    await page.goto('/(owner_admin)/overview', { waitUntil: 'networkidle' });

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await assertNotBlankScreen(page, 'mobile-viewport');

    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await assertNotBlankScreen(page, 'tablet-viewport');

    // Desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);
    await assertNotBlankScreen(page, 'desktop-viewport');
  });

  test('no critical console errors across all pages', async ({ page }) => {
    const routes = [
      '/(owner_admin)/overview',
      '/(owner_admin)/tasks',
      '/(employee)/my-day',
      '/(subadmin)/overview',
    ];

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    }

    const errors = getErrors();
    const critical = errors.filter(
      (e) =>
        e.type === 'exception' &&
        !e.text.includes('NetworkError') &&
        !e.text.includes('clerk-telemetry') &&
        !e.text.includes('ChunkLoadError')
    );

    if (critical.length > 0) {
      console.error('Critical errors found:', JSON.stringify(critical, null, 2));
    }
    expect(critical.length).toBe(0);
  });

  test('no network 500 errors across navigation', async ({ page }) => {
    const routes = [
      '/(owner_admin)/overview',
      '/(owner_admin)/tasks',
      '/(owner_admin)/people',
      '/(subadmin)/tasks',
      '/(employee)/my-day',
    ];

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    }

    const netErrors = getNetworkErrors();
    const serverErrors = netErrors.filter((e) => e.status >= 500);

    if (serverErrors.length > 0) {
      console.error('Server errors:', JSON.stringify(serverErrors, null, 2));
    }
    expect(serverErrors.length).toBe(0);
  });

  test('sign out works and redirects to sign-in', async ({ page }) => {
    await page.goto('/(owner_admin)/more', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const signOutBtn = page.getByText(/sign out|log out|logout/i).first();
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
      await page.waitForTimeout(2000);

      // Should redirect to sign-in
      const url = page.url();
      expect(url).toContain('sign-in');
      await assertNotBlankScreen(page, 'post-sign-out');
    }
  });
});
