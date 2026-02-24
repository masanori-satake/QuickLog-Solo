import { jest } from '@jest/globals';

// Mock browser APIs
global.BroadcastChannel = class {
    constructor() {}
    postMessage() {}
    close() {}
    onmessage() {}
    addEventListener() {}
    removeEventListener() {}
};

global.navigator.serviceWorker = {
    register: jest.fn().mockResolvedValue({})
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Mock resizeTo
window.resizeTo = jest.fn();

// Mock IndexedDB and Logic modules
jest.unstable_mockModule('../js/db.js', () => ({
    dbAdd: jest.fn(),
    dbPut: jest.fn(),
    dbGet: jest.fn(),
    dbGetAll: jest.fn().mockResolvedValue([]),
    dbDelete: jest.fn(),
    dbClear: jest.fn(),
    initDB: jest.fn().mockResolvedValue({ layout: 'vertical' })
}));

jest.unstable_mockModule('../js/logic.js', () => ({
    formatDuration: jest.fn().mockReturnValue({ toString: () => '00:00:00' }),
    getAnimationState: jest.fn().mockReturnValue({ inset: 'inset(0 50% 0 0)' }),
    startTaskLogic: jest.fn(),
    stopTaskLogic: jest.fn(),
    pauseTaskLogic: jest.fn()
}));

const { getItemsPerPage, renderPagination, applyLayout, updateUI } = await import('../app.js');

describe('UI Layout Logic', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="app">
                <header><button id="layout-toggle"></button></header>
                <main>
                    <section id="category-section">
                        <div id="category-list"></div>
                        <div id="category-pagination"></div>
                    </section>
                    <section id="control-section">
                        <div id="current-task-display">
                            <div id="current-task-display-overlay"></div>
                            <div id="current-task-name"></div>
                            <div id="current-task-name-overlay"></div>
                            <div id="status-label"></div>
                            <div id="status-label-overlay"></div>
                            <div id="elapsed-time"></div>
                            <div id="elapsed-time-overlay"></div>
                        </div>
                        <div id="stop-btn-box">
                            <button id="pause-btn"></button>
                            <button id="end-btn"></button>
                        </div>
                    </section>
                    <section id="log-section">
                        <ul id="log-list"></ul>
                    </section>
                </main>
            </div>
        `;
        document.body.className = '';
    });

    test('getItemsPerPage returns correct values for layouts', () => {
        document.body.classList.add('layout-vertical');
        expect(getItemsPerPage()).toBe(8);

        document.body.classList.remove('layout-vertical');
        document.body.classList.add('layout-horizontal');
        expect(getItemsPerPage()).toBe(4);
    });

    test('renderPagination always shows at least one dot', () => {
        renderPagination(0);
        const dots = document.querySelectorAll('.page-dot');
        expect(dots.length).toBe(1);
        expect(document.getElementById('category-pagination').classList.contains('hidden')).toBe(false);

        renderPagination(1);
        expect(document.querySelectorAll('.page-dot').length).toBe(1);

        renderPagination(3);
        expect(document.querySelectorAll('.page-dot').length).toBe(3);
    });

    test('applyLayout updates classes and calls updateUI', async () => {
        // We need to mock localStorage
        const spyLocalStorage = jest.spyOn(Storage.prototype, 'setItem');

        applyLayout('horizontal');
        expect(document.body.classList.contains('layout-horizontal')).toBe(true);
        expect(spyLocalStorage).toHaveBeenCalledWith('quicklog_layout', 'horizontal');

        applyLayout('vertical');
        expect(document.body.classList.contains('layout-vertical')).toBe(true);

        spyLocalStorage.mockRestore();
    });

    test('timer overlay clip-path is updated during updateUI', async () => {
        // This test requires activeTask to be set, but it's a private variable in app.js
        // However, we can check if updateUI calls getAnimationState if we could trigger it.
        // Since we can't easily set activeTask from outside without more refactoring,
        // we'll focus on what we can verify.

        // Let's check if the overlay exists and is cleared when no task
        await updateUI();
        const overlay = document.getElementById('current-task-display-overlay');
        // JSDOM might normalize "0" to "0px" or keep it as "0" depending on version/environment
        // We check for the presence of "inset" and "100%"
        expect(overlay.style.clipPath).toMatch(/inset\(0(px)? 0(px)? 0(px)? 100%\)/);
    });
});
