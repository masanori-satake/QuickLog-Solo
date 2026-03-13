import { test, expect } from '@playwright/test';

test('Category Editor UI and Functionality', async ({ page }) => {
    // 1. Visit Category Editor
    await page.goto('http://localhost:8080/category-editor.html');

    // 2. Check if default categories are loaded
    const categoryItems = page.locator('.category-item');
    await expect(categoryItems).toHaveCount(5);

    // 3. Click a category and check detail view
    await categoryItems.nth(0).click();
    await expect(page.locator('#detail-section')).not.toHaveClass(/hidden/);
    await expect(page.locator('#edit-name')).toHaveValue(/開発・プログラミング|Development\/Coding/);

    // 4. Verify Preview faithful reproduction
    const previewContainer = page.locator('#preview-container');
    await expect(previewContainer).toBeVisible();
    await expect(previewContainer).toHaveCSS('height', '80px');

    const previewName = page.locator('#preview-name');
    await expect(previewName).toHaveText(/開発・プログラミング|Development\/Coding/);

    // 5. Test Copy (Export) - mock clipboard
    await page.evaluate(() => {
        window.clipboardData = "";
        navigator.clipboard.writeText = async (text) => { window.clipboardData = text; };
    });

    await page.click('#export-btn');
    const clipboardText = await page.evaluate(() => window.clipboardData);
    expect(clipboardText).toContain('{"name":');

    // 6. Test Paste (Import)
    await page.evaluate((text) => {
        navigator.clipboard.readText = async () => text;
    }, '{"name":"New Imported Cat","color":"teal","animation":"ripple","tags":"test"}');

    await page.click('#import-btn');
    const lastCat = categoryItems.last();
    await expect(lastCat).toContainText('New Imported Cat');

    // 7. Verify theme awareness in animation color (visual healers)
    // Switch theme and check if body class updates
    const initialTheme = await page.evaluate(() => document.body.classList.contains('theme-dark') ? 'dark' : 'light');

    // Click the slider to toggle
    await page.click('.slider');
    await page.waitForTimeout(500);

    const toggledTheme = await page.evaluate(() => document.body.classList.contains('theme-dark') ? 'dark' : 'light');
    expect(toggledTheme).not.toBe(initialTheme);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/category-editor-v0.30.png', fullPage: true });
});
