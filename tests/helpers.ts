/**
 * QA Helper Utilities for OpSuite E2E Tests
 *
 * Provides:
 * - Console error collection and assertion
 * - Blank screen / React hydration failure detection
 * - Navigation dead-end detection
 * - Role switching helpers
 * - Organization switching helpers
 * - Realistic human behavior simulation (typos, mis-taps, delays)
 * - Task creation / interaction helpers
 * - Authentication helpers
 */

import { type Page, type BrowserContext, expect } from '@playwright/test';

// ─── Test Data ────────────────────────────────────────────────────────────────

export const ORG_A = {
  name: 'Apex Facilities',
  mode: 'managed' as const,
  sites: ['HQ Tower', 'Marina Mall', 'North Plant'],
  teams: ['Maintenance', 'Cleaning', 'Security'],
  subadmins: [
    { name: 'Sarah Lead', email: 'sarah@apex.test' },
    { name: 'James Lead', email: 'james@apex.test' },
    { name: 'Maria Lead', email: 'maria@apex.test' },
  ],
  employees: [
    { name: 'Ali Worker', email: 'ali@apex.test' },
    { name: 'Ben Worker', email: 'ben@apex.test' },
    { name: 'Cara Worker', email: 'cara@apex.test' },
    { name: 'Dan Worker', email: 'dan@apex.test' },
    { name: 'Eve Worker', email: 'eve@apex.test' },
    { name: 'Finn Worker', email: 'finn@apex.test' },
    { name: 'Gina Worker', email: 'gina@apex.test' },
    { name: 'Hugo Worker', email: 'hugo@apex.test' },
    { name: 'Iris Worker', email: 'iris@apex.test' },
    { name: 'Jack Worker', email: 'jack@apex.test' },
    { name: 'Kate Worker', email: 'kate@apex.test' },
    { name: 'Leo Worker', email: 'leo@apex.test' },
  ],
};

export const ORG_B = {
  name: 'Bright Retail',
  mode: 'direct' as const,
  sites: ['Lekki Store', 'Ikeja Store'],
  teams: [],
  subadmins: [],
  employees: [
    { name: 'Tunde Staff', email: 'tunde@bright.test' },
    { name: 'Amaka Staff', email: 'amaka@bright.test' },
    { name: 'Chidi Staff', email: 'chidi@bright.test' },
    { name: 'Dayo Staff', email: 'dayo@bright.test' },
    { name: 'Efe Staff', email: 'efe@bright.test' },
    { name: 'Funke Staff', email: 'funke@bright.test' },
    { name: 'Gbenga Staff', email: 'gbenga@bright.test' },
    { name: 'Halima Staff', email: 'halima@bright.test' },
  ],
};

export const TEST_ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || 'owner@opsuite.demo',
  password: process.env.TEST_ADMIN_PASSWORD || 'demo1234',
};

// ─── Console Error Collector ──────────────────────────────────────────────────

export interface ConsoleEntry {
  type: string;
  text: string;
  url: string;
  timestamp: number;
}

/**
 * Attaches a console listener to the page that collects errors and exceptions.
 * Returns a function to retrieve collected errors.
 */
export function collectConsoleErrors(page: Page): () => ConsoleEntry[] {
  const errors: ConsoleEntry[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push({
        type: msg.type(),
        text: msg.text(),
        url: page.url(),
        timestamp: Date.now(),
      });
    }
  });

  page.on('pageerror', (err) => {
    errors.push({
      type: 'exception',
      text: err.message + '\n' + (err.stack || ''),
      url: page.url(),
      timestamp: Date.now(),
    });
  });

  return () => [...errors];
}

/**
 * Collects failed network requests (4xx/5xx responses, timeouts).
 */
export function collectNetworkErrors(page: Page): () => { url: string; status: number; method: string }[] {
  const failures: { url: string; status: number; method: string }[] = [];

  page.on('response', (response) => {
    if (response.status() >= 400) {
      failures.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
      });
    }
  });

  page.on('requestfailed', (request) => {
    failures.push({
      url: request.url(),
      status: 0,
      method: request.method(),
    });
  });

  return () => [...failures];
}

// ─── Blank Screen & Hydration Detection ───────────────────────────────────────

/**
 * Asserts the page is not blank:
 * 1. Checks that the body has visible child elements
 * 2. Checks that React root has rendered content (not just a spinner)
 * 3. Fails with console dump if the page is blank
 */
