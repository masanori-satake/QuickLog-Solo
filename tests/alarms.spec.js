import { test, expect } from '@playwright/test';

test.describe('Alarms Feature', () => {
  test.beforeEach(async ({ page }) => {
    const dbName = `AlarmsTestDB_${Math.random().toString(36).substring(7)}`;
    await page.goto(`?db=${dbName}`);
    await page.waitForSelector('#app');

    // Handle persistence modal if it appears
    const okBtn = page.locator('#confirm-ok-btn');
    try {
      await okBtn.waitFor({ state: 'visible', timeout: 2000 });
      await okBtn.click();
    } catch {
      // Modal didn't appear, ignore
    }

    await page.waitForSelector('.category-btn');
  });

  test('should display alarm settings and allow updates', async ({ page }) => {
    // Open settings and go to alarms tab
    await page.click('#settings-toggle');
    await page.click('.tab-btn[data-tab="alarms"]');
    await page.waitForSelector('#alarms-tab:not(.hidden)');

    // Verify default alarms exist (5 items)
    const alarmItems = page.locator('.alarm-item');
    await expect(alarmItems).toHaveCount(5);

    // Update the first alarm
    const firstAlarm = alarmItems.first();
    const messageInput = firstAlarm.locator('.alarm-message');
    const testMessage = 'My Custom Alarm Message';

    await messageInput.fill(testMessage);
    await messageInput.blur(); // Trigger change/save

    // Verify toast appears
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await page.click('#settings-toggle');
    await page.click('.tab-btn[data-tab="alarms"]');
    await expect(page.locator('.alarm-item').first().locator('.alarm-message')).toHaveValue(testMessage);
  });

  test('should show/hide category selector based on action', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.click('.tab-btn[data-tab="alarms"]');

    const firstAlarm = page.locator('.alarm-item').first();
    const actionSelect = firstAlarm.locator('.alarm-action');
    const categoryRow = firstAlarm.locator('.alarm-category-row');

    // Default action 'none' should hide category row
    await expect(categoryRow).toHaveClass(/hidden/);

    // Switch to 'start' action
    await actionSelect.selectOption('start');
    await expect(categoryRow).not.toHaveClass(/hidden/);

    // Switch back to 'stop'
    await actionSelect.selectOption('stop');
    await expect(categoryRow).toHaveClass(/hidden/);
  });
});
