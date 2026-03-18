import { test, expect } from '@playwright/test';

test.describe('Theme switching', () => {
  test.beforeEach(async ({ page }) => {
    const dbName = `ThemeTestDB_${Math.random().toString(36).substring(7)}`;
    await page.goto(`/projects/app/app.html?db=${dbName}`);
    await page.waitForSelector('#app');

    // Handle persistence modal if it appears
    const okBtn = page.locator('#confirm-ok-btn');
    if (await okBtn.isVisible()) {
      await okBtn.click();
    }

    // Wait for categories to load
    await page.waitForSelector('.category-btn');
  });

  test('should apply dark theme correctly and have good contrast', async ({ page }) => {
    // Open settings
    await page.click('#settings-toggle');

    // Switch to dark theme
    await page.selectOption('#theme-select', 'dark');

    // Close settings
    await page.click('.close-btn');

    const body = page.locator('body');
    await expect(body).toHaveClass(/theme-dark/);

    // Check background and text color of body
    // #1b1b1f is rgb(27, 27, 31)
    await expect(body).toHaveCSS('background-color', 'rgb(27, 27, 31)');
    // #e5e1e6 is rgb(229, 225, 230)
    await expect(body).toHaveCSS('color', 'rgb(229, 225, 230)');

    // Start a task to test enabled buttons
    const firstCatBtn = page.locator('.category-btn').first();
    await firstCatBtn.click();

    // Now check Pause and End buttons
    const pauseBtn = page.locator('#pause-btn');
    const endBtn = page.locator('#end-btn');

    await expect(pauseBtn).toBeEnabled();
    await expect(endBtn).toBeEnabled();

    // Check Pause button (secondary container)
    // --md-sys-color-secondary-container: #404659 -> rgb(64, 70, 89)
    // --md-sys-color-on-secondary-container: #dce2f9 -> rgb(220, 226, 249)
    // Note: Buttons use semi-transparent background (alpha 0.6) during animations
    await expect(pauseBtn).toHaveCSS('background-color', /(rgb\(64, 70, 89\)|rgba\(64, 70, 89, 0\.6\)|color\(srgb 0\.25098\d* 0\.27451\d* 0\.34902\d* \/ 0\.6\))/);
    await expect(pauseBtn).toHaveCSS('color', 'rgb(220, 226, 249)');

    // Check End button (error container)
    // --md-sys-color-error-container: #93000a -> rgb(147, 0, 10)
    // --md-sys-color-on-error-container: #ffdad6 -> rgb(255, 218, 214)
    await expect(endBtn).toHaveCSS('background-color', /(rgb\(147, 0, 10\)|rgba\(147, 0, 10, 0\.6\)|color\(srgb 0\.57647\d* 0 0\.03921\d* \/ 0\.6\))/);
    await expect(endBtn).toHaveCSS('color', 'rgb(255, 218, 214)');
  });

  test('should have readable category buttons in dark mode', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.selectOption('#theme-select', 'dark');
    await page.click('.close-btn');

    const primaryBtn = page.locator('.category-btn.cat-primary').first();
    // --custom-cat-primary-container (dark): #0d47a1 -> rgb(13, 71, 161)
    // --custom-cat-on-primary-container (dark): #bbdefb -> rgb(187, 222, 251)
    await expect(primaryBtn).toHaveCSS('background-color', 'rgb(13, 71, 161)');
    await expect(primaryBtn).toHaveCSS('color', 'rgb(187, 222, 251)');
  });
});
