import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('History CSV Import Robustness', () => {
    test.slow();

    const getDbName = () => `HistoryImportDB_${Math.random().toString(36).substring(7)}`;

    async function createTempCSV(content) {
        const filePath = path.join(os.tmpdir(), `test_import_${Date.now()}.csv`);
        fs.writeFileSync(filePath, content);
        return filePath;
    }

    test('should REJECT CSV import with future timestamps', async ({ page }) => {
        const dbName = getDbName();
        // baseURL in playwright.config.js points to /projects/app/app.html
        await page.goto(`?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');

        const now = Date.now();
        const futureStart = now + 1000000;
        const futureEnd = now + 2000000;
        const csv = `id,category,startTime,endTime\n1,FutureTask,${futureStart},${futureEnd}`;
        const filePath = await createTempCSV(csv);

        await page.click('#settings-toggle');
        await page.click('button[data-tab="general"]');

        const fileChooserPromise = page.waitForEvent('filechooser');

        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('Invalid file format');
            await dialog.dismiss();
        });

        await page.click('#import-csv-btn');
        await page.click('#confirm-ok-btn');

        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePath);

        await page.click('.close-btn');
        await expect(page.locator('.log-item:has-text("FutureTask")')).not.toBeVisible();
    });

    test('should handle overlapping time periods (allow but import)', async ({ page }) => {
        const dbName = getDbName();
        // baseURL in playwright.config.js points to /projects/app/app.html
        await page.goto(`?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');

        const now = Date.now();
        await page.evaluate(({now, dbName}) => {
            return new Promise((resolve) => {
                const request = indexedDB.open(dbName);
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('logs', 'readwrite');
                    tx.objectStore('logs').clear().onsuccess = () => {
                        tx.objectStore('logs').add({
                            category: 'Existing',
                            startTime: now - 7200000,
                            endTime: now - 3600000
                        });
                        tx.oncomplete = () => resolve();
                    };
                };
            });
        }, {now, dbName});
        await page.reload();

        const csv = `id,category,startTime,endTime\n2,Overlapping,${now - 5400000},${now - 1800000}`;
        const filePath = await createTempCSV(csv);

        await page.click('#settings-toggle');
        await page.click('button[data-tab="general"]');
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#import-csv-btn');
        await page.click('#confirm-ok-btn');
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePath);

        await page.click('.close-btn');
        await expect(page.locator('.log-item:has-text("Overlapping")')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.log-item:has-text("Existing")')).toBeVisible();
    });

    test('should skip duplicate logs', async ({ page }) => {
        const dbName = getDbName();
        // baseURL in playwright.config.js points to /projects/app/app.html
        await page.goto(`?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');

        const now = Date.now();
        const startTime = now - 3600000;
        await page.evaluate(({startTime, dbName}) => {
            return new Promise((resolve) => {
                const request = indexedDB.open(dbName);
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('logs', 'readwrite');
                    tx.objectStore('logs').clear().onsuccess = () => {
                        tx.objectStore('logs').add({
                            category: 'DuplicateMe',
                            startTime: startTime,
                            endTime: startTime + 100000
                        });
                        tx.oncomplete = () => resolve();
                    };
                };
            });
        }, {startTime, dbName});
        await page.reload();

        const csv = `id,category,startTime,endTime\n3,DuplicateMe,${startTime},${startTime + 100000}`;
        const filePath = await createTempCSV(csv);

        await page.click('#settings-toggle');
        await page.click('button[data-tab="general"]');

        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('Import completed');
            expect(dialog.message()).toContain('1 duplicates skipped');
            await dialog.dismiss();
        });

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#import-csv-btn');
        await page.click('#confirm-ok-btn');
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePath);

        await page.click('.close-btn');
        await expect(page.locator('.log-item:has-text("DuplicateMe")')).toHaveCount(1);
    });

    test('should handle malformed CSV lines with partial error modal', async ({ page }) => {
        const dbName = getDbName();
        // baseURL in playwright.config.js points to /projects/app/app.html
        await page.goto(`?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');

        const csv = `id,category,startTime,endTime\nInvalid,Line,Here\n4,ValidTask,${Date.now() - 100000},${Date.now()}`;
        const filePath = await createTempCSV(csv);

        await page.click('#settings-toggle');
        await page.click('button[data-tab="general"]');
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#import-csv-btn');
        await page.click('#confirm-ok-btn');
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePath);

        // Should show partial error confirmation
        const confirmMsg = page.locator('#confirm-message');
        await expect(confirmMsg).toContainText(/1 out of 2 rows are corrupted/);
        await page.click('#confirm-ok-btn');

        await page.click('.close-btn');
        await expect(page.locator('.log-item:has-text("ValidTask")')).toBeVisible({ timeout: 10000 });
    });

    test('should REJECT CSV import with startTime > endTime', async ({ page }) => {
        const dbName = getDbName();
        // baseURL in playwright.config.js points to /projects/app/app.html
        await page.goto(`?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');

        const now = Date.now();
        const csv = `id,category,startTime,endTime\n5,ErrorTask,${now},${now - 1000}`;
        const filePath = await createTempCSV(csv);

        await page.click('#settings-toggle');
        await page.click('button[data-tab="general"]');
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#import-csv-btn');
        await page.click('#confirm-ok-btn');
        const fileChooser = await fileChooserPromise;
        // Should show fatal error modal because no valid rows found
        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('Invalid file format');
            await dialog.dismiss();
        });

        await fileChooser.setFiles(filePath);

        await page.click('.close-btn');
        await expect(page.locator('.log-item:has-text("ErrorTask")')).not.toBeVisible();
    });
});
