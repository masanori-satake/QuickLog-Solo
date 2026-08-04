import { test, expect } from '@playwright/test';

test.describe('Animation Height and Scale Consistency', () => {
    test.beforeEach(async ({ page }) => {
        const dbName = `HeightConsistencyDB_${Math.random().toString(36).substring(7)}`;
        await page.goto(`?db=${dbName}`);
        await page.waitForSelector('#app');

        // Handle persistence confirmation modal if it appears
        const okBtn = page.locator('#confirm-ok-btn');
        try {
            await okBtn.waitFor({ state: 'visible', timeout: 2000 });
            await okBtn.click();
        } catch {
            // Modal did not appear, ignore
        }

        // Wait for categories to load
        await page.waitForSelector('.category-btn');
    });

    test('should update animationEngine.simulatedHeight correctly when changing timer display height in settings', async ({ page }) => {
        // Open settings panel
        await page.click('#settings-toggle');
        await page.waitForSelector('#timer-height-select', { state: 'visible' });

        // 1. Change to Compact (2/3)
        await page.selectOption('#timer-height-select', 'compact');
        await page.waitForTimeout(500);

        let simulatedHeight = await page.evaluate(() => window.animationEngine ? window.animationEngine.simulatedHeight : null);
        expect(simulatedHeight).toBe(66);

        // 2. Change to Mini (1/2)
        await page.selectOption('#timer-height-select', 'mini');
        await page.waitForTimeout(500);

        simulatedHeight = await page.evaluate(() => window.animationEngine ? window.animationEngine.simulatedHeight : null);
        expect(simulatedHeight).toBe(50);

        // 3. Change to Normal (100%)
        await page.selectOption('#timer-height-select', 'normal');
        await page.waitForTimeout(500);

        simulatedHeight = await page.evaluate(() => window.animationEngine ? window.animationEngine.simulatedHeight : null);
        expect(simulatedHeight).toBe(100);
    });
});
