import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Abnormal Import Cases', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('?lang=ja');
        await page.waitForSelector('.category-btn');
        // Open settings and go to categories tab
        await page.click('#settings-toggle');
        await page.click('button[data-tab="categories"]');
        // Select overwrite mode to make verification easier (items will be on page 1)
        await page.click('input[name="import-mode"][value="overwrite"]');
    });

    test('should handle Level 1: Fatal Error (Completely invalid file)', async ({ page }) => {
        const filePath = path.join(process.cwd(), 'temp_fatal.ndjson');
        fs.writeFileSync(filePath, 'This is not JSON at all\nDefinitely not');

        // Listen for alert
        page.on('dialog', async dialog => {
            expect(dialog.message()).toContain('ファイル形式が正しくありません');
            await dialog.dismiss();
        });

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#import-categories-btn');
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePath);

        fs.unlinkSync(filePath);
    });

    test('should handle Level 2: Partial Error (Some lines invalid JSON)', async ({ page }) => {
        const filePath = path.join(process.cwd(), 'temp_partial.ndjson');
        fs.writeFileSync(filePath, '{"name":"Valid1","color":"teal"}\n{Invalid JSON}\n{"name":"Valid2","color":"orange"}');

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#import-categories-btn');
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePath);

        // Expect custom confirm modal for partial error
        await expect(page.locator('#confirm-modal')).toBeVisible();
        await expect(page.locator('#confirm-message')).toContainText('3行中1行が破損しています');
        await page.click('#confirm-ok-btn');
        // Wait for modal to update content rather than hide/show quickly
        await expect(page.locator('#confirm-message')).not.toContainText('破損しています');

        // For overwrite mode, we get ANOTHER confirmation
        await expect(page.locator('#confirm-modal')).toBeVisible();
        await page.click('#confirm-ok-btn');
        await expect(page.locator('#confirm-modal')).toBeHidden();

        // Verify valid items imported
        await page.click('#settings-popup .close-btn'); // Close settings
        await expect(page.locator('.category-btn:has-text("Valid1")')).toBeVisible();
        await expect(page.locator('.category-btn:has-text("Valid2")')).toBeVisible();

        fs.unlinkSync(filePath);
    });

    test('should handle Level 3: Field Level validation (Invalid fields)', async ({ page }) => {
        const filePath = path.join(process.cwd(), 'temp_fields.ndjson');
        // Valid but invalid color, and empty name
        fs.writeFileSync(filePath, '{"name":"Valid1","color":"teal"}\n{"name":"InvalidColor","color":"invalid"}\n{"name":"","color":"orange"}');

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#import-categories-btn');
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePath);

        // Multi-choice modal should appear
        await expect(page.locator('#multi-choice-modal')).toBeVisible();
        await expect(page.locator('#multi-choice-message')).toContainText('一部のデータに不備');

        // Click "Apply Defaults"
        await page.click('#multi-choice-btn-container button:has-text("デフォルト値を適用")');
        await expect(page.locator('#multi-choice-modal')).toBeHidden();

        // For overwrite mode, we get ANOTHER confirmation
        await expect(page.locator('#confirm-modal')).toBeVisible();
        await page.click('#confirm-ok-btn');
        await expect(page.locator('#confirm-modal')).toBeHidden();

        // Verify everything imported with fallbacks
        await page.click('#settings-popup .close-btn'); // Close settings
        await expect(page.locator('.category-btn:has-text("Valid1")')).toBeVisible();
        await expect(page.locator('.category-btn:has-text("InvalidColor")')).toBeVisible();
        await expect(page.locator('.category-btn:has-text("Imported Category")')).toBeVisible();

        fs.unlinkSync(filePath);
    });
});
