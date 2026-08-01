import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.describe('Data Import and Export Consistency', () => {
    test.slow();

    test.beforeEach(async ({ context, page }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        const dbName = `DataIOTestDB_${Math.random().toString(36).substring(7)}`;
        // baseURL in playwright.config.js points to /projects/app/app.html
        await page.goto(`?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');
    });

    test('should export categories as NDJSON and match schema', async ({ page }) => {
        await page.goto('/projects/category-editor/index.html?lang=en');
        await page.waitForSelector('.category-item');

        await page.click('#export-btn');

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
        await page.click('.settings-close-btn');

        const firstCat = page.locator('.category-btn').first();
        const catName = (await firstCat.textContent()).trim();

        // Manually insert a 5-minute task log because v1.7.0 logic deletes 0-minute tasks.
        // Starting and ending a task immediately via UI would result in deletion.
        await page.evaluate(async (name) => {
            const dbName = new URLSearchParams(window.location.search).get('db') || 'QuickLogSoloDB';
            const request = indexedDB.open(dbName);
            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction(['logs'], 'readwrite');
                    const store = transaction.objectStore('logs');
                    const now = Math.floor(Date.now() / 60000) * 60000;
                    store.add({
                        syncId: 'test-data-io-uuid',
                        category: name,
                        startTime: now - 300000, // 5 minutes ago
                        endTime: now,
                        tags: '',
                        updatedAt: Date.now()
                    });
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = () => reject(new Error("Failed to insert test log"));
                };
                request.onerror = () => reject(new Error("Failed to open DB"));
            });
        }, catName);

        // Refresh UI to show the new log
        await page.reload();
        await page.waitForSelector('.log-item');

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

        expect(lines[0]).toBe('id,category,startTime,endTime,tags');
        expect(lines.length).toBeGreaterThan(1);
        /* eslint-disable-next-line no-control-regex */
        expect(lines[1]).toContain(catName.replace(/[^\x00-\x7F]/g, ""));
    });

    test('should handle Category Import Overwrite mode correctly', async ({ page }) => {
        await page.goto('/projects/category-editor/index.html?lang=en');
        await page.waitForSelector('.category-item');

        const importData = JSON.stringify({
            kind: 'QuickLogSolo/Category',
            version: '1.0',
            type: 'category',
            name: 'ImportedTestCat',
            color: 'teal'
        });

        await page.evaluate((text) => navigator.clipboard.writeText(text), importData);
        await page.click('#import-btn');

        const catItem = page.locator('.category-item').first();
        await expect(catItem).toContainText('ImportedTestCat');
        await expect(page.locator('.category-item')).toHaveCount(1);
    });

    test('should handle partial errors during category import', async ({ page }) => {
        await page.goto('/projects/category-editor/index.html?lang=en');
        await page.waitForSelector('.category-item');

        const mixedData = 'Not JSON\n' + JSON.stringify({
            kind: 'QuickLogSolo/Category',
            version: '1.0',
            type: 'category',
            name: 'ValidItem',
            color: 'orange'
        });
        await page.evaluate((text) => navigator.clipboard.writeText(text), mixedData);

        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('1 out of 2 rows are corrupted');
            await dialog.accept();
        });

        await page.click('#import-btn');

        const validItem = page.locator('.category-item').filter({ hasText: 'ValidItem' });
        await expect(validItem).toBeVisible();
    });

    test('should reject category data with missing kind/version (Legacy Data)', async ({ page }) => {
        await page.goto('/projects/category-editor/index.html?lang=en');
        await page.waitForSelector('.category-item');

        const legacyData = JSON.stringify({
            type: 'category',
            name: 'LegacyCat',
            color: 'orange'
        });

        await page.evaluate((text) => navigator.clipboard.writeText(text), legacyData);

        await page.click('#import-btn');

        const toast = page.locator('#toast');
        await expect(toast).not.toHaveClass(/hidden/);
        await expect(toast).toContainText(/Paste failed|Import failed/);
    });
});
