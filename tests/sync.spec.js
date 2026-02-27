import { test, expect } from '@playwright/test';

test.describe('Multi-tab Synchronization', () => {
  test('should synchronize theme across two tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('http://localhost:8080');
    await page2.goto('http://localhost:8080');

    // Open settings on page 1 and change theme
    await page1.click('#settings-toggle');
    await page1.selectOption('#theme-select', 'dark');

    // Check if page 2 (which is in background) reflects the change when it gets focus
    await page2.bringToFront();
    // We might need to wait a bit for the syncState to run after focus
    await expect(page2.locator('body')).toHaveClass(/theme-dark/);
  });

  test('should synchronize active task across two tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('http://localhost:8080');
    await page2.goto('http://localhost:8080');

    // Start a task on page 1
    const catBtn = page1.locator('.category-btn').first();
    const catName = await catBtn.textContent();
    await catBtn.click();

    // Switch to page 2 and check if the task is active
    await page2.bringToFront();
    await expect(page2.locator('#current-task-name')).toHaveText(catName);
    await expect(page2.locator('#status-label')).toHaveText('play_arrow');
  });

  test('should reload other tabs on maintenance action (Clear Logs)', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('http://localhost:8080');
    await page2.goto('http://localhost:8080');

    // Add a log entry (by starting and ending a task)
    await page1.locator('.category-btn').first().click();
    await page1.click('#end-btn');
    await page1.click('#confirm-ok-btn');

    // Verify log exists on both
    await expect(page1.locator('.log-item')).toHaveCount(2); // Task + Stop marker
    await page2.bringToFront();
    await expect(page2.locator('.log-item')).toHaveCount(2);

    // Clear logs on page 1
    await page1.bringToFront();
    await page1.click('#settings-toggle');
    await page1.click('button[data-tab="maintenance"]');
    await page1.click('#clear-logs-btn');
    await page1.click('#confirm-ok-btn');

    // page 2 should reload and have no logs
    await page2.bringToFront();
    // Wait for reload (check count again)
    await expect(page2.locator('.log-item')).toHaveCount(0);
  });
});
