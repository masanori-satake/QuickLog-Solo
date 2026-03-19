import { test, expect } from '@playwright/test';

test.describe('Category Editor Undo/Redo', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Category Editor
    await page.goto('http://localhost:8080/projects/category-editor/index.html?lang=en');
    // Ensure the app is loaded
    await page.waitForSelector('.category-item');
  });

  test('Undo and Redo adding a category', async ({ page }) => {
    const items = page.locator('.category-item');
    const initialCount = await items.count();

    // Add a category
    await page.click('#add-category-btn');
    await expect(items).toHaveCount(initialCount + 1);

    // Undo adding
    await page.click('#undo-btn');
    await expect(items).toHaveCount(initialCount);

    // Redo adding
    await page.click('#redo-btn');
    await expect(items).toHaveCount(initialCount + 1);
  });

  test('Undo and Redo deleting a category', async ({ page }) => {
    const items = page.locator('.category-item');
    const initialCount = await items.count();

    // Select and delete the first item
    await items.nth(0).click();
    page.on('dialog', dialog => dialog.accept());
    await page.click('#delete-selected-btn');
    await expect(items).toHaveCount(initialCount - 1);

    // Undo deletion
    await page.click('#undo-btn');
    await expect(items).toHaveCount(initialCount);

    // Redo deletion
    await page.click('#redo-btn');
    await expect(items).toHaveCount(initialCount - 1);
  });

  test('Undo and Redo text edit with focus/blur', async ({ page }) => {
    const items = page.locator('.category-item');
    await items.nth(0).click();

    const nameInput = page.locator('#edit-name');
    const originalName = await nameInput.inputValue();
    const newName = 'Edited Category Name';

    // Focus, type, and blur
    await nameInput.focus();
    // fill() might not trigger all events as a human would, let's use type or press
    await nameInput.fill('');
    await nameInput.type(newName);
    await nameInput.blur();

    // Verify change
    await expect(items.nth(0).locator('.cat-name')).toHaveText(newName);

    // Undo edit
    await page.click('#undo-btn');
    await expect(items.nth(0).locator('.cat-name')).toHaveText(originalName);

    // Redo edit
    await page.click('#redo-btn');
    await expect(items.nth(0).locator('.cat-name')).toHaveText(newName);
  });

  test('Undo and Redo property changes (color and animation)', async ({ page }) => {
    const items = page.locator('.category-item');
    await items.nth(0).click();

    // 1. Change color
    const tealOption = page.locator('.color-option[data-color="teal"]');
    await tealOption.click();
    // Teal in light mode is rgb(0, 151, 167)
    await expect(items.nth(0).locator('.cat-dot')).toHaveCSS('background-color', 'rgb(0, 151, 167)');

    // Undo color change
    await page.click('#undo-btn');
    // Default primary color is rgb(25, 118, 210)
    await expect(items.nth(0).locator('.cat-dot')).toHaveCSS('background-color', 'rgb(25, 118, 210)');

    // Redo color change
    await page.click('#redo-btn');
    await expect(items.nth(0).locator('.cat-dot')).toHaveCSS('background-color', 'rgb(0, 151, 167)');

    // 2. Change animation
    await page.selectOption('#edit-animation', 'ripple');

    // Undo animation change
    await page.click('#undo-btn');
    await page.click('#btn-show-code');
    let codeView = await page.textContent('#code-view');
    let firstLine = JSON.parse(codeView.trim().split('\n')[0]);
    expect(firstLine.animation).toBe('digital_rain'); // Default for first item

    // Close modal before clicking other buttons
    await page.click('#code-modal .icon-btn');
    await expect(page.locator('#code-modal')).toHaveClass(/hidden/);

    // Redo animation change
    await page.click('#redo-btn');
    codeView = await page.textContent('#code-view');
    firstLine = JSON.parse(codeView.trim().split('\n')[0]);
    expect(firstLine.animation).toBe('ripple');
  });

  test('Keyboard shortcuts support (Ctrl+Z, Ctrl+Y/Ctrl+Shift+Z)', async ({ page }) => {
    const items = page.locator('.category-item');
    const initialCount = await items.count();

    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    // 1. Ctrl+Z to undo adding
    await page.click('#add-category-btn');
    await expect(items).toHaveCount(initialCount + 1);

    await page.keyboard.press(`${modifier}+z`);
    await expect(items).toHaveCount(initialCount);

    // 2. Ctrl+Y to redo adding
    await page.keyboard.press(`${modifier}+y`);
    await expect(items).toHaveCount(initialCount + 1);

    // 3. Ctrl+Shift+Z to redo adding
    await page.keyboard.press(`${modifier}+z`); // Undo first
    await expect(items).toHaveCount(initialCount);

    await page.keyboard.press(`${modifier}+Shift+z`);
    await expect(items).toHaveCount(initialCount + 1);
  });

  test('History limit enforcement (50 steps)', async ({ page }) => {
    // Increase timeout for this long test
    test.setTimeout(60000);
    const items = page.locator('.category-item');
    const initialCount = await items.count();

    // Perform 55 additions
    for (let i = 0; i < 55; i++) {
        await page.click('#add-category-btn');
    }
    await expect(items).toHaveCount(initialCount + 55);

    // Undo 60 times (should stop at the 50th step back)
    for (let i = 0; i < 60; i++) {
        if (await page.locator('#undo-btn').isEnabled()) {
            await page.click('#undo-btn');
        }
    }

    // We expect it to stop after 50 undos.
    // initialCount + 55 - 50 = initialCount + 5
    await expect(items).toHaveCount(initialCount + 5);
    await expect(page.locator('#undo-btn')).toBeDisabled();
  });

  test('Undo after "Clear All"', async ({ page }) => {
    const items = page.locator('.category-item');
    const initialCount = await items.count();

    page.on('dialog', dialog => dialog.accept());
    await page.click('#clear-all-btn');
    await expect(items).toHaveCount(0);

    await page.click('#undo-btn');
    await expect(items).toHaveCount(initialCount);
  });
});
