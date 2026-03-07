import { test, expect } from '@playwright/test';

test.describe('Verification Pattern (TestPattern) Rendering', () => {
    test('should render Verification Pattern and produce visible content without being obscured', async ({ page }) => {
        await page.goto('http://localhost:8080/src/app.html');

        // Select Verification Pattern
        await page.click('#settings-toggle');
        await page.waitForSelector('#animation-select', { state: 'visible' });
        await page.selectOption('#animation-select', 'test_pattern');
        await page.click('#settings-popup .close-btn');

        // Start a task to trigger animation
        await page.click('.category-btn:nth-child(2)');

        // Wait for worker to initialize and draw (giving it enough time for the new grace period)
        await page.waitForTimeout(4000);

        // Verify that the engine is active
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

        // Check if any opaque element is obscuring the canvas
        // We pick a point where we expect the pattern to be (e.g., center)
        const isObscured = await page.evaluate(() => {
            const canvas = document.getElementById('animation-canvas');
            const rect = canvas.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            // Check elements at the center of the canvas
            const elements = document.elementsFromPoint(x, y);

            // We expect #animation-canvas to be there, and potentially #current-task-display-base
            // #current-task-display-base should have pointer-events: none (which makes it invisible to elementsFromPoint)
            // or be transparent.

            const topElement = elements[0];
            if (!topElement) return false;

            // If the top element is not the canvas or a known transparent/pass-through container,
            // check its opacity and visibility
            if (topElement.id !== 'animation-canvas' && topElement.id !== 'current-task-display') {
                const style = window.getComputedStyle(topElement);
                if (parseFloat(style.opacity) > 0.9 && style.backgroundColor !== 'transparent' && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    return true; // Likely obscuring
                }
            }
            return false;
        });

        expect(isObscured).toBe(false);

        // Take a screenshot for visual confirmation
        await page.screenshot({ path: 'tests/screenshots/test-pattern-verification.png' });
    });
});