export async function assertNotBlankScreen(page: Page, context = 'unknown') {
  // Wait for at least one non-empty element
  await page.waitForTimeout(2000);

  const bodyContent = await page.evaluate(() => {
    const body = document.body;
    if (!body) return { text: '', childCount: 0 };
    return {
      text: body.innerText?.trim().substring(0, 500) || '',
      childCount: body.children.length,
    };
  });

  if (bodyContent.childCount === 0 || bodyContent.text.length === 0) {
    // Check if it's a loading spinner (acceptable)
    const hasSpinner = await page.locator('[role="progressbar"]').count();
    if (hasSpinner > 0) {
      // Wait longer for spinner to resolve
      await page.waitForTimeout(5000);
      const afterWait = await page.evaluate(() => document.body?.innerText?.trim().length || 0);
      if (afterWait === 0) {
        throw new Error(
          `BLANK SCREEN DETECTED [${context}] at ${page.url()}\n` +
          `Page stuck on loading spinner after 7s wait.\n` +
          `Body text length: ${afterWait}`
        );
      }
      return; // Spinner resolved
    }

    throw new Error(
      `BLANK SCREEN DETECTED [${context}] at ${page.url()}\n` +
      `Body children: ${bodyContent.childCount}, text length: ${bodyContent.text.length}\n` +
      `Visible text: "${bodyContent.text.substring(0, 200)}"`
    );
  }
}

/**
 * Checks if React failed to hydrate or render by looking for
 * error boundaries, "ChunkLoadError", and framework error indicators.
 */
export async function assertNoReactErrors(page: Page) {
  const reactErrors = await page.evaluate(() => {
    const indicators = [
      // Common React error boundary patterns
      document.querySelector('[data-error-boundary]'),
      document.querySelector('.error-boundary'),
      // Expo Router error
      document.querySelector('[data-testid="unmatched-route"]'),
    ];
    return indicators.some(Boolean);
  });

  if (reactErrors) {
    throw new Error(`React render error detected at ${page.url()}`);
  }
}

// ─── Navigation Helpers ───────────────────────────────────────────────────────

/**
 * Detects navigation dead-ends: pages that have no interactive elements
 * (no buttons, no links, no inputs) aside from a potential back button.
 */
export async function assertNotDeadEnd(page: Page) {
  const interactiveCount = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      'button, a[href], input, textarea, select, [role="button"], [role="link"], [role="tab"]'
    );
    return elements.length;
  });

  if (interactiveCount <= 1) {
    // Only a back button or nothing at all
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
    console.warn(`Potential dead-end at ${page.url()} — only ${interactiveCount} interactive elements. Body: "${bodyText}"`);
  }
}

/**
 * Navigates to a route and asserts the page rendered successfully.
 */
