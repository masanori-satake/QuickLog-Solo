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

    const accordion = document.createElement('details');
    accordion.id = 'pwa-settings-qr-accordion';

    const statusText = document.createElement('p');
    statusText.id = 'pusher-sync-status-text';

    const canvas = document.createElement('canvas');
    canvas.id = 'pusher-sync-qr-canvas';

    accordion.appendChild(statusText);
    accordion.appendChild(canvas);
    document.body.appendChild(accordion);

    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        fillText: jest.fn(),
    }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
    closeDatabase();
});

test('renderAboutQRCodes binds toggle listener to pwa-settings-qr-accordion', async () => {
    const accordion = document.getElementById('pwa-settings-qr-accordion');
    expect(accordion.dataset.pusherListenerAdded).toBeUndefined();

    await renderAboutQRCodes();

    expect(accordion.dataset.pusherListenerAdded).toBe('true');
});
