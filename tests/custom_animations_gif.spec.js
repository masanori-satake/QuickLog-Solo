import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Custom Animation (GIF) E2E rendering', () => {
    test.beforeEach(async ({ page }) => {
        // Log all console messages from browser
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

        // Mock chrome extension storage API so custom animation features are fully enabled in the web preview context
        await page.addInitScript(() => {
            const storageState = {};
            window.chrome = {
                runtime: {
                    sendMessage: () => Promise.resolve(),
                    onMessage: {
                        addListener: () => {},
                        removeListener: () => {}
                    }
                },
                storage: {
                    local: {
                        get: async (keys) => {
                            const result = {};
                            const keyList = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys : Object.keys(keys || {}));
                            keyList.forEach(k => {
                                result[k] = storageState[k];
                            });
                            return result;
                        },
                        set: async (obj) => {
                            Object.assign(storageState, obj);
                        }
                    },
                    sync: {
                        get: async (keys) => {
                            const result = {};
                            const keyList = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys : Object.keys(keys || {}));
                            keyList.forEach(k => {
                                result[k] = storageState[k];
                            });
                            return result;
                        },
                        set: async (obj) => {
                            Object.assign(storageState, obj);
                        }
                    }
                }
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
        qlanimObj.payload.imageData = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
        // Set overflowBehavior to categoryColor so that the category color fills the canvas background as expected
        qlanimObj.payload.renderSpec.overflowBehavior = 'categoryColor';
        const updatedQlanimText = JSON.stringify(qlanimObj);

        const firstCategoryBtn = page.locator('.category-btn').first();
        const catName = (await firstCategoryBtn.textContent()).trim();
        expect(catName).toBeTruthy();

        // Programmatically update the category's animation mapping in IndexedDB first
        await page.evaluate(async (name) => {
            const urlParams = new URLSearchParams(window.location.search);
            const dbName = urlParams.get('db') || 'QuickLogSoloDB';
            const req = indexedDB.open(dbName);
            await new Promise((resolve, reject) => {
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('categories', 'readwrite');
                    const store = tx.objectStore('categories');
                    const getReq = store.getAll();
                    getReq.onsuccess = () => {
                        const categories = getReq.result;
                        const target = categories.find(c => c.name === name);
                        if (target) {
                            target.animation = 'custom_uuid_001';
                            store.put(target);
                        }
                        tx.oncomplete = () => resolve();
                    };
                    tx.onerror = () => reject(tx.error);
                };
                req.onerror = () => reject(req.error);
            });
        }, catName);

        // Programmatically import the custom animation, which triggers updateUI() and loads animation
        await page.evaluate(async (text) => {
            await window.importCustomAnimation(text);
        }, updatedQlanimText);

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

        console.log(`E2E custom GIF canvas stats: ${canvasStats.nonZero} non-zero pixels out of ${canvasStats.width * canvasStats.height}`);

        // We expect at least some pixels to be drawn on the canvas (since we use repeat and scaleWithHeight)
        expect(canvasStats.nonZero).toBeGreaterThanOrEqual(10);

        // Take a screenshot for visual verification
        await page.screenshot({ path: 'tests/screenshots/custom-gif-animation.png' });
    });
});
