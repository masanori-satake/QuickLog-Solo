import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const appSource = readFileSync('projects/app/js/app.js', 'utf8');
const renderers = [
    ['renderAlarmList', 'alarm-list', [{ id: 1, time: '08:15' }], [], '.alarm-time', '08:15'],
    ['renderCategoryList', 'category-editor-list', [{ id: 1, name: 'Work' }], [], '.category-readonly-name', 'Work'],
    ['renderBusinessDays', 'business-days-container', { businessDays: [0, 6] }, { businessDays: [] }, '.active', null],
];

function setupRenderer(name, id) {
    const container = document.createElement('div');
    container.id = id;
    document.body.replaceChildren(container);
    const read = jest.fn();
    const context = vm.createContext({
        document,
        console: { error: jest.fn() },
        getEl: (elementId) => document.getElementById(elementId),
        createEl: (tag) => document.createElement(tag),
        ID_ALARM_LIST: 'alarm-list',
        ID_CATEGORY_EDITOR_LIST: 'category-editor-list',
        ID_BUSINESS_DAYS_CONTAINER: 'business-days-container',
        STORE_ALARMS: 'alarms',
        STORE_CATEGORIES: 'categories',
        SYSTEM_CATEGORY_IDLE: 'Idle',
        SYSTEM_CATEGORY_PAGE_BREAK: '__PAGE_BREAK__',
        dbGetAll: read,
        getCurrentAppState: read,
        getCustomAnimationMetadataMap: async () => ({}),
        getLanguage: () => 'en',
        isPWAMode: () => false,
        t: (key) => key,
        getColorCode: () => '#1976d2',
        animations: [],
    });
    // Exercise the actual renderer without starting the application's UI or adding production exports.
    const source = appSource.match(new RegExp(`^async function ${name}\\(\\) \\{[\\s\\S]*?^\\}`, 'm'));
    expect(source).not.toBeNull();
    vm.runInContext(source[0], context);
    return { container, read, render: context[name], error: context.console.error };
}

describe.each(renderers)('%s storage reads', (name, id, data, emptyData, selector, text) => {
    test('preserves existing DOM while loading and after failure, then updates on recovery', async () => {
        const { container, read, render, error } = setupRenderer(name, id);
        read.mockResolvedValueOnce(data);
        await render();
        const children = Array.from(container.childNodes);
        expect(children.length).toBeGreaterThan(0);
        if (text) expect(container.querySelector(selector).textContent).toBe(text);
        else expect(container.querySelectorAll(selector)).toHaveLength(2);

        let rejectRead;
        read.mockImplementationOnce(
            () =>
                new Promise((resolve, reject) => {
                    rejectRead = reject;
                })
        );
        const pendingRender = render();
        expect(Array.from(container.childNodes)).toEqual(children);
        const failure = new Error('IndexedDB read failed');
        rejectRead(failure);
        await expect(pendingRender).resolves.toBeUndefined();
        expect(error).toHaveBeenCalledWith(expect.any(String), failure);
        expect(container.childNodes).toHaveLength(children.length);
        children.forEach((child, index) => expect(container.childNodes[index]).toBe(child));

        read.mockResolvedValueOnce(data);
        await render();
        expect(container.firstChild).not.toBe(children[0]);
        if (text) expect(container.querySelector(selector).textContent).toBe(text);
        else expect(container.querySelectorAll(selector)).toHaveLength(2);
    });

    test('applies an empty result after a successful read', async () => {
        const { container, read, render, error } = setupRenderer(name, id);
        read.mockResolvedValueOnce(data).mockResolvedValueOnce(emptyData);
        await render();
        await render();
        expect(container.querySelectorAll(selector)).toHaveLength(0);
        if (name === 'renderBusinessDays') expect(container.children).toHaveLength(7);
        else expect(container.children).toHaveLength(0);
        expect(error).not.toHaveBeenCalled();
    });
});

test('uses default business days only after a successful read with no saved setting', async () => {
    const { container, read, render } = setupRenderer('renderBusinessDays', 'business-days-container');
    read.mockResolvedValueOnce({});
    await render();
    expect(Array.from(container.children, (chip) => chip.classList.contains('active'))).toEqual([
        false,
        true,
        true,
        true,
        true,
        true,
        false,
    ]);
});
