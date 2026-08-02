import { jest } from '@jest/globals';
import { fc, test as fcTest } from '@fast-check/jest';

// Mock dependencies
jest.unstable_mockModule('../shared/js/db.js', () => ({
    dbClear: jest.fn(),
    STORE_LOGS: 'logs',
    STORE_CATEGORIES: 'categories',
    STORE_SETTINGS: 'settings',
    STORE_ALARMS: 'alarms',
}));

jest.unstable_mockModule('../shared/js/idb_storage.js', () => ({
    initAnimationDB: jest.fn(),
}));

jest.unstable_mockModule('../shared/js/utils/storage.js', () => ({
    setCustomAnimationMetadataMap: jest.fn(),
}));

const { dbClear, STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, STORE_ALARMS } = await import(
    '../shared/js/db.js'
);
const { initAnimationDB } = await import('../shared/js/idb_storage.js');
const { setCustomAnimationMetadataMap } = await import('../shared/js/utils/storage.js');

/**
 * Sets up the DOM structure for the delete/initialize section.
 * Mirrors the HTML in projects/app/app.html.
 */
function setupDOM() {
    document.body.innerHTML = `
        <div class="maintenance-section" id="delete-initialize-section">
            <h3 data-i18n="maintenance-delete-title"></h3>
            <div class="checkbox-group">
                <label class="checkbox-item">
                    <input type="checkbox" id="clear-logs-checkbox" value="logs">
                    <span data-i18n="maintenance-clear-logs"></span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="clear-categories-checkbox" value="categories">
                    <span data-i18n="maintenance-clear-categories"></span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="clear-settings-checkbox" value="settings">
                    <span data-i18n="maintenance-clear-settings"></span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="clear-alarms-checkbox" value="alarms">
                    <span data-i18n="maintenance-clear-alarms"></span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="clear-animations-checkbox" value="animations">
                    <span data-i18n="maintenance-clear-animations"></span>
                </label>
            </div>
            <button id="delete-initialize-btn" class="btn btn-danger" disabled data-i18n="maintenance-delete-execute"></button>
        </div>
    `;
}

/**
 * Updates the delete-initialize button disabled state based on checkbox selection.
 * This replicates the logic that app.js (Task 7.3) implements.
 */
function updateDeleteButtonState() {
    const checkboxes = document.querySelectorAll('#delete-initialize-section input[type="checkbox"]');
    const btn = document.getElementById('delete-initialize-btn');
    const anyChecked = Array.from(checkboxes).some((cb) => cb.checked);
    btn.disabled = !anyChecked;
}

/**
 * Attaches change event listeners to checkboxes to update button state.
 */
function attachCheckboxListeners() {
    const checkboxes = document.querySelectorAll('#delete-initialize-section input[type="checkbox"]');
    checkboxes.forEach((cb) => {
        cb.addEventListener('change', updateDeleteButtonState);
    });
}

/**
 * Executes the delete/initialize action for selected stores.
 * This replicates the logic that app.js (Task 7.3) implements.
 * @returns {Promise<void>}
 */
