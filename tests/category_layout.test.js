import {
    openDatabase, dbPut, dbGet, dbGetAll, closeDatabase, getCurrentAppState, setDatabaseName, DB_NAME as ACTUAL_DB_NAME,
    STORE_SETTINGS, SETTING_KEY_CATEGORY_LAYOUT
} from '../shared/js/db.js';

describe('Category Layout Setting and Logic', () => {
    const DEFAULT_DB_NAME = 'QuickLogSoloDB';

    afterEach(() => {
        closeDatabase();
    });

    beforeEach(async () => {
        closeDatabase();
        setDatabaseName(DEFAULT_DB_NAME);
        const req = indexedDB.deleteDatabase(ACTUAL_DB_NAME);
        await new Promise((resolve) => {
            req.onsuccess = resolve;
            req.onerror = resolve;
            req.onblocked = resolve;
        });
    });

    test('getCurrentAppState defaults categoryLayout to "2x8"', async () => {
        await openDatabase();
        const state = await getCurrentAppState();
        expect(state.categoryLayout).toBe('2x8');
    });

    test('saving SETTING_KEY_CATEGORY_LAYOUT as "2x4" persists correctly in getCurrentAppState', async () => {
        await openDatabase();
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_CATEGORY_LAYOUT, value: '2x4' });

        const setting = await dbGet(STORE_SETTINGS, SETTING_KEY_CATEGORY_LAYOUT);
        expect(setting).toBeDefined();
        expect(setting.value).toBe('2x4');

        const state = await getCurrentAppState();
        expect(state.categoryLayout).toBe('2x4');
    });

    test('category layout pagination splitting logic (8 items vs 16 items)', () => {
        const dummyCategories = Array.from({ length: 20 }, (_, i) => ({
            name: `Category ${i + 1}`,
            order: i,
        }));

        function splitCategoriesIntoPages(allCategories, itemsPerPage = 16) {
            allCategories.sort((a, b) => (a.order || 0) - (b.order || 0));

            const pages = [[]];
            let currentPageIdx = 0;
            allCategories.forEach((cat) => {
                if (cat.name.startsWith('__PAGE_BREAK__')) {
                    if (pages[currentPageIdx].length > 0) {
                        pages.push([]);
                        currentPageIdx++;
                    }
                } else {
                    if (pages[currentPageIdx].length >= itemsPerPage) {
                        pages.push([]);
                        currentPageIdx++;
                    }
                    pages[currentPageIdx].push(cat);
                }
            });
            if (pages.length > 1 && pages[pages.length - 1].length === 0) {
                pages.pop();
            }
            return pages;
        }

        // Test 2x8 layout (16 items/page)
        const pages2x8 = splitCategoriesIntoPages(dummyCategories, 16);
        expect(pages2x8.length).toBe(2);
        expect(pages2x8[0].length).toBe(16);
        expect(pages2x8[1].length).toBe(4);

        // Test 2x4 layout (8 items/page)
        const pages2x4 = splitCategoriesIntoPages(dummyCategories, 8);
        expect(pages2x4.length).toBe(3);
        expect(pages2x4[0].length).toBe(8);
        expect(pages2x4[1].length).toBe(8);
        expect(pages2x4[2].length).toBe(4);
    });
});
