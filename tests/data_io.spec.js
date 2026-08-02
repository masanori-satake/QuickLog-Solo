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

});