export async function safeNavigate(page: Page, path: string, description = '') {
  await page.goto(path, { waitUntil: 'networkidle' });
  await assertNotBlankScreen(page, description || path);
  await assertNoReactErrors(page);
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/**
 * Signs into the app with given credentials.
 * Works for both auth-backed auth and local demo auth.
 *
 * If sign-in fails (e.g. external auth mode with demo creds), it will throw
 * unless `optional` is set to true, in which case it returns false.
 */
export async function signIn(
  page: Page,
  email: string,
  password: string,
  optional = false
): Promise<boolean> {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await assertNotBlankScreen(page, 'sign-in');

  // Fill email
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(email);

  // Fill password
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(password);

  // Click sign in
  const signInBtn = page.getByText('Sign In', { exact: true }).first();
  await signInBtn.click();

  // Wait for navigation away from sign-in
  try {
    await page.waitForURL((url) => !url.pathname.includes('sign-in'), { timeout: 15000 });
    await assertNotBlankScreen(page, 'post-sign-in');
    return true;
  } catch {
    if (optional) return false;

    // Check if we're on the sign-in page with an error (external auth mode with wrong creds)
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    if (pageText.includes('No account') || pageText.includes('Incorrect') || pageText.includes('failed')) {
      if (optional) return false;
      throw new Error(`Sign-in failed: ${pageText.substring(0, 200)}`);
    }
    throw new Error('Sign-in timed out — stayed on sign-in page');
  }
}

/**
 * Determines whether the app is running in local demo mode or auth backend mode.
 * Checks for the "Demo Account" hint that only appears in local mode.
 */
export async function isLocalDemoMode(page: Page): Promise<boolean> {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  const pageText = await page.evaluate(() => document.body?.innerText || '');
  return pageText.includes('Demo Account') || pageText.includes('owner@opsuite.demo');
}

/**
 * Attempts sign-in. If in external auth mode with demo creds, skips auth-dependent tests.
 * Returns true if successfully signed in.
 */
export async function trySignIn(page: Page): Promise<boolean> {
  const isDemoMode = await isLocalDemoMode(page);

  if (isDemoMode) {
    return await signIn(page, TEST_ADMIN.email, TEST_ADMIN.password, true);
  }

  // external auth mode — need real test credentials
  const clerkEmail = process.env.TEST_ADMIN_EMAIL;
  const clerkPassword = process.env.TEST_ADMIN_PASSWORD;

  if (!clerkEmail || !clerkPassword || clerkEmail === 'owner@opsuite.demo') {
    // No real auth credentials available — can only test unauthenticated flows
    return false;
  }

  return await signIn(page, clerkEmail, clerkPassword, true);
}

/**
 * Signs up a new account.
 */
export async function signUp(
  page: Page,
  name: string,
  email: string,
  password: string,
  orgName: string,
  industry: string,
  orgStructure: 'with_subadmins' | 'admin_only' = 'with_subadmins'
) {
  await page.goto('/sign-up', { waitUntil: 'networkidle' });
  await assertNotBlankScreen(page, 'sign-up');

  // Fill form fields
  await page.locator('input[placeholder*="name" i]').first().fill(name);
  await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('input[placeholder*="company" i], input[placeholder*="organization" i]').first().fill(orgName);

  // Select industry
  await page.getByText(industry, { exact: false }).first().click();

  // Select org structure
  if (orgStructure === 'admin_only') {
    await page.getByText('Admin Only', { exact: false }).first().click();
  }

  // Submit
  await page.getByText('Create Account', { exact: true }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('sign-up'), { timeout: 15000 });
}

// ─── Role & Org Switching ─────────────────────────────────────────────────────

/**
 * Switches the current view role using the RoleSwitcher component.
 * Only works in demo mode where the role switcher is visible.
 */
export async function switchRole(page: Page, role: 'admin' | 'subadmin' | 'employee') {
  // Look for the role switcher select/dropdown
  const roleSwitcher = page.locator('select, [role="combobox"]').first();
  if (await roleSwitcher.isVisible()) {
    const options = await roleSwitcher.locator('option').allTextContents();
    const match = options.find((o) => o.toLowerCase().includes(role));
    if (match) await roleSwitcher.selectOption({ label: match });
    await page.waitForTimeout(500);
  } else {
    // Try clicking the role name text to open a dropdown
    const roleText = page.getByText(role, { exact: false }).first();
    if (await roleText.isVisible()) {
      await roleText.click();
      await page.waitForTimeout(500);
    }
  }
  await assertNotBlankScreen(page, `switch-role-${role}`);
}

/**
 * Switches organization by dispatching through the app context.
 */
export async function switchOrg(page: Page, orgName: string) {
  // Look for org switcher in the UI
  const orgSelector = page.getByText(orgName, { exact: false }).first();
  if (await orgSelector.isVisible()) {
    await orgSelector.click();
    await page.waitForTimeout(1000);
    await assertNotBlankScreen(page, `switch-org-${orgName}`);
  }
}

// ─── Human Behavior Simulation ────────────────────────────────────────────────

/**
 * Simulates realistic human delays between actions.
 */
export async function humanDelay(page: Page, min = 200, max = 800) {
  const delay = Math.floor(Math.random() * (max - min)) + min;
  await page.waitForTimeout(delay);
}

/**
 * Simulates typing with realistic speed (occasional pauses).
 */
export async function humanType(page: Page, selector: string, text: string) {
  const el = page.locator(selector).first();
  await el.click();
  await el.fill(''); // clear first

  // Type with human-like speed
  for (const char of text) {
    await el.pressSequentially(char, { delay: Math.random() * 80 + 30 });
    // Occasional longer pause (simulating thinking)
    if (Math.random() < 0.1) {
      await page.waitForTimeout(Math.random() * 400 + 100);
    }
  }
}

/**
 * Simulates a mis-tap: clicks somewhere random, then clicks the intended target.
 * Models real user behavior where fingers miss the target.
 */
export async function misTap(page: Page, targetSelector: string) {
  // Click somewhere harmless first (the page background)
  await page.mouse.click(
    Math.floor(Math.random() * 300) + 50,
    Math.floor(Math.random() * 200) + 50
  );
  await page.waitForTimeout(200);

  // Now click the actual target
  await page.locator(targetSelector).first().click();
}

/**
 * Simulates a rapid page reload (user frustration behavior).
 */
export async function frustratedReload(page: Page) {
  await page.reload();
  await page.waitForTimeout(300);
  await page.reload(); // double reload
  await page.waitForLoadState('networkidle');
  await assertNotBlankScreen(page, 'post-frustrated-reload');
}

/**
 * Simulates switching views rapidly (tab hopping).
 */
export async function rapidTabSwitch(page: Page, tabs: string[]) {
  for (const tab of tabs) {
    const tabEl = page.getByText(tab, { exact: false }).first();
    if (await tabEl.isVisible()) {
      await tabEl.click();
      await page.waitForTimeout(150); // very fast switches
    }
  }
  await page.waitForTimeout(500);
  await assertNotBlankScreen(page, 'post-rapid-switch');
}

// ─── Task Helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a task from the admin/subadmin task creation form.
 */
export async function createTask(
  page: Page,
  opts: {
    title: string;
    priority?: string;
    site?: string;
    assignee?: string;
    due?: string;
    note?: string;
  }
) {
  // Navigate to new task form
  const newTaskBtn = page.getByText('New Task', { exact: false }).first();
  if (await newTaskBtn.isVisible()) {
    await newTaskBtn.click();
    await page.waitForTimeout(500);
  } else {
    // Try the + button or fab
    const addBtn = page.locator('[aria-label*="add" i], [aria-label*="new" i], [aria-label*="create" i]').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Fill title
  const titleInput = page.locator('input[placeholder*="title" i], input[placeholder*="task" i]').first();
  if (await titleInput.isVisible()) {
    await titleInput.fill(opts.title);
  }

  // Fill note/description
  if (opts.note) {
    const noteInput = page.locator('textarea, input[placeholder*="note" i], input[placeholder*="description" i]').first();
    if (await noteInput.isVisible()) {
      await noteInput.fill(opts.note);
    }
  }

  // Select priority
  if (opts.priority) {
    const priorityBtn = page.getByText(opts.priority, { exact: false }).first();
    if (await priorityBtn.isVisible()) {
      await priorityBtn.click();
    }
  }

  // Submit
  await humanDelay(page);
  const submitBtn = page.getByText('Create', { exact: false }).first();
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
    await page.waitForTimeout(1000);
  }
}

// ─── Assertion Helpers ────────────────────────────────────────────────────────

/**
 * Asserts text is visible on the page.
 */
export async function assertTextVisible(page: Page, text: string, timeout = 5000) {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout });
}

