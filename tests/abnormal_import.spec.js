import { test, expect } from '@playwright/test';

test.describe('Abnormal Import Cases', () => {
    test.slow(); // Give these tests more time in CI

    test.beforeEach(async ({ context, page }) => {
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        const dbName = `ImportTestDB_${Math.random().toString(36).substring(7)}`;
        await page.goto(`/projects/app/app.html?lang=ja&db=${dbName}`);
        await page.waitForSelector('.category-btn');
        // Open settings and go to categories tab
        await page.click('#settings-toggle');
        await page.click('button[data-tab="categories"]');
        // Select overwrite mode to make verification easier (items will be on page 1)
        await page.click('input[name="import-mode"][value="overwrite"]');
    });

    test('should handle Level 1: Fatal Error (Completely invalid content)', async ({ page }) => {
        const content = 'This is not JSON at all\nDefinitely not';
        await page.evaluate((text) => navigator.clipboard.writeText(text), content);

        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('ファイル形式が正しくありません');
            await dialog.dismiss();
        });

        await page.locator('#import-categories-btn').click();
    });

    test('should handle Level 1: Fatal Error (Non-object JSON values)', async ({ page }) => {
        const content = '123\n"string"\ntrue';
        await page.evaluate((text) => navigator.clipboard.writeText(text), content);

        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('ファイル形式が正しくありません');
            await dialog.dismiss();
        });

        await page.locator('#import-categories-btn').click();
    });

    test('should handle Level 1: Fatal Error (Empty content)', async ({ page }) => {
        await page.evaluate(() => navigator.clipboard.writeText(''));
        await page.click('#import-categories-btn');
        // Should not crash. Currently empty clipboard just returns early.
    });

    test('should handle Level 2: Partial Error (Some lines invalid JSON or Schema)', async ({ page }) => {
        // Valid items must follow schema
        const valid1 = JSON.stringify({ kind: 'QuickLogSolo/Category', version: '1.0', type: 'category', name: 'Valid1', color: 'teal' });
        const valid2 = JSON.stringify({ kind: 'QuickLogSolo/Category', version: '1.0', type: 'category', name: 'Valid2', color: 'orange' });
        const content = `${valid1}\n{Invalid JSON}\n${valid2}`;
        await page.evaluate((text) => navigator.clipboard.writeText(text), content);

        await page.click('#import-categories-btn');

        // Expect custom confirm modal for partial error
        await expect(page.locator('#confirm-modal')).toBeVisible();
        await expect(page.locator('#confirm-message')).toContainText('3行中1行が破損しています');
        await page.click('#confirm-ok-btn');

        // For overwrite mode, we get ANOTHER confirmation
        await expect(page.locator('#confirm-modal')).toBeVisible();
        await page.click('#confirm-ok-btn');
        await expect(page.locator('#confirm-modal')).toBeHidden();

        // Verify valid items imported
        await page.click('#settings-popup .close-btn'); // Close settings
        await expect(page.locator('.category-btn:has-text("Valid1")')).toBeVisible();
        await expect(page.locator('.category-btn:has-text("Valid2")')).toBeVisible();
    });

    test('should handle Level 3: Strict Schema validation (Invalid fields are rejected)', async ({ page }) => {
        // Legacy "repair" is gone. Non-compliant items are treated as errors.
        const valid1 = JSON.stringify({ kind: 'QuickLogSolo/Category', version: '1.0', type: 'category', name: 'Valid1', color: 'teal' });
        const invalidColor = JSON.stringify({ kind: 'QuickLogSolo/Category', version: '1.0', type: 'category', name: 'InvalidColor', color: 'invalid' });
        const emptyName = JSON.stringify({ kind: 'QuickLogSolo/Category', version: '1.0', type: 'category', name: '', color: 'orange' });

        const content = `${valid1}\n${invalidColor}\n${emptyName}`;
        await page.evaluate((text) => navigator.clipboard.writeText(text), content);

        await page.click('#import-categories-btn');

        // Should show partial error modal, NOT multi-choice (repair) modal
        await expect(page.locator('#confirm-modal')).toBeVisible();
        await expect(page.locator('#confirm-message')).toContainText('3行中2行が破損しています');
        await page.click('#confirm-ok-btn');

        // Confirmation for overwrite
        await page.click('#confirm-ok-btn');
        await expect(page.locator('#confirm-modal')).toBeHidden();

        // Verify only the valid one imported
        await page.click('#settings-popup .close-btn'); // Close settings
        await expect(page.locator('.category-btn:has-text("Valid1")')).toBeVisible();
        await expect(page.locator('.category-btn:has-text("InvalidColor")')).not.toBeVisible();
    });
});
