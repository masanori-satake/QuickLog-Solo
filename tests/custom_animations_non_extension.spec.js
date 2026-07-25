import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Custom Animation Non-Extension Fallback E2E', () => {
    test('should import, assign, and persist custom animation using localStorage fallback when chrome is undefined', async ({ page }) => {
        const dbName = `AnimNonExtDB_${Date.now()}`;
        await page.goto(`?db=${dbName}`);

        // Wait for app to be fully initialized
        await page.waitForSelector('.category-btn');

        // Read sample qlanim file
        const qlanimPath = path.join(process.cwd(), 'projects/app/samples/sample-a.qlanim');
        const qlanimText = fs.readFileSync(qlanimPath, 'utf8');

        // Parse and replace 1x1 transparent base64 GIF with a 1x1 solid white base64 GIF
        const qlanimObj = JSON.parse(qlanimText);
        qlanimObj.payload.imageData = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
        qlanimObj.payload.renderSpec.overflowBehavior = 'categoryColor';
        const updatedQlanimText = JSON.stringify(qlanimObj);

        // Programmatically import the custom animation using window-exposed importCustomAnimation
        await page.evaluate(async (text) => {
            await window.importCustomAnimation(text);
        }, updatedQlanimText);

        // Verify it was saved in localStorage since chrome is undefined
        const lsMetadata = await page.evaluate(() => {
            return localStorage.getItem('custom_animation_metadata_map');
        });
        expect(lsMetadata).toBeTruthy();
        const parsedMap = JSON.parse(lsMetadata);
        expect(parsedMap['custom_uuid_001']).toBeDefined();
        expect(parsedMap['custom_uuid_001'].name).toBe('ねこぽん');

        // Open settings modal
        await page.click('#settings-toggle');

        // Switch to Categories tab to configure the category animation mapping
        await page.click('.tab-btn[data-tab="categories"]');

        // Wait for category editor list items to load
        await page.waitForSelector('.category-editor-item');

        // Locate the first business category item in the editor
        const firstCategoryItem = page.locator('.category-editor-item:not(.page-break-item)').first();
        const catName = await firstCategoryItem.getAttribute('data-name');
        expect(catName).toBeTruthy();

        // Map the custom animation 'custom_uuid_001' to this category
        await firstCategoryItem.locator('.category-edit-animation').selectOption('custom_uuid_001');

        // Close the settings modal
        await page.click('.settings-close-btn');

        // Start task for the configured category
        await page.click(`.category-btn:has-text("${catName}")`);

        // Wait for worker to boot up, load the GIF from IndexedDB, and render
        await page.waitForTimeout(4000);

        // Verify that the animation canvas renders significant non-zero pixel content
        const canvasStats = await page.evaluate(() => {
            const canvas = document.getElementById('animation-canvas');
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let nonZero = 0;
            for (let i = 0; i < imgData.length; i += 4) {
                if (imgData[i] + imgData[i+1] + imgData[i+2] > 0) {
                    nonZero++;
                }
            }
            return { nonZero, width: canvas.width, height: canvas.height };
        });

        console.log(`E2E non-extension custom GIF canvas stats: ${canvasStats.nonZero} non-zero pixels`);
        expect(canvasStats.nonZero).toBeGreaterThanOrEqual(10);

        // Reload the page and verify persistence in localStorage still lists the custom animation
        await page.reload();
        await page.waitForSelector('.category-btn');

        // Open settings modal
        await page.click('#settings-toggle');

        // Switch to Categories tab
        await page.click('.tab-btn[data-tab="categories"]');
        await page.waitForSelector('.category-editor-item');

        // Verify the option is still populated and selected
        const selectedValue = await page.locator('.category-editor-item:not(.page-break-item)').first().locator('.category-edit-animation').inputValue();
        expect(selectedValue).toBe('custom_uuid_001');
    });
});
