import { test, expect } from '@playwright/test';

test.describe('Alarm Editor Layout and Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Alarm Editor
    await page.goto('http://localhost:8080/projects/alarm-editor/index.html?lang=en');
    // Ensure the app is loaded
    await page.waitForSelector('.alarm-item');
  });

  test('FullHD Layout Verification', async ({ page }) => {
    // Set viewport to FullHD
    await page.setViewportSize({ width: 1920, height: 1080 });

    const headerWrapper = page.locator('.header-content-wrapper');
    const mainWrapper = page.locator('.main-content-wrapper');
    const footerWrapper = page.locator('.footer-content-wrapper');

    // Check max-width
    await expect(headerWrapper).toHaveCSS('max-width', '1800px');
    await expect(mainWrapper).toHaveCSS('max-width', '1800px');
    await expect(footerWrapper).toHaveCSS('max-width', '1800px');

    // Check privacy badge is present and visible
    const privacyBadge = page.locator('.privacy-badge');
    await expect(privacyBadge).toBeVisible();
    await expect(privacyBadge).toContainText('Local Only');
  });
});
