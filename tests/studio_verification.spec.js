import { test, expect } from '@playwright/test';

test.describe('Animation Studio Verification', () => {
    test('should load Animation Studio and select a sample', async ({ page }) => {
        await page.goto('/projects/studio/index.html?lang=en');

        // Check if the page title contains Studio
        await expect(page).toHaveTitle(/Animation Studio/);

        // Wait for sample selector to be populated
        const sampleSelect = page.locator('#sample-select');
        await expect(sampleSelect).toBeVisible();

        // Select 'Digital Rain' sample by value
        await sampleSelect.selectOption('digital_rain');

        // Wait for code to be loaded (Name field is a good indicator)
        await expect(page.locator('#meta-name')).toHaveValue('Digital Rain');

        // Wait for code to be loaded into draw editor
        const drawTextarea = page.locator('#input-draw');
        await page.waitForFunction((el) => {
            return el.value && el.value.includes('draw(ctx,');
        }, await drawTextarea.elementHandle());

        // Click play button
        await page.click('#play-btn');

        // Check if metric status says "Running"
        await expect(page.locator('#metric-status')).toHaveText(/Running/i);

        // Wait for some animation to happen
        await page.waitForTimeout(2000);

        // Check if canvas has content
        const canvasStats = await page.evaluate(() => {
            const canvas = document.getElementById('animation-canvas');
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let nonZero = 0;
            for (let i = 0; i < imgData.length; i += 4) {
                if (imgData[i] + imgData[i+1] + imgData[i+2] > 0) {
                    nonZero++;
                }
            }
            return { nonZero };
        });

        expect(canvasStats.nonZero).toBeGreaterThan(0);

        // Stop the test
        await page.click('#stop-btn');
        await expect(page.locator('#metric-status')).toHaveText(/Ready/i);
    });
});
