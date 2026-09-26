import { jest } from '@jest/globals';
import {
    closeDatabase,
    setDatabaseName,
    dbPut,
    STORE_SETTINGS,
    STORE_CATEGORIES,
    STORE_ALARMS,
} from '../shared/js/db.js';

let renderAboutQRCodes;
const groups = ['general', 'categories', 'settings'];
let contexts;

beforeAll(async () => {
    const ready = jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    ({ renderAboutQRCodes } = await import('../projects/app/js/app.js'));
    ready.mockRestore();
});

beforeEach(async () => {
    closeDatabase();
    setDatabaseName(`QRExport_${Math.random()}`);
    await dbPut(STORE_SETTINGS, { key: 'theme', value: 'dark' });
    await dbPut(STORE_CATEGORIES, { id: 1, name: 'Work' });
    await dbPut(STORE_ALARMS, { id: 1, name: 'Alarm' });
    document.body.replaceChildren();
    contexts = {};
    for (const group of groups) {
        if (group === 'categories') {
            const container = document.createElement('div');
            container.id = 'pwa-categories-qr-container';
            const canvas = document.createElement('canvas');
            canvas.id = `pwa-categories-qr-canvas`;
            canvas.title = 'Previous error';
            container.append(canvas);
            document.body.append(container);
        } else {
            const canvas = document.createElement('canvas');
            canvas.id = `pwa-${group}-qr-canvas`;
            canvas.title = 'Previous error';
            document.body.append(canvas);
        }
    }
    const getMockContext = () => ({ fillRect: jest.fn(), strokeRect: jest.fn(), fillText: jest.fn() });
    for (const group of groups) {
        const canvasId = `pwa-${group}-qr-canvas`;
        contexts[canvasId] = getMockContext();
    }
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
        if (!contexts[this.id]) {
            contexts[this.id] = { fillRect: jest.fn(), strokeRect: jest.fn(), fillText: jest.fn() };
        }
        return contexts[this.id];
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
    closeDatabase();
});

test.each([
    [STORE_SETTINGS, ['general', 'settings']],
    [STORE_CATEGORIES, ['categories', 'settings']],
    [STORE_ALARMS, ['general', 'settings']],
])('a failed %s read shows errors only on dependent QR codes', async (failedStore, affectedGroups) => {
    const getAll = globalThis.IDBObjectStore.prototype.getAll;
    jest.spyOn(globalThis.IDBObjectStore.prototype, 'getAll').mockImplementation(function () {
        if (this.name === failedStore) throw new Error('Read failed');
        return getAll.call(this);
    });

    await expect(renderAboutQRCodes()).resolves.toBeUndefined();

    for (const group of groups) {
        const canvas = document.getElementById(`pwa-${group}-qr-canvas`);
        const context = contexts[canvas.id];
        if (affectedGroups.includes(group)) {
            expect(context.fillText).toHaveBeenCalledTimes(2);
            expect(canvas.title).not.toBe('');
            expect(canvas.title).not.toBe('Previous error');
        } else {
            expect(context.fillText).not.toHaveBeenCalled();
            expect(context.fillRect.mock.calls.length).toBeGreaterThan(1);
            expect(canvas.title).toBe('');
        }
    }
});

test.each([
    ['general', [STORE_SETTINGS, STORE_ALARMS]],
    ['categories', [STORE_CATEGORIES]],
    ['settings', [STORE_SETTINGS, STORE_CATEGORIES, STORE_ALARMS]],
])('the %s QR reads only its required stores', async (group, requiredStores) => {
    for (const other of groups.filter((value) => value !== group)) {
        const el = document.getElementById(`pwa-${other}-qr-canvas`);
        if (el) el.remove();
        if (other === 'categories') {
            const container = document.getElementById('pwa-categories-qr-container');
            if (container) container.remove();
        }
    }
    const readStores = [];
    const getAll = globalThis.IDBObjectStore.prototype.getAll;
    jest.spyOn(globalThis.IDBObjectStore.prototype, 'getAll').mockImplementation(function () {
        readStores.push(this.name);
        return getAll.call(this);
    });
    await renderAboutQRCodes();
    expect(readStores).toEqual(requiredStores);
    expect(document.getElementById(`pwa-${group}-qr-canvas`).title).toBe('');
});
