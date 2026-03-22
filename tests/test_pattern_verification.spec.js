import { test, expect } from '@playwright/test';

test.describe('Verification Pattern (TestPattern) Rendering', () => {
    test('should render Verification Pattern and ensure it is not obscured by opaque backgrounds', async ({ page }) => {
        const dbName = `TestPatternDB_${Math.random().toString(36).substring(7)}`;
        // baseURL in playwright.config.js points to /projects/app/app.html
        await page.goto(`?db=${dbName}`);
        await page.waitForSelector('#app');

        // Wait for initialization (categories rendered)
        await page.waitForSelector('.category-btn');

        // Open settings
        await page.click('#settings-toggle');

        // Ensure settings popup and general tab are visible
        await page.waitForSelector('#settings-popup', { state: 'visible' });
        await page.waitForSelector('#general-tab', { state: 'visible' });

        // Select Verification Pattern - wait for option to be present
        const animSelect = page.locator('#animation-select');
        await expect(animSelect).toBeVisible();
        await page.selectOption('#animation-select', 'test_pattern');

        await page.click('#settings-popup .close-btn');

        // Start a task (second category usually has a color) to trigger animation
        const categoryBtn = page.locator('.category-btn:nth-child(2)');
        await categoryBtn.click();

        // Wait for worker to initialize and draw
        await page.waitForTimeout(4000);

        // 1. Verify that the engine is active
        const displayBase = page.locator('#current-task-display-base');
        await expect(displayBase).toHaveClass(/anim-active/);

        // 2. Check if canvas has some content
        const hasContent = await page.evaluate(() => {
            const canvas = document.getElementById('animation-canvas');
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            return imgData.some(p => p !== 0);
        });
        expect(hasContent).toBe(true);

        // 3. Specifically verify transparency of overlaying elements
        const transparencyInfo = await page.evaluate(() => {
            const getAlpha = (color) => {
                // Support color(srgb ... / alpha)
                const srgbMatch = color.match(/color\(srgb.*\/ ([\d.]+)\)/);
                if (srgbMatch) return parseFloat(srgbMatch[1]);

                // Support rgba(..., alpha)
                const rgbaMatch = color.match(/rgba?\(.*,\s*([\d.]+)\)/);
                if (rgbaMatch) return parseFloat(rgbaMatch[1]);

                if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return 0;
                return 1;
            };

            const display = document.getElementById('current-task-display');
            const base = document.getElementById('current-task-display-base');

            const displayStyle = window.getComputedStyle(display);
            const baseStyle = window.getComputedStyle(base);

            return {
                displayBg: displayStyle.backgroundColor,
                displayAlpha: getAlpha(displayStyle.backgroundColor),
                baseBg: baseStyle.backgroundColor,
                baseAlpha: getAlpha(baseStyle.backgroundColor)
            };
        });

        console.log('Transparency Info:', transparencyInfo);

        // We expect background-colors to be either transparent (alpha 0)
        // or very high transparency (alpha < 0.1 for the tint)
        expect(transparencyInfo.displayAlpha).toBeLessThan(0.1);
        expect(transparencyInfo.baseAlpha).toBeLessThan(0.1);

        // Take a screenshot for visual confirmation
        await page.screenshot({ path: 'tests/screenshots/test-pattern-verification.png' });
    });
});
