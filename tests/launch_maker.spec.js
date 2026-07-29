import { test, expect } from '@playwright/test';

test.describe('Launch QL-Animation Maker from Settings', () => {
    test('should open QL-Animation Maker with current theme and language (dark theme)', async ({ page, context }) => {
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err));

        // Mock chrome extension environment for testing launch capability
        await page.addInitScript(() => {
            window.chrome = window.chrome || {};
            window.chrome.runtime = window.chrome.runtime || {};
            window.chrome.runtime.id = 'mock-extension-id';
        });

        const dbName = `LaunchMakerTestDB_${Math.random().toString(36).substring(7)}`;
        await page.goto(`?db=${dbName}`);
        await page.waitForSelector('#app');

        // Handle persistence modal if visible
        const okBtn = page.locator('#confirm-ok-btn');
        if (await okBtn.isVisible()) {
            await okBtn.click();
        }

        // Open settings and set theme to dark
        await page.click('#settings-toggle');
        await page.selectOption('#theme-select', 'dark');
        await expect(page.locator('body')).toHaveClass(/theme-dark/);

        // Switch to Categories tab (where the launch button was relocated)
        await page.click('.tab-btn[data-tab="categories"]');
        await page.waitForSelector('#launch-maker-btn');

        console.log('Clicking launch-maker-btn...');
        // Click launch maker button and wait for the new tab to open
        const popupPromise = context.waitForEvent('page');
        await page.click('#launch-maker-btn');
        const popup = await popupPromise;

        // Monitor popup errors too
        const popupErrors = [];
        popup.on('pageerror', (err) => popupErrors.push(err));

        await popup.waitForLoadState('domcontentloaded');
        const url = popup.url();
        console.log(`Opened popup URL (dark): ${url}`);

        // Verify URL contains correct theme and language query parameters
        expect(url).toContain('animation-maker/index.html');
        const urlObj = new URL(url);
        expect(urlObj.searchParams.get('theme')).toBe('dark');
        expect(urlObj.searchParams.get('lang')).toBeTruthy();

        // Verify popup body actually has theme-dark class
        const bodyClass = await popup.locator('body').getAttribute('class');
        expect(bodyClass).toContain('theme-dark');

        // Verify no console errors occurred on either page
        expect(pageErrors).toEqual([]);
        expect(popupErrors).toEqual([]);
    });

    test('should directly apply light/dark theme based on URL param on QL-Animation Maker page', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err));

        // Navigate directly to the maker page with theme=light
        await page.goto('/projects/animation-maker/index.html?theme=light');
        await page.waitForSelector('#maker-app');
        let bodyClass = await page.locator('body').getAttribute('class');
        expect(bodyClass).toContain('theme-light');

        // Navigate directly to the maker page with theme=dark
        await page.goto('/projects/animation-maker/index.html?theme=dark');
        await page.waitForSelector('#maker-app');
        bodyClass = await page.locator('body').getAttribute('class');
        expect(bodyClass).toContain('theme-dark');

        // Verify no console errors occurred
        expect(pageErrors).toEqual([]);
    });
});
