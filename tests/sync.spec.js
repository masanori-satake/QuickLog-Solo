import { test, expect } from '@playwright/test';

test.describe('Multi-tab Synchronization', () => {
  test('should synchronize theme across two tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('/projects/app/app.html');
    await page2.goto('/projects/app/app.html');

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

    await page1.goto('/projects/app/app.html');
    await page2.goto('/projects/app/app.html');

    // Start a task on page 1
    const catBtn = page1.locator('.category-btn').first();
    const catName = await catBtn.textContent();
    await catBtn.click();

    // Switch to page 2 and check if the task is active
    await page2.bringToFront();
    await expect(page2.locator('#current-task-name-text')).toHaveText(catName);
    await expect(page2.locator('#status-label')).toHaveText('play_arrow');
  });

  test('should reload other tabs on maintenance action (Clear Logs)', async ({ context }) => {
    // Use a custom DB to avoid interference
    const dbName = `SyncTestDB_${Math.random().toString(36).substring(7)}`;
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto(`/projects/app/app.html?db=${dbName}`);
    await page2.goto(`/projects/app/app.html?db=${dbName}`);

    // Wait for dummy history to be generated
    await page1.waitForSelector('.log-item');
    const dummyCount = await page1.locator('.log-item').count();

    // Add a log entry (by starting and ending a task)
    await page1.locator('.category-btn').first().click();
    await page1.click('#end-btn');
    await page1.click('#confirm-ok-btn');

    // Verify log exists on both
    const countBefore = dummyCount + 2;
    await expect(page1.locator('.log-item')).toHaveCount(countBefore);
    await page2.bringToFront();
    await expect(page2.locator('.log-item')).toHaveCount(countBefore);

    // Clear logs on page 1
    await page1.bringToFront();
    await page1.click('#settings-toggle');
    await page1.click('button[data-tab="maintenance"]');
    await page1.click('#clear-logs-btn');
    await page1.click('#confirm-ok-btn');

    // page 2 should reload and have dummy logs again (since logs were cleared, it regenerates)
    await page2.bringToFront();

    // Use an expectation that retries until the dummy history is generated and rendered
    await expect(async () => {
      const count = await page2.locator('.log-item').count();
      expect(count).toBeGreaterThanOrEqual(15);
    }).toPass({ timeout: 10000 });
  });
});
