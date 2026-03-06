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

        // Check if canvas has some content (not empty)
        const canvasContent = await page.evaluate(() => {
            const canvas = document.getElementById('animation-canvas');
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            // Check if there are any non-zero pixels
            return imgData.some(pixel => pixel !== 0);
        });

        expect(canvasContent).toBe(true);

        // Take a screenshot for visual confirmation
        await page.screenshot({ path: 'tests/screenshots/animation-verification.png' });
    });
});
