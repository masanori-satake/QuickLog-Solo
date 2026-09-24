import { test, expect } from '@playwright/test';

test.describe('PWA E2E Sizing and Layout Verification', () => {
    test('PWA loads app UI with 2x4 layout and mini timer height defaults on mobile viewport', async ({ page }) => {
        // Set iPhone 12 / 13 mobile viewport
        await page.setViewportSize({ width: 390, height: 844 });

        await page.goto('http://localhost:8080/projects/pwa/');

        // Wait for app initialization
        await page.waitForSelector('.category-btn');

        // Verify body classes for PWA defaults: category-layout-2x4 and timer-mini
        const bodyClass = await page.getAttribute('body', 'class');
        expect(bodyClass).toContain('category-layout-2x4');
        expect(bodyClass).toContain('timer-mini');

        // Verify categories are rendered in 2x4 (max 8 buttons per page)
        const categoryBtns = await page.$$('.category-btn');
        expect(categoryBtns.length).toBeLessThanOrEqual(8);
    });

    test('Introduction page iframe preview opens PWA page', async ({ page }) => {
        await page.goto('http://localhost:8080/projects/web/');

        // Click "ブラウザで試す"
        await page.click('button[data-i18n="cta-test"]');

        // Wait for preview modal to be visible
        await page.waitForSelector('#preview-modal:not(.hidden)');

        // Verify iframe src points to PWA
        const iframeSrc = await page.getAttribute('.preview-iframe', 'src');
        expect(iframeSrc).toContain('../pwa/');
    });
});
