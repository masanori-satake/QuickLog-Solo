import { test, expect } from '@playwright/test';

test.describe('Category Editor Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Category Editor
    await page.goto('http://localhost:8080/projects/category-editor/index.html?lang=en');
    // Ensure the app is loaded
    await page.waitForSelector('.category-item');
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

    // Check list-pane width (using approximate check due to potential border/padding)
    const listPane = page.locator('.list-pane');
    const box = await listPane.boundingBox();
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(600);
    expect(Math.round(box.width)).toBeLessThanOrEqual(601);
  });

  test('Multi-selection with Ctrl and Shift keys', async ({ page }) => {
    const items = page.locator('.category-item');

    // 1. Single selection
    await items.nth(0).click();
    await expect(items.nth(0)).toHaveClass(/active/);
    await expect(items.nth(1)).not.toHaveClass(/active/);

    // 2. Ctrl + Click to add to selection
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    await page.keyboard.down(modifier);
    await items.nth(2).click();
    await page.keyboard.up(modifier);

    await expect(items.nth(0)).toHaveClass(/active/);
    await expect(items.nth(2)).toHaveClass(/active/);
    await expect(items.nth(1)).not.toHaveClass(/active/);

    // 3. Shift + Click for range selection
    // Current anchor (lastSelectedIndex) is 2. Clicking 4 with Shift should select 2, 3, 4.
    await page.keyboard.down('Shift');
    await items.nth(4).click();
    await page.keyboard.up('Shift');

    await expect(items.nth(0)).not.toHaveClass(/active/);
    await expect(items.nth(1)).not.toHaveClass(/active/);
    await expect(items.nth(2)).toHaveClass(/active/);
    await expect(items.nth(3)).toHaveClass(/active/);
    await expect(items.nth(4)).toHaveClass(/active/);

    // 4. Click without modifier resets selection
    await items.nth(1).click();
    await expect(items.nth(1)).toHaveClass(/active/);
    const activeCount = await page.locator('.category-item.active').count();
    expect(activeCount).toBe(1);
  });

  test('Bulk Deletion via Global Trash Button', async ({ page }) => {
    const items = page.locator('.category-item');
    const initialCount = await items.count();

    // Select first two items
    await items.nth(0).click();
    await page.keyboard.down('Control');
    await items.nth(1).click();
    await page.keyboard.up('Control');

    // Click global delete button
    page.on('dialog', dialog => dialog.accept()); // Handle confirmation
    await page.click('#delete-selected-btn');

    // Verify items are deleted
    await expect(items).toHaveCount(initialCount - 2);
  });

  test('Bulk Property Updates (Theme and Animation)', async ({ page }) => {
    const items = page.locator('.category-item');

    // Select first three items
    await items.nth(0).click();
    await page.keyboard.down('Shift');
    await items.nth(2).click();
    await page.keyboard.up('Shift');

    // Change color (Theme) to 'teal'
    const tealOption = page.locator('.color-option[data-color="teal"]');
    await tealOption.click();

    // Verify all three have teal dots
    // Teal in light mode (default here) is #0097a7 which is rgb(0, 151, 167)
    for (let i = 0; i < 3; i++) {
      const dot = items.nth(i).locator('.cat-dot');
      await expect(dot).toHaveCSS('background-color', 'rgb(0, 151, 167)');
    }

    // Change animation to 'ripple'
    await page.selectOption('#edit-animation', 'ripple');

    // Verify via NDJSON view (internal state check)
    await page.click('#btn-show-code');
    const codeView = await page.textContent('#code-view');
    const lines = codeView.trim().split('\n');
    for (let i = 0; i < 3; i++) {
      const data = JSON.parse(lines[i]);
      expect(data.animation).toBe('ripple');
    }
  });

  test('Inputs Disabled during Multi-selection', async ({ page }) => {
    const items = page.locator('.category-item');

    // Select multiple
    await items.nth(0).click();
    await page.keyboard.down('Shift');
    await items.nth(1).click();
    await page.keyboard.up('Shift');

    // Check inputs
    const nameInput = page.locator('#edit-name');
    const tagInput = page.locator('#tag-input');

    await expect(nameInput).toBeDisabled();
    await expect(tagInput).toBeDisabled();

    // Name input should be cleared
    await expect(nameInput).toHaveValue('');

    // Single selection re-enables
    await items.nth(0).click();
    await expect(nameInput).not.toBeDisabled();
    await expect(tagInput).not.toBeDisabled();
    await expect(nameInput).not.toHaveValue('');
  });
});
