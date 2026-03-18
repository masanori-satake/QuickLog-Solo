import { test, expect } from '@playwright/test';

test.describe('UI and General Settings', () => {
    test.beforeEach(async ({ page }) => {
        const dbName = `UISettingsDB_${Math.random().toString(36).substring(7)}`;
        await page.goto(`/projects/app/app.html?db=${dbName}`);
        await page.waitForSelector('#app');

        // Handle persistence modal if it appears
        const okBtn = page.locator('#confirm-ok-btn');
        try {
            await okBtn.waitFor({ state: 'visible', timeout: 2000 });
            await okBtn.click();
        } catch {
            // Modal didn't appear, ignore
        }

        // Wait for categories to load
        await page.waitForSelector('.category-btn');
    });

    test('should persist language setting across reloads', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.waitForSelector('#language-select', { state: 'visible' });

        await page.selectOption('#language-select', 'ja');
        await expect(page.locator('h2[data-i18n="settings"]')).toHaveText('設定');

        await page.reload();
        await page.waitForSelector('.category-btn');

        await page.click('#settings-toggle');
        await expect(page.locator('#language-select')).toHaveValue('ja', { timeout: 10000 });
        await expect(page.locator('h2[data-i18n="settings"]')).toHaveText('設定');
    });

    test('should persist theme setting and apply correct CSS classes', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.waitForSelector('#theme-select', { state: 'visible' });

        await page.selectOption('#theme-select', 'dark');
        await expect(page.locator('body')).toHaveClass(/theme-dark/);

        await page.reload();
        await page.waitForSelector('.category-btn');
        await expect(page.locator('body')).toHaveClass(/theme-dark/);
    });

    test('should persist font setting', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.waitForSelector('#font-select', { state: 'visible' });

        await page.selectOption('#font-select', { label: 'Inter' });
        const body = page.locator('body');
        await expect(body).toHaveCSS('--font-family', /Inter/);

        await page.reload();
        await page.waitForSelector('.category-btn');
        await expect(body).toHaveCSS('--font-family', /Inter/);
    });

    test('should persist animation setting', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.waitForSelector('#animation-select', { state: 'visible' });

        await expect(page.locator('#animation-select option[value="digital_rain"]')).toBeAttached();
        await page.selectOption('#animation-select', 'digital_rain');

        await page.reload();
        await page.waitForSelector('.category-btn');
        await page.click('#settings-toggle');
        await expect(page.locator('#animation-select')).toHaveValue('digital_rain');
    });

    test('should persist alarm settings', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.click('button[data-tab="alarms"]');

        const firstAlarm = page.locator('.alarm-item').first();
        const enabledCheckbox = firstAlarm.locator('.alarm-enabled');
        const timeInput = firstAlarm.locator('.alarm-time');
        const confirmCheckbox = firstAlarm.locator('.alarm-confirm');
        const messageInput = firstAlarm.locator('.alarm-message');
        const actionSelect = firstAlarm.locator('.alarm-action');

        await enabledCheckbox.check();
        await timeInput.fill('12:34');
        await confirmCheckbox.evaluate(node => {
            node.checked = true;
            node.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await messageInput.fill('Test Alarm Message');
        await actionSelect.selectOption('pause');

        // Wait for potential async save
        await page.waitForTimeout(500);

        await page.reload();
        await page.waitForSelector('.category-btn');
        await page.click('#settings-toggle');
        await page.click('button[data-tab="alarms"]');

        await expect(enabledCheckbox).toBeChecked();
        await expect(timeInput).toHaveValue('12:34');
        await expect(confirmCheckbox).toBeChecked();
        await expect(messageInput).toHaveValue('Test Alarm Message');
        await expect(actionSelect).toHaveValue('pause');
    });
});
