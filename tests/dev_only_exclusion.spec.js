import { test, expect } from '@playwright/test';

test.describe('Animation Verification and Dev-Only Exclusion', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app (running from source)
    await page.goto('http://localhost:8080/src/app.html');
    // Wait for DB initialization
    await page.waitForTimeout(1000);
  });

  test('Verification Pattern should be visible in the settings dropdown in dev environment', async ({ page }) => {
    // Open settings
    await page.click('#settings-toggle');

    // Check the animation select dropdown
    const animSelect = page.locator('#animation-select');
    await expect(animSelect).toBeVisible();

    // The "Verification Pattern" (ja: 動作確認用パターン) should be an option
    const options = await animSelect.locator('option').allTextContents();
    const hasTestPattern = options.some(opt => opt.includes('Verification Pattern') || opt.includes('動作確認用パターン'));
    expect(hasTestPattern).toBe(true);
  });

  test('Animation should start and stay active (visual check via class)', async ({ page }) => {
    // Click a category that has an animation (e.g., the second one)
    // In default setup, the second category is 'Team Meeting' which usually has an animation
    const categoryButtons = page.locator('.category-btn');
    await categoryButtons.nth(1).click();

    // Check if the display base has 'anim-active' class
    const displayBase = page.locator('#current-task-display-base');
    await expect(displayBase).toHaveClass(/anim-active/);

    // Wait for a few seconds to ensure it doesn't immediately stop
    await page.waitForTimeout(3000);

    // It should still have the class
    await expect(displayBase).toHaveClass(/anim-active/);
  });
});
