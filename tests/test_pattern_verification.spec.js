import { test, expect } from '@playwright/test';

test.describe('Verification Pattern (TestPattern) Rendering', () => {
    test('should render Verification Pattern and produce visible content', async ({ page }) => {
        await page.goto('http://localhost:8080/src/app.html');

        // Select Verification Pattern
        await page.click('#settings-toggle');
        await page.waitForSelector('#animation-select', { state: 'visible' });
        await page.selectOption('#animation-select', 'test_pattern');
        await page.click('#settings-popup .close-btn');

        // Start a task to trigger animation
        await page.click('.category-btn:nth-child(2)');

        // Wait for worker to initialize and draw
        await page.waitForTimeout(3000);

        // Verify that the engine hasn't auto-stopped (should have 'anim-active' class)
        const displayBase = page.locator('#current-task-display-base');
        await expect(displayBase).toHaveClass(/anim-active/);

        // Check if canvas has some content
        const hasContent = await page.evaluate(() => {
            const canvas = document.getElementById('animation-canvas');
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            return imgData.some(p => p !== 0);
        });

        expect(hasContent).toBe(true);

        // Take a screenshot for visual confirmation
        await page.screenshot({ path: 'tests/screenshots/test-pattern-verification.png' });
    });
});
