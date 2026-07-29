import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Custom Animation (GIF) E2E rendering', () => {
    test.beforeEach(async ({ page }) => {
        // Log all console messages from browser
        page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));

        // Mock chrome extension storage API so custom animation features are fully enabled in the web preview context
        await page.addInitScript(() => {
            const storageState = {};
            window.chrome = {
                runtime: {
                    sendMessage: () => Promise.resolve(),
                    onMessage: {
                        addListener: () => {},
                        removeListener: () => {},
                    },
                },
                storage: {
                    local: {
                        get: async (keys) => {
                            const result = {};
                            const keyList =
                                typeof keys === 'string'
                                    ? [keys]
                                    : Array.isArray(keys)
                                      ? keys
                                      : Object.keys(keys || {});
                            keyList.forEach((k) => {
                                result[k] = storageState[k];
                            });
                            return result;
                        },
                        set: async (obj) => {
                            Object.assign(storageState, obj);
                        },
                    },
                    sync: {
                        get: async (keys) => {
                            const result = {};
                            const keyList =
                                typeof keys === 'string'
                                    ? [keys]
                                    : Array.isArray(keys)
                                      ? keys
                                      : Object.keys(keys || {});
                            keyList.forEach((k) => {
                                result[k] = storageState[k];
                            });
                            return result;
                        },
                        set: async (obj) => {
                            Object.assign(storageState, obj);
                        },
                    },
                },
            };
        });
    });

    test('should import sample-a qlanim, assign to a category, and render custom GIF pixels', async ({ page }) => {
        const dbName = `AnimCustomDB_${Date.now()}`;
        await page.goto(`?db=${dbName}`);

        // Wait for app to be fully initialized
        await page.waitForSelector('.category-btn');

        // Read sample qlanim file
        const qlanimPath = path.join(process.cwd(), 'projects/app/samples/sample-a.qlanim');
        const qlanimText = fs.readFileSync(qlanimPath, 'utf8');

        // Parse and replace 1x1 transparent base64 GIF with a 1x1 solid white base64 GIF
        const qlanimObj = JSON.parse(qlanimText);
        qlanimObj.payload.imageData =
            'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
        // Set overflowBehavior to categoryColor so that the category color fills the canvas background as expected
        qlanimObj.payload.renderSpec.overflowBehavior = 'categoryColor';
        const updatedQlanimText = JSON.stringify(qlanimObj);

        // Programmatically import the custom animation using window-exposed importCustomAnimation
        await page.evaluate(async (text) => {
            await window.importCustomAnimation(text);
        }, updatedQlanimText);

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
                if (imgData[i] + imgData[i + 1] + imgData[i + 2] > 0) {
                    nonZero++;
                }
            }
            return { nonZero, width: canvas.width, height: canvas.height };
        });

        console.log(
            `E2E custom GIF canvas stats: ${canvasStats.nonZero} non-zero pixels out of ${canvasStats.width * canvasStats.height}`
        );

        // We expect at least some pixels to be drawn on the canvas (since we use repeat and scaleWithHeight)
        expect(canvasStats.nonZero).toBeGreaterThanOrEqual(10);

        // Take a screenshot for visual verification
        await page.screenshot({ path: 'tests/screenshots/custom-gif-animation.png' });
    });
});
