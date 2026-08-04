import { test, expect } from '@playwright/test';

test.describe('QL-Animation Maker Draft Isolation and Apply Workflow', () => {
    test.beforeEach(async ({ page }) => {
        // Log all console messages from browser
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

        // Mock chrome extension storage API so custom animation features are fully enabled in the web preview context
        await page.addInitScript(() => {
            let storageState = {};
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
                                if (storageState[k] !== undefined) {
                                    result[k] = JSON.parse(JSON.stringify(storageState[k]));
                                }
                            });
                            return result;
                        },
                        set: async (obj) => {
                            Object.assign(storageState, JSON.parse(JSON.stringify(obj)));
                        }
                    },
                    sync: {
                        get: async (keys) => {
                            const result = {};
                            const keyList = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys : Object.keys(keys || {}));
                            keyList.forEach(k => {
                                if (storageState[k] !== undefined) {
                                    result[k] = JSON.parse(JSON.stringify(storageState[k]));
                                }
                            });
                            return result;
                        },
                        set: async (obj) => {
                            Object.assign(storageState, JSON.parse(JSON.stringify(obj)));
                        }
                    }
                }
            };
        });
    });

    test('should NOT write changes to production storage or production IndexedDB until Apply is clicked', async ({ page }) => {
        // 1. Load QL-Animation Maker
        await page.goto('/projects/animation-maker/index.html?lang=en&theme=dark');
        await page.waitForSelector('#maker-app');

        // 2. Add a new custom animation
        await page.click('#add-anim-btn');
        await page.fill('#m3-dialog-input', 'Draft Test Animation');
        await page.click('#m3-dialog-ok-btn');

        // Wait for the modal dialog to close and list to be loaded
        await page.waitForSelector('.category-item:has-text("Draft Test Animation")');

        // 3. Click Apply to commit initial animation to production
        await page.click('#apply-btn');
        await page.waitForTimeout(500); // Wait for async database commits to settle

        // Verify initial production state
        const testState = await page.evaluate(async () => {
            const chromeLocal = await window.chrome.storage.local.get('custom_animation_metadata_map');
            const localStored = localStorage.getItem('custom_animation_metadata_map');
            return {
                chromeLocal,
                localStored
            };
        });
        const initialMetadata = testState.chromeLocal.custom_animation_metadata_map || {};
        const animationIds = Object.keys(initialMetadata);
        expect(animationIds.length).toBe(1);
        const animId = animationIds[0];

        // Initial expectation
        expect(initialMetadata[animId].config.exclusionStrategy).toBe('freedom');
        expect(initialMetadata[animId].payload.renderSpec.overflowBehavior).toBe('repeat');
        expect(initialMetadata[animId].payload.renderSpec.scaleWithHeight).toBe(true);
        expect(initialMetadata[animId].payload.renderSpec.invert).toBe(false);

        // 4. Change configuration items in the UI (these will trigger saveCurrentChanges but should NOT apply to production yet)

        // A. Change FG回避 (Exclusion Strategy) to "mask"
        await page.selectOption('#config-exclusion-strategy', 'mask');

        // B. Change はみ出し時の挙動 (Overflow Behavior) to "categoryColor" by unchecking the switch
        // C & D. Toggle Scale with Height and Invert using page.evaluate to bypass custom styled switch visibility
        await page.evaluate(() => {
            const overflow = document.getElementById('config-overflow');
            overflow.checked = false;
            overflow.dispatchEvent(new Event('change'));

            const scaleHeight = document.getElementById('config-scale-height');
            scaleHeight.checked = false;
            scaleHeight.dispatchEvent(new Event('change'));

            const invert = document.getElementById('config-invert');
            invert.checked = true;
            invert.dispatchEvent(new Event('change'));
        });

        // Wait a bit to ensure debounced saves and IndexedDB writes have processed
        await page.waitForTimeout(500);

        // 5. Verify that Production Storage is UNCHANGED (still has initial values)
        const currentProductionMetadata = await page.evaluate(async () => {
            const data = await window.chrome.storage.local.get('custom_animation_metadata_map');
            return data.custom_animation_metadata_map || {};
        });
        expect(currentProductionMetadata[animId].config.exclusionStrategy).toBe('freedom');
        expect(currentProductionMetadata[animId].payload.renderSpec.overflowBehavior).toBe('repeat');
        expect(currentProductionMetadata[animId].payload.renderSpec.scaleWithHeight).toBe(true);
        expect(currentProductionMetadata[animId].payload.renderSpec.invert).toBe(false);

        // 6. Verify that Production IndexedDB is UNCHANGED
        const currentProductionIDB = await page.evaluate(async (id) => {
            return new Promise((resolve, reject) => {
                let settled = false;
                const req = indexedDB.open('QuickLogAnimationDB', 1);
                req.onblocked = () => {
                    if (!settled) {
                        settled = true;
                        reject(new Error('Database open blocked'));
                    }
                };
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    if (settled) {
                        db.close();
                        return;
                    }
                    const tx = db.transaction('blobs', 'readonly');
                    const store = tx.objectStore('blobs');
                    const getReq = store.get(id);
                    getReq.onsuccess = () => {
                        if (!settled) {
                            settled = true;
                            resolve(getReq.result || null);
                        }
                        db.close();
                    };
                    getReq.onerror = () => {
                        if (!settled) {
                            settled = true;
                            resolve(null);
                        }
                        db.close();
                    };
                };
                req.onerror = () => {
                    if (!settled) {
                        settled = true;
                        resolve(null);
                    }
                };
            });
        }, animId);
        expect(currentProductionIDB.config.exclusionStrategy).toBe('freedom');
        expect(currentProductionIDB.renderSpec.overflowBehavior).toBe('repeat');
        expect(currentProductionIDB.renderSpec.scaleWithHeight).toBe(true);
        expect(currentProductionIDB.renderSpec.invert).toBe(false);

        // 7. Verify that Draft IndexedDB DOES contain the updated changes
        const currentDraftIDB = await page.evaluate(async (id) => {
            return new Promise((resolve, reject) => {
                let settled = false;
                const req = indexedDB.open('QuickLogAnimationDraftDB', 1);
                req.onblocked = () => {
                    if (!settled) {
                        settled = true;
                        reject(new Error('Database open blocked'));
                    }
                };
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    if (settled) {
                        db.close();
                        return;
                    }
                    const tx = db.transaction('blobs', 'readonly');
                    const store = tx.objectStore('blobs');
                    const getReq = store.get(id);
                    getReq.onsuccess = () => {
                        if (!settled) {
                            settled = true;
                            resolve(getReq.result || null);
                        }
                        db.close();
                    };
                    getReq.onerror = () => {
                        if (!settled) {
                            settled = true;
                            resolve(null);
                        }
                        db.close();
                    };
                };
                req.onerror = () => {
                    if (!settled) {
                        settled = true;
                        resolve(null);
                    }
                };
            });
        }, animId);
        expect(currentDraftIDB.config.exclusionStrategy).toBe('mask');
        expect(currentDraftIDB.renderSpec.overflowBehavior).toBe('categoryColor');
        expect(currentDraftIDB.renderSpec.scaleWithHeight).toBe(false);
        expect(currentDraftIDB.renderSpec.invert).toBe(true);

        // 8. Now click Apply
        await page.click('#apply-btn');
        await page.waitForTimeout(500);

        // 9. Verify that Production Storage and Production IndexedDB now contain the updated values!
        const finalProductionMetadata = await page.evaluate(async () => {
            const data = await window.chrome.storage.local.get('custom_animation_metadata_map');
            return data.custom_animation_metadata_map || {};
        });
        expect(finalProductionMetadata[animId].config.exclusionStrategy).toBe('mask');
        expect(finalProductionMetadata[animId].payload.renderSpec.overflowBehavior).toBe('categoryColor');
        expect(finalProductionMetadata[animId].payload.renderSpec.scaleWithHeight).toBe(false);
        expect(finalProductionMetadata[animId].payload.renderSpec.invert).toBe(true);

        const finalProductionIDB = await page.evaluate(async (id) => {
            return new Promise((resolve, reject) => {
                let settled = false;
                const req = indexedDB.open('QuickLogAnimationDB', 1);
                req.onblocked = () => {
                    if (!settled) {
                        settled = true;
                        reject(new Error('Database open blocked'));
                    }
                };
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    if (settled) {
                        db.close();
                        return;
                    }
                    const tx = db.transaction('blobs', 'readonly');
                    const store = tx.objectStore('blobs');
                    const getReq = store.get(id);
                    getReq.onsuccess = () => {
                        if (!settled) {
                            settled = true;
                            resolve(getReq.result || null);
                        }
                        db.close();
                    };
                    getReq.onerror = () => {
                        if (!settled) {
                            settled = true;
                            resolve(null);
                        }
                        db.close();
                    };
                };
                req.onerror = () => {
                    if (!settled) {
                        settled = true;
                        resolve(null);
                    }
                };
            });
        }, animId);
        expect(finalProductionIDB.config.exclusionStrategy).toBe('mask');
        expect(finalProductionIDB.renderSpec.overflowBehavior).toBe('categoryColor');
        expect(finalProductionIDB.renderSpec.scaleWithHeight).toBe(false);
        expect(finalProductionIDB.renderSpec.invert).toBe(true);
    });
});
