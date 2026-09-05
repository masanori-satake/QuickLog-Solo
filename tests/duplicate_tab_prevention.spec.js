import { test, expect } from '@playwright/test';

test.describe('Duplicate Tab Prevention in Web Browser Mode', () => {
    test('should reuse the existing tab for Category Editor when clicked multiple times', async ({ page, context }) => {
        const dbName = `DuplicateTabCatTestDB_${Math.random().toString(36).substring(7)}`;
        await page.goto(`?db=${dbName}`);
        await page.waitForSelector('#app');

        // Handle persistence modal if visible
        const okBtn = page.locator('#confirm-ok-btn');
        if (await okBtn.isVisible()) {
            await okBtn.click();
        }

        await page.waitForSelector('.category-btn');

        // Open settings popup
        await page.click('#settings-toggle');
        await page.waitForSelector('#settings-popup', { state: 'visible' });

        // Switch to Categories tab
        await page.click('.tab-btn[data-tab="categories"]');
        await page.waitForSelector('#advanced-editor-link');

        // 1. First click: should open a new tab/page
        const firstPopupPromise = context.waitForEvent('page');
        await page.click('#advanced-editor-link');
        const firstPopup = await firstPopupPromise;
        await firstPopup.waitForURL(/category-editor/, { timeout: 10000 });

        // Verify the Category Editor is open
        expect(firstPopup.url()).toContain('category-editor');

        const initialPagesCount = context.pages().length;
        expect(initialPagesCount).toBe(2); // 1 main app page + 1 category editor page

        // 2. Second click on the same link: should focus/reuse and NOT open a new tab/page
        await page.bringToFront();
        await page.click('#advanced-editor-link');

        // Give it a brief moment to ensure no new page is created
        await page.waitForTimeout(1000);

        const currentPagesCount = context.pages().length;
        expect(currentPagesCount).toBe(2); // Still 2! No new tab opened.
    });

    test('should reuse the existing tab for Alarm Editor when clicked multiple times', async ({ page, context }) => {
        const dbName = `DuplicateTabAlarmTestDB_${Math.random().toString(36).substring(7)}`;
        await page.goto(`?db=${dbName}`);
        await page.waitForSelector('#app');

        // Handle persistence modal if visible
        const okBtn = page.locator('#confirm-ok-btn');
        if (await okBtn.isVisible()) {
            await okBtn.click();
        }

        await page.waitForSelector('.category-btn');

        // Open settings popup
        await page.click('#settings-toggle');
        await page.waitForSelector('#settings-popup', { state: 'visible' });

        // Switch to Alarms tab
        await page.click('.tab-btn[data-tab="alarms"]');
        await page.waitForSelector('#alarm-editor-link');

        // 1. First click: should open a new tab/page
        const firstPopupPromise = context.waitForEvent('page');
        await page.click('#alarm-editor-link');
        const firstPopup = await firstPopupPromise;
        await firstPopup.waitForURL(/alarm-editor/, { timeout: 10000 });

        // Verify the Alarm Editor is open
        expect(firstPopup.url()).toContain('alarm-editor');

        const initialPagesCount = context.pages().length;
        expect(initialPagesCount).toBe(2); // 1 main app page + 1 alarm editor page

        // 2. Second click on the same link: should focus/reuse and NOT open a new tab/page
        await page.bringToFront();
        await page.click('#alarm-editor-link');

        // Give it a brief moment to ensure no new page is created
        await page.waitForTimeout(1000);

        const currentPagesCount = context.pages().length;
        expect(currentPagesCount).toBe(2); // Still 2! No new tab opened.
    });
});
