import { test, expect } from '@playwright/test';

test.describe('Robustness and Persistence', () => {
  test('should persist language when navigating from landing to sub-projects', async ({ page }) => {
    // 1. Start on landing page in English
    await page.goto('http://localhost:8080/projects/web/index.html?lang=en');
    await expect(page.locator('#lang-select-landing')).toHaveValue('en');
    await expect(page.locator('[data-i18n="cta-test"]')).toHaveText('Try in Browser');

    // 2. Navigate to Guide
    await page.click('#quick-start-guide-link');
    await page.waitForURL(/guide\.html\?lang=en/);
    await expect(page.locator('#lang-select-guide')).toHaveValue('en');
    await expect(page.locator('[data-i18n="guide-title"]')).toHaveText('Record in 1s, Total in 1s.');

    // 3. Go back to Landing from Guide
    await page.click('.back-link');
    await page.waitForURL(/index\.html\?lang=en/);

    // 4. Change language to Japanese on Landing
    await page.selectOption('#lang-select-landing', 'ja');
    await expect(page.locator('[data-i18n="cta-test"]')).toHaveText('ブラウザで試す');

    // 5. Navigate to Studio
    await page.click('#cta-studio-link');
    await page.waitForURL(/studio\/.*lang=ja/);
    await expect(page.locator('#lang-select-studio')).toHaveValue('ja');
    await expect(page.locator('[data-i18n="studio-title"]')).toHaveText(/QL-Animation Studio/);

    // 6. Go back to Landing from Studio
    await page.click('.back-link');
    await page.waitForURL(/web\/.*lang=ja/);

    // 7. Navigate to Category Editor
    await page.click('#cta-editor-link');
    await page.waitForURL(/category-editor\/.*lang=ja/);
    await expect(page.locator('#lang-select-editor')).toHaveValue('ja');
    await expect(page.locator('[data-i18n="category-editor-title"]')).toHaveText(/QL-Category Editor|業務カテゴリ・エディタ/);

    // 8. Go back to Landing
    await page.click('.back-link');
    await page.waitForURL(/web\/.*lang=ja/);
    await expect(page.locator('#lang-select-landing')).toHaveValue('ja');
  });

  test('should handle very long category names in the side panel', async ({ page }) => {
    // Limit is 50 characters as per shared/js/utils.js
    const longName = 'This is a 50 character name. 12345678901234567890';
    const dbName = `RobustnessDB_${Math.random().toString(36).substring(7)}`;

    // Use URL parameter to inject a category with a long name
    await page.goto(`http://localhost:8080/projects/app/app.html?db=${dbName}`);
    await page.waitForSelector('.category-btn');

    // Add long category via settings
    await page.click('#settings-toggle');
    await page.click('[data-tab="categories"]');
    await page.locator('#new-category-name-settings').fill(longName);
    await page.click('#add-category-btn-settings');
    
    // Check if added in settings list
    await page.waitForFunction((val) => {
      return Array.from(document.querySelectorAll('.category-edit-name')).some(i => i.value === val);
    }, longName);

    // Wait for the new category to appear in the list (main panel)
    await page.click('.close-btn');
    
    // The category might be on the second page if many exist. fresh DB starts with ~24 default cats.
    const longCatBtn = page.locator('.category-btn').filter({ hasText: longName });
    
    // Need to wait for the panel to be ready
    await page.waitForSelector('.category-btn');

    if (!(await longCatBtn.isVisible())) {
        const dots = page.locator('.pagination-dot');
        if (await dots.count() > 1) {
            await dots.nth(1).click();
            // Wait for transition
            await expect(longCatBtn).toBeVisible();
        }
    }
    await expect(longCatBtn).toBeVisible();

    // Check if it's truncated (text-overflow: ellipsis)
    const box = await longCatBtn.boundingBox();
    expect(box.height).toBeLessThan(100); // Button should not grow vertically too much

    // Start the long task
    await longCatBtn.click();
    await expect(page.locator('#current-task-name-text')).toHaveText(longName);

    // Ensure the display doesn't break
    const displayBox = await page.locator('#current-task-display').boundingBox();
    expect(displayBox.width).toBeGreaterThan(0);
    expect(displayBox.height).toBeGreaterThan(0);
  });
});
