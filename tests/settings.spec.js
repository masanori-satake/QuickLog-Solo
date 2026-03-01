import { test, expect } from '@playwright/test';

test.describe('Settings Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.waitForSelector('#app');

    // Handle persistence modal if it appears
    const okBtn = page.locator('#confirm-ok-btn');
    try {
      await okBtn.waitFor({ state: 'visible', timeout: 2000 });
      await okBtn.click();
    } catch (e) {
      // Modal didn't appear, ignore
    }

    // Wait for categories to load
    await page.waitForSelector('.category-btn');
  });

  test('should persist language setting across reloads', async ({ page }) => {
    // Open settings
    await page.click('#settings-toggle');
    await page.waitForSelector('#language-select', { state: 'visible' });

    // Change language to Japanese
    await page.selectOption('#language-select', 'ja');

    // Verify UI changed to Japanese
    await expect(page.locator('h2[data-i18n="settings"]')).toHaveText('設定');

    // Reload page
    await page.reload();
    await page.waitForSelector('.category-btn');

    // Open settings again and verify language is still Japanese
    await page.click('#settings-toggle');
    // Ensure the settings are truly applied - sometimes it might take a moment to reflect in DOM due to async syncState
    await expect(page.locator('#language-select')).toHaveValue('ja', { timeout: 10000 });
    await expect(page.locator('h2[data-i18n="settings"]')).toHaveText('設定');
  });

  test('should persist theme setting across reloads', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.waitForSelector('#theme-select', { state: 'visible' });

    // Switch to dark theme
    await page.selectOption('#theme-select', 'dark');
    await expect(page.locator('body')).toHaveClass(/theme-dark/);

    // Reload page
    await page.reload();
    await page.waitForSelector('.category-btn');

    // Verify dark theme is still applied
    await expect(page.locator('body')).toHaveClass(/theme-dark/);
  });

  test('should persist font setting across reloads', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.waitForSelector('#font-select', { state: 'visible' });

    // Select a specific font (Inter)
    const interFontValue = "'Inter', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', 'Noto Color Emoji', sans-serif";
    await page.selectOption('#font-select', interFontValue);

    // Verify font is applied to body
    const body = page.locator('body');
    const appliedFont = await body.evaluate(el => getComputedStyle(el).getPropertyValue('--font-family'));
    expect(appliedFont).toContain('Inter');

    // Reload page
    await page.reload();
    await page.waitForSelector('.category-btn');

    // Verify font persisted
    const persistedFont = await body.evaluate(el => getComputedStyle(el).getPropertyValue('--font-family'));
    expect(persistedFont).toContain('Inter');
  });

  test('should persist animation setting across reloads', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.waitForSelector('#animation-select', { state: 'visible' });

    // Ensure options are loaded (they are dynamic)
    await expect(page.locator('#animation-select option[value="matrix_code"]')).toBeAttached();

    // Change animation to matrix_code
    await page.selectOption('#animation-select', 'matrix_code');

    // Verify selection in dropdown
    await expect(page.locator('#animation-select')).toHaveValue('matrix_code');

    // Reload page
    await page.reload();
    await page.waitForSelector('.category-btn');

    // Verify selection persisted
    await page.click('#settings-toggle');
    await expect(page.locator('#animation-select')).toHaveValue('matrix_code');
  });
});
