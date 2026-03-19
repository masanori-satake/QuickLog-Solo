import { test, expect } from '@playwright/test';

test.describe('Category Editor Tag Box', () => {
  test.beforeEach(async ({ page }) => {
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

  test('Tag Box displays all unique tags from categories', async ({ page }) => {
    // 1. Clear existing categories and confirm they are gone
    await page.evaluate(() => {
        window.state.categories = [];
        window.state.renderCategoryList();
        window.state.renderGlobalTagBox();
    });
    await expect(page.locator('.category-item')).toHaveCount(0);

    // 2. Add categories with tags
    await page.evaluate(() => {
        window.state.categories = [
            { name: "CatA", color: "primary", tags: "tagC, tagA", animation: "default" },
            { name: "CatB", color: "secondary", tags: "tagB, tagA", animation: "default" }
        ];
        window.state.renderCategoryList();
        window.state.renderGlobalTagBox();
    });

    const globalTags = page.locator('#global-tag-list .tag-pill');
    await expect(globalTags).toHaveCount(3);
    // Should be sorted alphabetically: tagA, tagB, tagC
    await expect(globalTags.nth(0)).toHaveText('tagA');
    await expect(globalTags.nth(1)).toHaveText('tagB');
    await expect(globalTags.nth(2)).toHaveText('tagC');
  });

  test('Dragging a tag from Tag Box to input adds it to the category', async ({ page }) => {
    await page.evaluate(() => {
        window.state.categories = [
            { name: "CatA", color: "primary", tags: "existingTag", animation: "default" },
            { name: "CatB", color: "secondary", tags: "targetTag", animation: "default" }
        ];
        window.state.selectedIndices = [0]; // Select CatA
        window.state.renderCategoryList();
        window.state.renderDetail();
        window.state.renderGlobalTagBox();
    });

    const tagInput = page.locator('#tag-input');
    await expect(tagInput).toBeVisible();

    const targetTag = page.locator('#global-tag-list .tag-pill:has-text("targetTag")');
    await expect(targetTag).toBeVisible();

    // Drag and drop using dataTransfer. Manually setting data in evaluate
    await page.evaluate(() => {
        const targetTag = Array.from(document.querySelectorAll('#global-tag-list .tag-pill')).find(el => el.textContent === 'targetTag');
        const tagInput = document.querySelector('#tag-input');

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', 'targetTag');

        const dragStartEvent = new DragEvent('dragstart', { dataTransfer, bubbles: true });
        targetTag.dispatchEvent(dragStartEvent);

        const dropEvent = new DragEvent('drop', { dataTransfer, bubbles: true });
        tagInput.dispatchEvent(dropEvent);
    });

    // Verify tag added to CatA
    const catATags = page.locator('#tag-list .tag-pill');
    await expect(catATags).toHaveCount(2);
    await expect(catATags.filter({ hasText: 'targetTag' })).toBeVisible();
  });

  test('Duplicates are ignored when dragging from Tag Box', async ({ page }) => {
    await page.evaluate(() => {
        window.state.categories = [
            { name: "CatA", color: "primary", tags: "tagA", animation: "default" },
            { name: "CatB", color: "secondary", tags: "tagA, tagB", animation: "default" }
        ];
        window.state.selectedIndices = [0]; // Select CatA
        window.state.renderCategoryList();
        window.state.renderDetail();
        window.state.renderGlobalTagBox();
    });

    // Drag "tagA" from Tag Box to #tag-input
    await page.evaluate(() => {
        const tagA = Array.from(document.querySelectorAll('#global-tag-list .tag-pill')).find(el => el.textContent === 'tagA');
        const tagInput = document.querySelector('#tag-input');

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', 'tagA');

        const dragStartEvent = new DragEvent('dragstart', { dataTransfer, bubbles: true });
        tagA.dispatchEvent(dragStartEvent);

        const dropEvent = new DragEvent('drop', { dataTransfer, bubbles: true });
        tagInput.dispatchEvent(dropEvent);
    });

    // Verify tagA is NOT added again
    const catATags = page.locator('#tag-list .tag-pill');
    await expect(catATags).toHaveCount(1);
  });

  test('Tag Box updates when category tags change', async ({ page }) => {
    await page.evaluate(() => {
        window.state.categories = [
            { name: "CatA", color: "primary", tags: "tagA", animation: "default" }
        ];
        window.state.selectedIndices = [0];
        window.state.renderCategoryList();
        window.state.renderDetail();
        window.state.renderGlobalTagBox();
    });

    const globalTags = page.locator('#global-tag-list .tag-pill');
    await expect(globalTags).toHaveCount(1);

    // Add a new tag manually
    await page.fill('#tag-input', 'newTag');
    await page.keyboard.press('Enter');

    // Tag Box should now have 2 tags
    await expect(globalTags).toHaveCount(2);
    await expect(globalTags.filter({ hasText: 'newTag' })).toBeVisible();

    // Remove tagA
    await page.locator('#tag-list .tag-pill:has-text("tagA") .tag-remove').click();

    // Tag Box should now only have newTag
    await expect(globalTags).toHaveCount(1);
    await expect(globalTags).toHaveText('newTag');
  });
});
