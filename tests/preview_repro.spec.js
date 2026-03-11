import { test, expect } from '@playwright/test';

test('Preview animations on landing page', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    // Use a unique DB to avoid state contamination
    const dbName = `PreviewTestDB_${Math.random().toString(36).substring(7)}`;
    await page.goto(`http://localhost:8080/?db=${dbName}`);

    // Click "Try in Browser" (Japanese text first as default is JA)
    const previewBtn = page.locator('button', { hasText: /ブラウザで試す|Try in Browser/ });
    await previewBtn.click();

    // Wait for modal and iframe
    await page.waitForSelector('.preview-iframe');
    const frame = page.frame({ url: /app.html/ });

    if (!frame) {
        throw new Error('Iframe not found');
    }

    // Wait for the app in iframe to initialize
    await frame.waitForSelector('.category-btn');

    // Check if there's any animation active already (should not be)
    let canvasContent = await frame.evaluate(() => {
        const canvas = document.getElementById('animation-canvas');
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        return imgData.some(p => p !== 0);
    });
    console.log('Initial canvas content:', canvasContent);

    // Click Category 2 (Meeting) - should have animation
    await frame.click('.category-btn:nth-child(2)');

    // Wait for animation to start and draw
    await page.waitForTimeout(3000);

    canvasContent = await frame.evaluate(() => {
        const canvas = document.getElementById('animation-canvas');
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        return imgData.some(p => p !== 0);
    });
    console.log('Canvas content after starting task:', canvasContent);

    expect(canvasContent).toBe(true);

    // Try another category (e.g. Category 3)
    await frame.click('.category-btn:nth-child(3)');
    await page.waitForTimeout(2000);

    canvasContent = await frame.evaluate(() => {
        const canvas = document.getElementById('animation-canvas');
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        return imgData.some(p => p !== 0);
    });
    console.log('Canvas content after switching to Category 3:', canvasContent);
    expect(canvasContent).toBe(true);

    // Verify anim-active class is applied
    const isAnimActiveOnDisplay = await frame.evaluate(() => document.getElementById('current-task-display').classList.contains('anim-active'));
    console.log('Is anim-active on display:', isAnimActiveOnDisplay);
    expect(isAnimActiveOnDisplay).toBe(true);

    const isAnimActiveOnBase = await frame.evaluate(() => document.getElementById('current-task-display-base').classList.contains('anim-active'));
    console.log('Is anim-active on base:', isAnimActiveOnBase);
    expect(isAnimActiveOnBase).toBe(true);

    // Take screenshot for visual confirmation
    await page.screenshot({ path: 'tests/screenshots/preview-debug.png', fullPage: true });
});
