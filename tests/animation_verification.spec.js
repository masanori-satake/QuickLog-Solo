import { test, expect } from '@playwright/test';

test.describe('Animation Rendering Verification', () => {
    test('should render Matrix Code animation and produce canvas content', async ({ page }) => {
        await page.goto('');

        // Ensure Matrix Code is selected
        await page.click('#settings-toggle');
        await page.waitForSelector('#animation-select', { state: 'visible' });
        await page.selectOption('#animation-select', 'digital_rain');
        await page.click('#settings-popup .close-btn');

        // Start a task to trigger animation
        // Note: The first category button is 'Development/Coding' which is set to animation: 'none' by default.
        // We use the second button which is set to 'default' animation.
        await page.click('.category-btn:nth-child(2)');

        // Wait for worker to initialize and draw
        await page.waitForTimeout(3000);

        // Check if canvas has significant content (not empty or just a few pixels)
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
            return { nonZero, total: canvas.width * canvas.height };
        });

        // We expect at least 10 non-zero pixels for a valid animation frame
        expect(canvasStats.nonZero).toBeGreaterThanOrEqual(10);

        // Take a screenshot for visual confirmation
        await page.screenshot({ path: 'tests/screenshots/animation-verification.png' });
    });
});
