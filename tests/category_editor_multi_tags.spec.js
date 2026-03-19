import { test, expect } from '@playwright/test';

test.describe('Category Editor Multi-selection Tags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080/projects/category-editor/index.html?lang=ja');
    await page.waitForSelector('.category-item');
  });

  test('Hide more button during multi-selection', async ({ page }) => {
    const items = page.locator('.category-item');

    // Single selection: more button should exist
    await items.nth(0).click();
    await expect(items.nth(0).locator('.more-item-btn')).toBeVisible();

    // Multi selection: more button should be hidden (removed from DOM in my implementation)
    await page.keyboard.down('Control');
    await items.nth(1).click();
    await page.keyboard.up('Control');

    await expect(items.nth(0).locator('.more-item-btn')).not.toBeAttached();
    await expect(items.nth(1).locator('.more-item-btn')).not.toBeAttached();
  });

  test('Dynamic label changes during multi-selection', async ({ page }) => {
    const items = page.locator('.category-item');

    // Multi selection
    await items.nth(0).click();
    await page.keyboard.down('Shift');
    await items.nth(1).click();
    await page.keyboard.up('Shift');

    await expect(page.locator('label[for="tag-input"]')).toHaveText('タグ(共通)');
    await expect(page.locator('label[data-i18n="setting-theme"]')).toHaveText('テーマ(共通)');
    await expect(page.locator('label[for="edit-animation"]')).toHaveText('背景アニメーション設定(共通)');

    // Back to single selection
    await items.nth(0).click();
    await expect(page.locator('label[for="tag-input"]')).toHaveText('タグ');
    await expect(page.locator('label[data-i18n="setting-theme"]')).toHaveText('テーマ');
    await expect(page.locator('label[for="edit-animation"]')).toHaveText('背景アニメーション設定');
  });

  test('Common tag display and alphabetical sorting', async ({ page }) => {
    // 1. Setup categories with different tags
    // Cat 0: tagB, tagA, tagC
    // Cat 1: tagC, tagB, tagD
    // Common: tagB, tagC -> should be sorted as tagB, tagC (already alphabetical)
    // Wait, alphabetical: tagA, tagB, tagC...

    // We use the clipboard import to setup state quickly
    const ndjson = [
        JSON.stringify({ kind: "QuickLogSolo/Category", version: "1.0", type: "category", name: "CatA", color: "primary", tags: ["tagB", "tagA", "tagC"] }),
        JSON.stringify({ kind: "QuickLogSolo/Category", version: "1.0", type: "category", name: "CatB", color: "secondary", tags: ["tagC", "tagD", "tagB"] })
    ].join('\n');

    // Use evaluate to set the data in a global variable and call handleImport if possible,
    // or just mock the clipboard read.
    await page.evaluate((text) => {
        const originalReadText = navigator.clipboard.readText;
        navigator.clipboard.readText = () => Promise.resolve(text);
    }, ndjson);
    await page.click('#import-btn');

    const items = page.locator('.category-item');
    await items.nth(0).click();
    await page.keyboard.down('Shift');
    await items.nth(1).click();
    await page.keyboard.up('Shift');

    const tagPills = page.locator('.tag-pill');
    await expect(tagPills).toHaveCount(2);
    await expect(tagPills.nth(0)).toHaveText(/tagB/);
    await expect(tagPills.nth(1)).toHaveText(/tagC/);
  });

  test('Adding and removing tags in bulk', async ({ page }) => {
    const ndjson = [
        JSON.stringify({ kind: "QuickLogSolo/Category", version: "1.0", type: "category", name: "CatA", color: "primary", tags: ["tagA", "tagB"] }),
        JSON.stringify({ kind: "QuickLogSolo/Category", version: "1.0", type: "category", name: "CatB", color: "secondary", tags: ["tagB", "tagC"] })
    ].join('\n');

    await page.evaluate((text) => {
        const originalReadText = navigator.clipboard.readText;
        navigator.clipboard.readText = () => Promise.resolve(text);
    }, ndjson);
    await page.click('#import-btn');

    const items = page.locator('.category-item');
    await items.nth(0).click();
    await page.keyboard.down('Shift');
    await items.nth(1).click();
    await page.keyboard.up('Shift');

    // 1. Common tag is tagB
    await expect(page.locator('.tag-pill')).toHaveCount(1);
    await expect(page.locator('.tag-pill')).toHaveText(/tagB/);

    // 2. Add tagE
    await page.fill('#tag-input', 'tagE');
    await page.keyboard.press('Enter');

    // Verify internally via NDJSON
    await page.click('#btn-show-code');
    let codeView = await page.textContent('#code-view');
    let cats = codeView.trim().split('\n').map(l => JSON.parse(l));
    expect(cats[0].tags).toContain('tagE');
    expect(cats[1].tags).toContain('tagE');
    await page.click('#code-modal button[data-i18n="btn-close"]');

    // 3. Remove tagB
    await page.locator('.tag-pill:has-text("tagB") .tag-remove').click();

    // Verify internally
    await page.click('#btn-show-code');
    codeView = await page.textContent('#code-view');
    cats = codeView.trim().split('\n').map(l => JSON.parse(l));
    expect(cats[0].tags).not.toContain('tagB');
    expect(cats[1].tags).not.toContain('tagB');
    expect(cats[0].tags).toContain('tagA');
    expect(cats[1].tags).toContain('tagC');
  });
});
