import { test, expect } from '@playwright/test';

test.describe('Vercel Redirect & Path Compatibility', () => {
  test('Root redirects to landing page and loads assets', async ({ page }) => {
    await page.goto('http://localhost:8081/');
    await expect(page).toHaveURL(/projects\/web\//);

    const color = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--md-sys-color-primary'));
    expect(color).toBeTruthy();

    page.on('response', response => {
        expect(response.status()).not.toBe(404);
    });
  });

  test('Internal links work relatively', async ({ page }) => {
    await page.goto('http://localhost:8081/projects/web/');

    await page.locator('#cta-studio-link').click();
    await expect(page).toHaveURL(/projects\/studio\//);
    await expect(page.locator('#studio-app')).toBeVisible();

    await page.locator('.back-link').click();
    await expect(page).toHaveURL(/projects\/web\//);

    await page.locator('#cta-editor-link').click();
    await expect(page).toHaveURL(/projects\/category-editor\//);
    await expect(page.locator('#editor-app')).toBeVisible();
  });
});
