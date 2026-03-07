import { test, expect } from '@playwright/test';

test.describe('DevOnly Animation Exclusion', () => {
  test.beforeEach(async ({ page }) => {
    // Start the app
    await page.goto('http://localhost:8080/src/app.html');
    // Wait for DB init
    await page.waitForTimeout(1000);
  });

  test('test_pattern should NOT be in General Settings animation select', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.waitForSelector('#settings-popup:not(.hidden)');

    const options = await page.locator('#animation-select option').allTextContents();
    console.log('Animation options:', options);

    // It should not be there. 'Test Pattern' (English) or 'テストパターン' (Japanese)
    for (const opt of options) {
        expect(opt).not.toContain('Test Pattern');
        expect(opt).not.toContain('テストパターン');
    }
  });

  test('test_pattern should NOT be in Category Settings animation select', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.waitForSelector('#settings-popup:not(.hidden)');
    await page.click('button[data-tab="categories"]');

    // Wait for category editor to render
    await page.waitForSelector('.category-edit-animation');

    const options = await page.locator('.category-edit-animation').first().locator('option').allTextContents();
    console.log('Category Animation options:', options);

    for (const opt of options) {
        expect(opt).not.toContain('Test Pattern');
        expect(opt).not.toContain('テストパターン');
    }
  });

  test('test_pattern SHOULD be in Animation Studio sample select', async ({ page }) => {
    await page.goto('http://localhost:8080/src/studio.html');
    await page.waitForSelector('#sample-select');

    const options = await page.locator('#sample-select option').allTextContents();
    console.log('Studio Sample options:', options);

    const hasTestPattern = options.some(opt => opt.includes('Verification Pattern') || opt.includes('検証用パターン'));
    expect(hasTestPattern).toBe(true);
  });
});