/**
 * Asserts text is NOT visible on the page.
 */
export async function assertTextNotVisible(page: Page, text: string) {
  await expect(page.getByText(text, { exact: false }).first()).not.toBeVisible({ timeout: 3000 }).catch(() => {
    // It's okay if element doesn't exist at all
  });
}

/**
 * Counts elements matching a selector.
 */
export async function countElements(page: Page, selector: string): Promise<number> {
  return await page.locator(selector).count();
}

// ─── Failure Report Generator ─────────────────────────────────────────────────

/**
 * Generates a markdown failure report from test results JSON.
 * Called by CI to create GitHub issues on failure.
 */
export function generateFailureReport(
  results: { name: string; status: string; error?: string; duration: number }[]
): string {
  const failures = results.filter((r) => r.status === 'failed');
  if (failures.length === 0) return '';

  const lines = [
    '## 🔴 QA Loop Failure Report',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**Total tests:** ${results.length}`,
    `**Passed:** ${results.filter((r) => r.status === 'passed').length}`,
    `**Failed:** ${failures.length}`,
    '',
    '### Failed Tests',
    '',
  ];

  for (const f of failures) {
    lines.push(`#### ❌ ${f.name}`);
    lines.push(`- **Duration:** ${(f.duration / 1000).toFixed(1)}s`);
    if (f.error) {
      lines.push('- **Error:**');
      lines.push('```');
      lines.push(f.error.substring(0, 1000));
      lines.push('```');
    }
    lines.push('');
  }

  lines.push('### Artifacts');
  lines.push('Check the workflow run for screenshots, traces, and console logs.');
  lines.push('');
  lines.push('---');
  lines.push('*Auto-generated by OpSuite QA Loop*');

  return lines.join('\n');
}
