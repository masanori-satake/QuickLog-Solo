import { test, expect } from '@playwright/test';

test.describe('Animation Rendering Verification', () => {
    test('should render Matrix Code animation and produce canvas content', async ({ page }) => {
        // Set a definite viewport size to ensure consistent rendering
        await page.setViewportSize({ width: 400, height: 800 });
        await page.goto('');

        // Ensure Matrix Code is selected as global default
        await page.click('#settings-toggle');
        await page.selectOption('#animation-select', 'digital_rain');
        await page.click('.close-btn');

        // Start a task to trigger animation.
        // Use the second category because the first one is set to 'none' by default.
        // The second one is set to 'default', so it should use the global 'digital_rain'.
        const categoryBtn = page.locator('.category-btn').nth(1);
        await expect(categoryBtn).toBeVisible();
        await categoryBtn.click();

        // Ensure the task is active
        await expect(page.locator('#status-label')).toHaveText('play_arrow');

        // Check if canvas has some content (not empty) with retries
        await expect(async () => {
            const canvasContent = await page.evaluate(() => {
                const canvas = document.getElementById('animation-canvas');
                if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
                const ctx = canvas.getContext('2d');
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                // Check if there are any non-zero pixels
                return imgData.some(pixel => pixel !== 0);
            });
            expect(canvasContent).toBe(true);
        }).toPass({
            intervals: [500, 1000, 2000],
            timeout: 10000
        });

        // Take a screenshot for visual confirmation
        await page.screenshot({ path: 'tests/screenshots/animation-verification.png' });
    });
});
