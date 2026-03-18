import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.describe('Data Import and Export Consistency', () => {
    test.slow();

    test.beforeEach(async ({ context, page }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        const dbName = `DataIOTestDB_${Math.random().toString(36).substring(7)}`;
        await page.goto(`/projects/app/app.html?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');
    });

    test('should export categories as NDJSON and match schema', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.click('button[data-tab="categories"]');

        await page.click('#export-categories-btn');

        const clipboardText = await page.evaluate(async () => {
            // Wait for clipboard update
            for(let i=0; i<10; i++) {
                const text = await navigator.clipboard.readText();
                if (text && text.includes('QuickLogSolo/Category')) return text;
                await new Promise(r => setTimeout(r, 100));
            }
            return navigator.clipboard.readText();
        });
        const lines = clipboardText.split('\n').filter(l => l.trim());

        expect(lines.length).toBeGreaterThan(0);

        for (const line of lines) {
            const data = JSON.parse(line);
            expect(data.kind).toBe('QuickLogSolo/Category');
            expect(data.version).toBe('1.0');
            expect(data.type).toMatch(/category|page-break/);
        }
    });

    test('should export history as CSV and match DB content', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.click('button[data-tab="maintenance"]');
        await page.click('#clear-logs-btn');
        await page.click('#confirm-ok-btn');
        await page.click('.close-btn');

        const firstCat = page.locator('.category-btn').first();
        const catName = await firstCat.textContent();
        await firstCat.click();
        await page.click('#end-btn');
        await page.click('#confirm-ok-btn');

        await page.click('#settings-toggle');
        await page.click('button[data-tab="general"]');

        const downloadPromise = page.waitForEvent('download');
        await page.click('#export-csv-btn');
        // Handle confirmation modal
        await page.click('#confirm-ok-btn');

        const download = await downloadPromise;
        const downloadPath = await download.path();
        const csvContent = fs.readFileSync(downloadPath, 'utf8');
        const lines = csvContent.split('\n').filter(l => l.trim());

        expect(lines[0]).toBe('id,category,startTime,endTime');
        expect(lines.length).toBeGreaterThan(1);
        /* eslint-disable-next-line no-control-regex */
        expect(lines[1]).toContain(catName.replace(/[^\x00-\x7F]/g, ""));
    });

    test('should handle Category Import Overwrite mode correctly', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.click('button[data-tab="categories"]');
        await page.click('input[name="import-mode"][value="overwrite"]');

        const importData = JSON.stringify({
            kind: 'QuickLogSolo/Category',
            version: '1.0',
            type: 'category',
            name: 'ImportedTestCat',
            color: 'teal'
        });

        await page.evaluate((text) => navigator.clipboard.writeText(text), importData);
        await page.click('#import-categories-btn');
        await page.click('#confirm-ok-btn');

        await page.click('.close-btn');

        const catBtn = page.locator('.category-btn').first();
        await expect(catBtn).toHaveText('ImportedTestCat');
        await expect(page.locator('.category-btn')).toHaveCount(1);
    });

    test('should handle partial errors during category import', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.click('button[data-tab="categories"]');

        const mixedData = 'Not JSON\n' + JSON.stringify({
            kind: 'QuickLogSolo/Category',
            version: '1.0',
            type: 'category',
            name: 'ValidItem',
            color: 'orange'
        });
        await page.evaluate((text) => navigator.clipboard.writeText(text), mixedData);

        await page.click('#import-categories-btn');

        const confirmMsg = page.locator('#confirm-message');
        await expect(confirmMsg).toContainText(/1 out of 2 rows are corrupted/);
        await page.click('#confirm-ok-btn');

        await page.click('.close-btn');
        const validItem = page.locator('.category-btn').filter({ hasText: 'ValidItem' });

        const dots = page.locator('.pagination-dot');
        const count = await dots.count();
        for(let i=0; i<count; i++) {
            if (await validItem.isVisible()) break;
            await dots.nth(i).click();
        }
        await expect(validItem).toBeVisible();
    });

    test('should reject category data with missing kind/version (Legacy Data)', async ({ page }) => {
        await page.click('#settings-toggle');
        await page.click('button[data-tab="categories"]');

        const legacyData = JSON.stringify({
            type: 'category',
            name: 'LegacyCat',
            color: 'orange'
        });

        await page.evaluate((text) => navigator.clipboard.writeText(text), legacyData);

        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('Invalid file format');
            await dialog.dismiss();
        });

        await page.click('#import-categories-btn');
    });
});
