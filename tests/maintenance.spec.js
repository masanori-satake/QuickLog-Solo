import { test, expect } from '@playwright/test';

test.describe('Maintenance Tab', () => {
    test.beforeEach(async ({ page }) => {
        const dbName = `MaintenanceTestDB_${Date.now().toString(36)}`;
        await page.goto(`?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');
    });

    test('バックアップタブが存在しないこと', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.waitForSelector('#settings-popup', { state: 'visible' });
        const backupTab = page.locator('button[data-tab="backup"]');
        await expect(backupTab).toHaveCount(0);
    });

    test('メンテナンスタブにバックアップ・復元・削除機能が表示されること', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.waitForSelector('#settings-popup', { state: 'visible' });
        await page.click('button[data-tab="maintenance"]');

        // Verify backup/restore section exists
        await expect(page.locator('#backup-restore-section')).toBeVisible();

        // Verify restore button exists (in not-configured state, which is default for fresh DB)
        await expect(page.locator('#restore-btn')).toBeVisible();

        // Verify backup start button exists (not-configured state)
        await expect(page.locator('#backup-start-btn')).toBeVisible();

        // Verify delete/initialize section exists
        await expect(page.locator('#delete-initialize-section')).toBeVisible();
        await expect(page.locator('#delete-initialize-btn')).toBeVisible();
    });

    test('チェックボックス方式の削除/初期化が正常に動作すること', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.waitForSelector('#settings-popup', { state: 'visible' });
        await page.click('button[data-tab="maintenance"]');

        // Initially button should be disabled
        const deleteBtn = page.locator('#delete-initialize-btn');
        await expect(deleteBtn).toBeDisabled();

        // Check one checkbox (logs)
        await page.check('#clear-logs-checkbox');

        // Button should now be enabled
        await expect(deleteBtn).toBeEnabled();

        // Check another checkbox (categories)
        await page.check('#clear-categories-checkbox');

        // Button should still be enabled
        await expect(deleteBtn).toBeEnabled();

        // Uncheck all
        await page.uncheck('#clear-logs-checkbox');
        await page.uncheck('#clear-categories-checkbox');

        // Button should be disabled again
        await expect(deleteBtn).toBeDisabled();
    });

    test('全チェックボックス項目が表示されること', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.waitForSelector('#settings-popup', { state: 'visible' });
        await page.click('button[data-tab="maintenance"]');

        // Verify all 5 checkboxes exist
        await expect(page.locator('#clear-logs-checkbox')).toBeVisible();
        await expect(page.locator('#clear-categories-checkbox')).toBeVisible();
        await expect(page.locator('#clear-settings-checkbox')).toBeVisible();
        await expect(page.locator('#clear-alarms-checkbox')).toBeVisible();
        await expect(page.locator('#clear-animations-checkbox')).toBeVisible();
    });

    test('削除/初期化の実行で選択項目が消去されること', async ({ page }) => {
        // First, verify logs exist (default sample data)
        const initialCount = await page.locator('.log-item').count();
        expect(initialCount).toBeGreaterThan(0);

        // Open maintenance tab
        await page.click('#settings-toggle');
        await page.waitForSelector('#settings-popup', { state: 'visible' });
        await page.click('button[data-tab="maintenance"]');

        // Check "logs" checkbox
        await page.check('#clear-logs-checkbox');

        // Click delete/initialize button
        await page.click('#delete-initialize-btn');

        // Confirm the dialog
        await page.click('#confirm-ok-btn');

        // Wait for completion and close settings
        await page.waitForTimeout(500);
        await page.click('.settings-close-btn');

        // Verify logs are cleared
        await expect(page.locator('.log-item')).toHaveCount(0);
    });
});