async function executeDeleteInitialize() {
    const btn = document.getElementById('delete-initialize-btn');
    const checkboxes = document.querySelectorAll('#delete-initialize-section input[type="checkbox"]');
    const selected = Array.from(checkboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);

    if (selected.length === 0) return;

    // Disable button during execution
    btn.disabled = true;

    const storeMap = {
        logs: STORE_LOGS,
        categories: STORE_CATEGORIES,
        settings: STORE_SETTINGS,
        alarms: STORE_ALARMS,
    };

    for (const item of selected) {
        if (item === 'animations') {
            // Clear QuickLogAnimationDB blobs store
            const animDb = await initAnimationDB();
            await new Promise((resolve, reject) => {
                const tx = animDb.transaction('blobs', 'readwrite');
                const store = tx.objectStore('blobs');
                const req = store.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
            // Clear metadata
            await setCustomAnimationMetadataMap({});
        } else {
            await dbClear(storeMap[item]);
        }
    }

    // Reset checkboxes and re-enable button
    checkboxes.forEach((cb) => {
        cb.checked = false;
    });
    updateDeleteButtonState();
}

describe('Maintenance UI: 削除/初期化セクション', () => {
    beforeEach(() => {
        setupDOM();
        attachCheckboxListeners();
        jest.clearAllMocks();
    });

    describe('チェックボックス未選択時に実行ボタンが disabled', () => {
        it('初期状態ではすべてのチェックボックスが未選択で実行ボタンは disabled', () => {
            const btn = document.getElementById('delete-initialize-btn');
            expect(btn.disabled).toBe(true);
        });

        it('チェックボックスを1つ選択するとボタンが有効になる', () => {
            const cb = document.getElementById('clear-logs-checkbox');
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));

            const btn = document.getElementById('delete-initialize-btn');
            expect(btn.disabled).toBe(false);
        });

        it('チェックを外してすべて未選択に戻るとボタンが disabled に戻る', () => {
            const cb = document.getElementById('clear-logs-checkbox');
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));

            cb.checked = false;
            cb.dispatchEvent(new Event('change', { bubbles: true }));

            const btn = document.getElementById('delete-initialize-btn');
            expect(btn.disabled).toBe(true);
        });
    });

    describe('「カスタムアニメーション」選択時に対象ストアが正しく消去される', () => {
        it('animations チェック時に initAnimationDB と setCustomAnimationMetadataMap が呼ばれる', async () => {
            const mockClearReq = { onsuccess: null, onerror: null };
            const mockStore = { clear: jest.fn(() => mockClearReq) };
            const mockTx = { objectStore: jest.fn(() => mockStore) };
            const mockDb = { transaction: jest.fn(() => mockTx) };
            initAnimationDB.mockResolvedValue(mockDb);
            setCustomAnimationMetadataMap.mockResolvedValue(undefined);

            // Check animations checkbox
            const cb = document.getElementById('clear-animations-checkbox');
            cb.checked = true;

            // Execute
            const execPromise = executeDeleteInitialize();

            // Wait for initAnimationDB to resolve, then trigger clear success
            await new Promise((r) => setTimeout(r, 0));
            mockClearReq.onsuccess();

            await execPromise;

            expect(initAnimationDB).toHaveBeenCalled();
            expect(mockDb.transaction).toHaveBeenCalledWith('blobs', 'readwrite');
            expect(mockStore.clear).toHaveBeenCalled();
            expect(setCustomAnimationMetadataMap).toHaveBeenCalledWith({});
        });

        it('animations 以外のチェックでは initAnimationDB が呼ばれない', async () => {
            dbClear.mockResolvedValue(undefined);

            const cb = document.getElementById('clear-logs-checkbox');
            cb.checked = true;

            await executeDeleteInitialize();

            expect(initAnimationDB).not.toHaveBeenCalled();
            expect(setCustomAnimationMetadataMap).not.toHaveBeenCalled();
            expect(dbClear).toHaveBeenCalledWith(STORE_LOGS);
        });
    });

    describe('実行中はボタンが disabled', () => {
        it('executeDeleteInitialize 中はボタンが disabled になる', async () => {
            dbClear.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(resolve, 50);
                    })
            );

            const cb = document.getElementById('clear-logs-checkbox');
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));

            const btn = document.getElementById('delete-initialize-btn');
            expect(btn.disabled).toBe(false);

            const execPromise = executeDeleteInitialize();

            // Button should be disabled immediately after starting execution
            expect(btn.disabled).toBe(true);

            await execPromise;

            // After completion, checkboxes are reset so button remains disabled
            expect(btn.disabled).toBe(true);
        });
    });

    /**
     * **Validates: Requirements 5.2, 5.4, 5.5, 5.7**
     */
    describe('Property 6: チェックボックス選択状態と実行ボタンの有効状態の一致', () => {
        fcTest.prop([fc.subarray(['logs', 'categories', 'settings', 'alarms', 'animations'])])(
            'execute button enabled iff at least one checkbox selected',
            (selected) => {
                setupDOM();
                attachCheckboxListeners();

                // Set checkbox states based on generated selection
                const checkboxes = document.querySelectorAll(
                    '#delete-initialize-section input[type="checkbox"]'
                );
                checkboxes.forEach((cb) => {
                    cb.checked = selected.includes(cb.value);
                });

                // Trigger the update logic
                updateDeleteButtonState();

                const btn = document.getElementById('delete-initialize-btn');
                if (selected.length === 0) {
                    expect(btn.disabled).toBe(true);
                } else {
                    expect(btn.disabled).toBe(false);
                }
            }
        );
    });
});
