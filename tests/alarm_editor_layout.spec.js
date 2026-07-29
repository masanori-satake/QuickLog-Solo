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

    // Check each wrapper's rendered width is at most 1800px
    const headerBox = await headerWrapper.boundingBox();
    const mainBox = await mainWrapper.boundingBox();
    const footerBox = await footerWrapper.boundingBox();

    expect(headerBox.width).toBeLessThanOrEqual(1800);
    expect(mainBox.width).toBeLessThanOrEqual(1800);
    expect(footerBox.width).toBeLessThanOrEqual(1800);

    // Verify horizontal centering (wrapper center should match viewport center within 1px tolerance)
    const viewportWidth = 1920;
    const viewportCenter = viewportWidth / 2;

    const headerCenter = headerBox.x + headerBox.width / 2;
    const mainCenter = mainBox.x + mainBox.width / 2;
    const footerCenter = footerBox.x + footerBox.width / 2;

    expect(Math.abs(headerCenter - viewportCenter)).toBeLessThanOrEqual(1);
    expect(Math.abs(mainCenter - viewportCenter)).toBeLessThanOrEqual(1);
    expect(Math.abs(footerCenter - viewportCenter)).toBeLessThanOrEqual(1);

    // Check privacy badge is present and visible
    const privacyBadge = page.locator('.privacy-badge');
    await expect(privacyBadge).toBeVisible();
    await expect(privacyBadge).toContainText('Local Only');
  });

  test('Privacy Badge Responsive Behavior at 900px', async ({ page }) => {
    // Set viewport to 900px width
    await page.setViewportSize({ width: 900, height: 1080 });

    const privacyBadge = page.locator('.privacy-badge');
    const privacyText = page.locator('.privacy-text');

    // Privacy badge should remain visible
    await expect(privacyBadge).toBeVisible();

    // Privacy text should be hidden (display: none)
    await expect(privacyText).toHaveCSS('display', 'none');
  });
});
