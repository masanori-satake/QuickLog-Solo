/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import {
    initDB,
    setDatabaseName,
    dbGetAll,
    dbAdd,
    dbClear,
    STORE_LOGS,
    STORE_CATEGORIES,
    STORE_SETTINGS,
} from '../shared/js/db.js';

describe('History Edit Modal - Add Category from Memo', () => {
    let openHistoryEditModalForTesting;
    let isPWAMode;

    beforeAll(async () => {
        setDatabaseName('TestHistoryEditDB');
        await initDB();
        // Prevent auto-starting app on DOMContentLoaded
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const appModule = await import('../projects/app/js/app.js');
        openHistoryEditModalForTesting = appModule.openHistoryEditModalForTesting;
        isPWAMode = appModule.isPWAMode;
    });

    beforeEach(async () => {
        await dbClear(STORE_LOGS);
        await dbClear(STORE_CATEGORIES);
        await dbClear(STORE_SETTINGS);

        delete globalThis.window.IS_PWA;

        // Setup DOM for history-edit-modal and confirm-modal
        document.body.replaceChildren();

        const modal = document.createElement('div');
        modal.id = 'history-edit-modal';
        modal.className = 'modal hidden';

        const title = document.createElement('h2');
        title.id = 'history-edit-title';
        modal.appendChild(title);

        const timeLabel = document.createElement('label');
        timeLabel.id = 'history-edit-time-label';
        modal.appendChild(timeLabel);

        const timeInput = document.createElement('input');
        timeInput.type = 'time';
        timeInput.id = 'history-edit-time-input';
        modal.appendChild(timeInput);

        const catItem = document.createElement('div');
        catItem.id = 'history-edit-category-item';
        const catSelect = document.createElement('select');
        catSelect.id = 'history-edit-category-select';
        catItem.appendChild(catSelect);
        modal.appendChild(catItem);

        const memoItem = document.createElement('div');
        memoItem.id = 'history-edit-memo-item';
        const memoInput = document.createElement('input');
        memoInput.type = 'text';
        memoInput.id = 'history-edit-memo-input';
        memoItem.appendChild(memoInput);
        modal.appendChild(memoItem);

        const addCatItem = document.createElement('div');
        addCatItem.id = 'history-edit-add-category-item';
        const addCatLabel = document.createElement('label');
        addCatLabel.className = 'history-edit-checkbox-label';
        const addCatCheckbox = document.createElement('input');
        addCatCheckbox.type = 'checkbox';
        addCatCheckbox.id = 'history-edit-add-category-checkbox';
        addCatCheckbox.disabled = true;
        const addCatSpan = document.createElement('span');
        addCatSpan.textContent = 'メモ内容のカテゴリを追加';
        addCatLabel.appendChild(addCatCheckbox);
        addCatLabel.appendChild(addCatSpan);
        addCatItem.appendChild(addCatLabel);
        modal.appendChild(addCatItem);

        const warning = document.createElement('div');
        warning.id = 'history-edit-warning';
        warning.className = 'alert-box hidden';
        modal.appendChild(warning);

        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'history-edit-cancel-btn';
        modal.appendChild(cancelBtn);

        const applyBtn = document.createElement('button');
        applyBtn.id = 'history-edit-apply-btn';
        modal.appendChild(applyBtn);

        document.body.appendChild(modal);

        // Confirm modal for overwrite prompt
        const confirmModal = document.createElement('div');
        confirmModal.id = 'confirm-modal';
        confirmModal.className = 'modal hidden';
        const confirmMsg = document.createElement('p');
        confirmMsg.id = 'confirm-message';
        const confirmCancelBtn = document.createElement('button');
        confirmCancelBtn.id = 'confirm-cancel-btn';
        const confirmOkBtn = document.createElement('button');
        confirmOkBtn.id = 'confirm-ok-btn';
        confirmModal.appendChild(confirmMsg);
        confirmModal.appendChild(confirmCancelBtn);
        confirmModal.appendChild(confirmOkBtn);
        document.body.appendChild(confirmModal);
    });

    test('checkbox is disabled when memo is empty or contains only whitespace', async () => {
        const catId = await dbAdd(STORE_CATEGORIES, {
            name: '開発',
            color: 'primary',
            tags: 'tag1',
            animation: 'default',
            order: 0,
        });
        const logId = await dbAdd(STORE_LOGS, {
            category: '開発',
            startTime: Date.now() - 3600000,
            endTime: Date.now() - 1800000,
            memo: '',
        });
        const log = (await dbGetAll(STORE_LOGS))[0];

        await openHistoryEditModalForTesting(log);

        const memoInput = document.getElementById('history-edit-memo-input');
        const addCatCheckbox = document.getElementById('history-edit-add-category-checkbox');

        expect(addCatCheckbox.checked).toBe(false);
        expect(addCatCheckbox.disabled).toBe(true);

        // Input full-width whitespace
        memoInput.value = '　　  ';
        memoInput.dispatchEvent(new Event('input'));
        expect(addCatCheckbox.disabled).toBe(true);
        expect(addCatCheckbox.checked).toBe(false);

        // Input valid text
        memoInput.value = '　　新規タスク　　';
        memoInput.dispatchEvent(new Event('input'));
        expect(addCatCheckbox.disabled).toBe(false);

        // Check it, then clear text
        addCatCheckbox.checked = true;
        memoInput.value = '   ';
        memoInput.dispatchEvent(new Event('input'));
        expect(addCatCheckbox.disabled).toBe(true);
        expect(addCatCheckbox.checked).toBe(false);
    });

    test('creates new category from normalized memo and clears memo on apply', async () => {
        await dbAdd(STORE_CATEGORIES, {
            name: '既存カテゴリ',
            color: 'teal',
            tags: 'tagA,tagB',
            animation: 'wave',
            order: 5,
        });

        const startTime = new Date().setHours(10, 0, 0, 0);
        const endTime = startTime + 3600000;
        const logId = await dbAdd(STORE_LOGS, {
            category: '既存カテゴリ',
            startTime,
            endTime,
            memo: '既存メモ',
            color: 'teal',
            tags: 'tagA,tagB',
        });
        const log = (await dbGetAll(STORE_LOGS))[0];

        await openHistoryEditModalForTesting(log);

        const memoInput = document.getElementById('history-edit-memo-input');
        const addCatCheckbox = document.getElementById('history-edit-add-category-checkbox');
        const applyBtn = document.getElementById('history-edit-apply-btn');

        // Input memo with whitespace variations
        memoInput.value = '  　新カテゴリ　　サブタスク 　 ';
        memoInput.dispatchEvent(new Event('input'));
        expect(addCatCheckbox.disabled).toBe(false);

        addCatCheckbox.checked = true;
        applyBtn.click();

        // Allow microtasks to resolve
        await new Promise((r) => setTimeout(r, 50));

        const categories = await dbGetAll(STORE_CATEGORIES);
        const newCat = categories.find((c) => c.name === '新カテゴリ サブタスク');
        expect(newCat).toBeDefined();
        expect(newCat.color).toBe('teal');
        expect(newCat.tags).toBe('tagA,tagB');
        expect(newCat.animation).toBe('wave');
        expect(newCat.order).toBe(6);

        const logs = await dbGetAll(STORE_LOGS);
        const updatedLog = logs.find((l) => l.id === logId);
        expect(updatedLog.category).toBe('新カテゴリ サブタスク');
        expect(updatedLog.memo).toBeUndefined();
    });

    test('prompts confirmation when category already exists and overwrites on OK', async () => {
        await dbAdd(STORE_CATEGORIES, {
            name: 'カテゴリA',
            color: 'teal',
            tags: 'tag_source',
            animation: 'snow_fall',
            order: 1,
        });
        await dbAdd(STORE_CATEGORIES, {
            name: '既存同名',
            color: 'error',
            tags: 'tag_old',
            animation: 'default',
            order: 2,
        });

        const startTime = new Date().setHours(11, 0, 0, 0);
        const endTime = startTime + 1800000;
        const logId = await dbAdd(STORE_LOGS, {
            category: 'カテゴリA',
            startTime,
            endTime,
            memo: 'テスト',
        });
        const log = (await dbGetAll(STORE_LOGS))[0];

        await openHistoryEditModalForTesting(log);

        const memoInput = document.getElementById('history-edit-memo-input');
        const addCatCheckbox = document.getElementById('history-edit-add-category-checkbox');
        const applyBtn = document.getElementById('history-edit-apply-btn');

        memoInput.value = '既存同名';
        memoInput.dispatchEvent(new Event('input'));
        addCatCheckbox.checked = true;

        applyBtn.click();

        // Confirm modal should appear
        await new Promise((r) => setTimeout(r, 20));
        const confirmModal = document.getElementById('confirm-modal');
        expect(confirmModal.classList.contains('hidden')).toBe(false);
        expect(document.getElementById('confirm-message').innerText).toContain('既存同名');

        // Click OK to overwrite
        document.getElementById('confirm-ok-btn').click();
        await new Promise((r) => setTimeout(r, 50));

        const categories = await dbGetAll(STORE_CATEGORIES);
        expect(categories.length).toBe(2);
        const overwritten = categories.find((c) => c.name === '既存同名');
        expect(overwritten.order).toBe(2); // Order preserved
        expect(overwritten.color).toBe('teal'); // Inherited from source category
        expect(overwritten.tags).toBe('tag_source');
        expect(overwritten.animation).toBe('snow_fall');

        const logs = await dbGetAll(STORE_LOGS);
        const updatedLog = logs.find((l) => l.id === logId);
        expect(updatedLog.category).toBe('既存同名');
        expect(updatedLog.memo).toBeUndefined();
    });

    test('canceling overwrite keeps modal open and does not modify category or log', async () => {
        await dbAdd(STORE_CATEGORIES, {
            name: 'カテゴリA',
            color: 'teal',
            tags: 'tag_source',
            animation: 'default',
            order: 1,
        });
        await dbAdd(STORE_CATEGORIES, {
            name: '既存同名',
            color: 'error',
            tags: 'tag_old',
            animation: 'none',
            order: 2,
        });

        const startTime = new Date().setHours(12, 0, 0, 0);
        const endTime = startTime + 1800000;
        const logId = await dbAdd(STORE_LOGS, {
            category: 'カテゴリA',
            startTime,
            endTime,
            memo: 'メモそのまま',
        });
        const log = (await dbGetAll(STORE_LOGS))[0];

        await openHistoryEditModalForTesting(log);

        const memoInput = document.getElementById('history-edit-memo-input');
        const addCatCheckbox = document.getElementById('history-edit-add-category-checkbox');
        const applyBtn = document.getElementById('history-edit-apply-btn');

        memoInput.value = '既存同名';
        memoInput.dispatchEvent(new Event('input'));
        addCatCheckbox.checked = true;

        applyBtn.click();

        await new Promise((r) => setTimeout(r, 20));
        // Click Cancel on overwrite confirm
        document.getElementById('confirm-cancel-btn').click();
        await new Promise((r) => setTimeout(r, 50));

        // History edit modal should still be visible (not hidden)
        const historyEditModal = document.getElementById('history-edit-modal');
        expect(historyEditModal.classList.contains('hidden')).toBe(false);

        // Categories must NOT be overwritten
        const categories = await dbGetAll(STORE_CATEGORIES);
        const existing = categories.find((c) => c.name === '既存同名');
        expect(existing.color).toBe('error');
        expect(existing.tags).toBe('tag_old');

        // Log must remain unchanged
        const logs = await dbGetAll(STORE_LOGS);
        const updatedLog = logs.find((l) => l.id === logId);
        expect(updatedLog.category).toBe('カテゴリA');
        expect(updatedLog.memo).toBe('メモそのまま');
    });

    test('hides add-category-item when isPWAMode is true', async () => {
        globalThis.window.IS_PWA = true;

        await dbAdd(STORE_CATEGORIES, {
            name: '作業',
            color: 'primary',
            order: 0,
        });
        const log = {
            id: 1,
            category: '作業',
            startTime: Date.now() - 10000,
            endTime: Date.now(),
            memo: 'PWAテスト',
        };

        await openHistoryEditModalForTesting(log);

        const addCatItem = document.getElementById('history-edit-add-category-item');
        expect(addCatItem.classList.contains('hidden')).toBe(true);
    });
});
