import { test, expect } from '@playwright/test';

test.describe('Category Editor Tag Replace', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('http://localhost:8080/projects/category-editor/index.html?lang=ja');
    await page.waitForSelector('.category-item');

    // Clear categories using evaluate to ensure a clean state for every test
    await page.evaluate(() => {
        if (!window.state) return;
        window.state.categories = [];
        window.state.selectedIndices = [];
        window.state.lastSelectedIndex = -1;
        window.state.renderCategoryList();
        window.state.renderDetail();
        window.state.renderGlobalTagBox();
    });

    await expect(page.locator('.category-item')).toHaveCount(0);
  });

  test('Open and close Tag Replace modal', async ({ page }) => {
    await page.click('#open-tag-replace-btn');
    const modal = page.locator('#tag-replace-modal');
    await expect(modal).toBeVisible();

    await page.click('#tag-replace-close-btn');
    await expect(modal).toBeHidden();

    await page.click('#open-tag-replace-btn');
    await expect(modal).toBeVisible();
    await page.click('#close-tag-replace-modal-btn');
    await expect(modal).toBeHidden();
  });

  test('Replace a single tag with another', async ({ page }) => {
    await page.evaluate(() => {
        window.state.categories = [
            { name: "CatA", color: "primary", tags: "tagA, commonTag", animation: "default" },
            { name: "CatB", color: "secondary", tags: "tagB, commonTag", animation: "default" }
        ];
        window.state.renderCategoryList();
        window.state.renderGlobalTagBox();
    });

    await page.click('#open-tag-replace-btn');
    const modal = page.locator('#tag-replace-modal');
    await expect(modal).toBeVisible();

    // Find row for tagA and change it to tagX
    const rowA = modal.locator('tr:has-text("tagA")');
    const inputA = rowA.locator('input');
    await inputA.fill('tagX');

    await page.click('#tag-replace-btn');

    // Modal remains open
    await expect(modal).toBeVisible();

    // Verify change in state
    const categories = await page.evaluate(() => window.state.categories);
    expect(categories[0].tags).toBe('tagX, commonTag');
    expect(categories[1].tags).toBe('tagB, commonTag');

    // Global Tag Box should update
    const globalTags = page.locator('#global-tag-list .tag-pill');
    await expect(globalTags.filter({ hasText: 'tagA' })).toHaveCount(0);
    await expect(globalTags.filter({ hasText: 'tagX' })).toHaveCount(1);
  });

  test('Replace a tag with multiple tags', async ({ page }) => {
    await page.evaluate(() => {
        window.state.categories = [
            { name: "CatA", color: "primary", tags: "tagA", animation: "default" }
        ];
        window.state.renderCategoryList();
        window.state.renderGlobalTagBox();
    });

    await page.click('#open-tag-replace-btn');
    const rowA = page.locator('#tag-replace-modal tr:has-text("tagA")');
    await rowA.locator('input').fill('tagX, tagY');
    await page.click('#tag-replace-btn');

    const categories = await page.evaluate(() => window.state.categories);
    expect(categories[0].tags).toBe('tagX, tagY');
  });

  test('Delete a tag by clearing input', async ({ page }) => {
    await page.evaluate(() => {
        window.state.categories = [
            { name: "CatA", color: "primary", tags: "tagA, tagB", animation: "default" }
        ];
        window.state.renderCategoryList();
        window.state.renderGlobalTagBox();
    });

    await page.click('#open-tag-replace-btn');
    const rowA = page.locator('#tag-replace-modal tr:has-text("tagA")');
    await rowA.locator('input').fill('');
    await page.click('#tag-replace-btn');

    const categories = await page.evaluate(() => window.state.categories);
    expect(categories[0].tags).toBe('tagB');
  });

  test('Delete a tag using trash icon', async ({ page }) => {
    await page.evaluate(() => {
        window.state.categories = [
            { name: "CatA", color: "primary", tags: "tagA", animation: "default" }
        ];
        window.state.renderCategoryList();
        window.state.renderGlobalTagBox();
    });

    await page.click('#open-tag-replace-btn');
    const rowA = page.locator('#tag-replace-modal tr:has-text("tagA")');
    await rowA.locator('.after-input-wrapper .icon-btn').click();
    await expect(rowA.locator('input')).toHaveValue('');

    await page.click('#tag-replace-btn');
    const categories = await page.evaluate(() => window.state.categories);
    expect(categories[0].tags).toBe('');
  });

  test('Undo and Redo within the modal', async ({ page }) => {
    await page.evaluate(() => {
        window.state.categories = [
            { name: "CatA", color: "primary", tags: "tagA", animation: "default" }
        ];
        window.state.renderCategoryList();
        window.state.renderGlobalTagBox();
    });

    await page.click('#open-tag-replace-btn');
    const modal = page.locator('#tag-replace-modal');
    const rowA = modal.locator('tr:has-text("tagA")');
    await rowA.locator('input').fill('tagX');
    await page.click('#tag-replace-btn');

    const categoriesAfterReplace = await page.evaluate(() => window.state.categories);
    expect(categoriesAfterReplace[0].tags).toBe('tagX');

    // Undo
    await page.click('#modal-undo-btn');
    const categoriesAfterUndo = await page.evaluate(() => window.state.categories);
    expect(categoriesAfterUndo[0].tags).toBe('tagA');
    // Table should re-render
    await expect(modal.locator('tr:has-text("tagA")')).toBeVisible();

    // Redo
    await page.click('#modal-redo-btn');
    const categoriesAfterRedo = await page.evaluate(() => window.state.categories);
    expect(categoriesAfterRedo[0].tags).toBe('tagX');
    // Table should re-render and now show tagX as the source tag
    await expect(modal.locator('tr:has-text("tagX")')).toBeVisible();
    await expect(modal.locator('tr:has-text("tagX") input')).toHaveValue('tagX');
  });

  test('Drag and drop a tag pill in the modal', async ({ page }) => {
    await page.evaluate(() => {
        window.state.categories = [
            { name: "CatA", color: "primary", tags: "tagA", animation: "default" },
            { name: "CatB", color: "secondary", tags: "tagB", animation: "default" }
        ];
        window.state.renderCategoryList();
        window.state.renderGlobalTagBox();
    });

    await page.click('#open-tag-replace-btn');
    const modal = page.locator('#tag-replace-modal');

    // Drag tagB pill to tagA input
    await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#tag-replace-modal tr'));
        const rowA = rows.find(r => r.innerText.includes('tagA'));
        const rowB = rows.find(r => r.innerText.includes('tagB'));
        const pillB = rowB.querySelector('.tag-pill');
        const inputA = rowA.querySelector('input');

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', 'tagB');

        const dragStartEvent = new DragEvent('dragstart', { dataTransfer, bubbles: true });
        pillB.dispatchEvent(dragStartEvent);

        const dropEvent = new DragEvent('drop', { dataTransfer, bubbles: true });
        inputA.dispatchEvent(dropEvent);
    });

    const inputA = modal.locator('tr:has-text("tagA") input');
    // It appends with comma
    await expect(inputA).toHaveValue('tagA, tagB');

    await page.click('#tag-replace-btn');
    const categories = await page.evaluate(() => window.state.categories);
    expect(categories[0].tags).toBe('tagA, tagB');
  });
});
