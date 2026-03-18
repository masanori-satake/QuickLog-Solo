import { test, expect } from '@playwright/test';

test.describe('Analysis and Reporting', () => {
    test.slow();

    const getDbName = () => `AnalysisTestDB_${Math.random().toString(36).substring(7)}`;

    test.beforeEach(async ({ context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    });

    test('should generate Markdown report correctly', async ({ page }) => {
        const dbName = getDbName();
        // Force English
        await page.goto(`/projects/app/app.html?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');

        // Check for dummy data generation
        const logItems = page.locator('.log-item');
        await expect(logItems.first()).toBeVisible();

        await page.click('#copy-report-btn');
        await page.waitForSelector('#report-modal', { state: 'visible' });

        // Navigate to a date that definitely has logs in dummy data (e.g., 1 day ago)
        await page.click('#report-date-prev');

        await page.selectOption('#report-format-select', 'markdown');

        const preview = page.locator('#report-preview');
        await expect(preview).not.toContainText('No logs for this day');

        const text = await preview.textContent();
        expect(text).toContain('- ');
    });

    test('should apply Report options: Emoji, End Time, Duration', async ({ page }) => {
        const dbName = getDbName();
        await page.goto(`/projects/app/app.html?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');

        await page.click('#copy-report-btn');
        await page.waitForSelector('#report-modal', { state: 'visible' });
        await page.click('#report-date-prev'); // Go to date with logs

        // Emoji: remove
        await page.selectOption('#report-emoji-select', 'remove');
        // EndTime: show
        await page.selectOption('#report-endtime-select', 'show');
        // Duration: right
        await page.selectOption('#report-duration-select', 'right');

        const preview = page.locator('#report-preview');
        await expect(preview).not.toContainText('No logs for this day');
        await expect(preview).not.toContainText('💻');
        await expect(preview).toContainText(' - ');
        await expect(preview).toContainText('(');
    });

    test('should apply Report adjustment (rounding)', async ({ page }) => {
        const dbName = getDbName();
        await page.goto(`/projects/app/app.html?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');

        // 10:03 to 10:17
        const today = new Date();
        today.setHours(10, 3, 0, 0);
        const startTime = today.getTime();
        const endTime = startTime + 14 * 60 * 1000; // 14 mins later (10:17)

        // Add a second task to test intermediate point rounding
        // 10:17 to 10:32
        const startTime2 = endTime;
        const endTime2 = startTime2 + 15 * 60 * 1000; // 10:32

        await page.evaluate(({start, end, start2, end2, dbName}) => {
            return new Promise((resolve) => {
                const request = indexedDB.open(dbName);
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('logs', 'readwrite');
                    const store = tx.objectStore('logs');
                    store.clear().onsuccess = () => {
                        store.add({
                            category: 'Task1',
                            startTime: start,
                            endTime: end,
                            color: 'primary',
                            tags: ''
                        });
                        store.add({
                            category: 'Task2',
                            startTime: start2,
                            endTime: end2,
                            color: 'secondary',
                            tags: ''
                        });
                        tx.oncomplete = () => resolve();
                    };
                };
            });
        }, {start: startTime, end: endTime, start2: startTime2, end2: endTime2, dbName});

        await page.reload();
        await page.waitForSelector('.category-btn');
        await page.click('#copy-report-btn');
        await page.waitForSelector('#report-modal', { state: 'visible' });

        await page.selectOption('#report-adjust-select', '5');
        const preview = page.locator('#report-preview');

        await page.selectOption('#report-endtime-select', 'show');

        // Rounding logic in logic.js:
        // First and Last timestamps are kept.
        // Intermediate points are rounded if they don't cause overlap.
        // 10:03 (Fixed), 10:17 (Intermediate), 10:32 (Fixed)
        // 10:17 rounds to 10:15.
        // 10:15 is >= 10:03 and <= 10:32, so it should be accepted.

        await expect(preview).toContainText('10:03'); // First point kept
        await expect(preview).toContainText('10:15'); // Intermediate rounded
        await expect(preview).toContainText('10:32'); // Last point kept
    });

    test('should calculate Tag Aggregation correctly', async ({ page }) => {
        const dbName = getDbName();
        await page.goto(`/projects/app/app.html?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');

        const now = Date.now();
        await page.evaluate(({now, dbName}) => {
            return new Promise((resolve) => {
                const request = indexedDB.open(dbName);
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('logs', 'readwrite');
                    const store = tx.objectStore('logs');
                    store.clear().onsuccess = () => {
                        store.add({
                            category: 'TaskA',
                            startTime: now - 3600000,
                            endTime: now - 1800000,
                            tags: 'Tag1, Tag2'
                        });
                        store.add({
                            category: 'TaskB',
                            startTime: now - 1800000,
                            endTime: now,
                            tags: 'Tag1'
                        });
                        tx.oncomplete = () => resolve();
                    };
                };
            });
        }, {now, dbName});

        await page.reload();
        await page.waitForSelector('.category-btn');
        await page.click('#copy-aggregation-btn');
        await page.waitForSelector('#tag-aggregation-modal', { state: 'visible' });

        const table = page.locator('#tag-aggregation-table');
        await expect(table.locator('tr:has-text("Tag1") .tag-duration-cell')).toHaveText('1:00');
        await expect(table.locator('tr:has-text("Tag2") .tag-duration-cell')).toHaveText('0:30');
    });

    test('should navigate dates in Report Modal', async ({ page }) => {
        const dbName = getDbName();
        await page.goto(`/projects/app/app.html?lang=en&db=${dbName}`);
        await page.waitForSelector('.category-btn');

        await page.click('#copy-report-btn');
        await page.waitForSelector('#report-modal', { state: 'visible' });

        const initialDate = await page.locator('#report-date-text').textContent();
        expect(initialDate).not.toBe('-');

        await page.click('#report-date-prev');
        const prevDate = await page.locator('#report-date-text').textContent();
        expect(initialDate).not.toBe(prevDate);

        await page.click('#report-date-next');
        const backDate = await page.locator('#report-date-text').textContent();
        expect(backDate).toBe(initialDate);
    });
});
