import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

let copyToClipboard;

beforeAll(async () => {
    // Import the clipboard helper without starting asynchronous application initialization.
    const readyState = jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    try {
        ({ copyToClipboard } = await import('../projects/app/js/app.js'));
    } finally {
        readyState.mockRestore();
    }
});

describe('copyToClipboard', () => {
    let originalNavigator;
    let originalExecCommand;
    let originalClipboardItem;
    let focusTarget;

    beforeEach(() => {
        originalNavigator = globalThis.navigator;
        originalExecCommand = document.execCommand;
        originalClipboardItem = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem');
    });

    afterEach(() => {
        Object.defineProperty(globalThis, 'navigator', {
            value: originalNavigator,
            writable: true,
            configurable: true,
        });
        document.execCommand = originalExecCommand;
        if (originalClipboardItem) {
            Object.defineProperty(globalThis, 'ClipboardItem', originalClipboardItem);
        } else {
            delete globalThis.ClipboardItem;
        }
        focusTarget?.remove();
        focusTarget = null;
        jest.restoreAllMocks();
    });

    test('returns true when navigator.clipboard.writeText succeeds', async () => {
        const writeTextMock = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                clipboard: {
                    writeText: writeTextMock,
                },
            },
            writable: true,
            configurable: true,
        });

        const result = await copyToClipboard('Hello World');

        expect(result).toBe(true);
        expect(writeTextMock).toHaveBeenCalledWith('Hello World');
    });

    test('falls back to execCommand when navigator.clipboard.writeText throws an error', async () => {
        const writeTextMock = jest.fn().mockRejectedValue(new Error('NotAllowedError: Document is not focused'));
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                clipboard: {
                    writeText: writeTextMock,
                },
            },
            writable: true,
            configurable: true,
        });

        document.execCommand = jest.fn().mockReturnValue(true);

        const result = await copyToClipboard('Fallback Text');

        expect(result).toBe(true);
        expect(writeTextMock).toHaveBeenCalledWith('Fallback Text');
        expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    test('falls back to execCommand when navigator.clipboard is undefined', async () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: {},
            writable: true,
            configurable: true,
        });

        document.execCommand = jest.fn().mockReturnValue(true);

        const result = await copyToClipboard('No Clipboard API');

        expect(result).toBe(true);
        expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    test('copies HTML using ClipboardItem when supported', async () => {
        const writeMock = jest.fn().mockResolvedValue(undefined);
        globalThis.ClipboardItem = jest.fn().mockImplementation((items) => items);

        Object.defineProperty(globalThis, 'navigator', {
            value: {
                clipboard: {
                    write: writeMock,
                },
            },
            writable: true,
            configurable: true,
        });

        const htmlContent = '<table><tr><td>Test</td></tr></table>';
        const result = await copyToClipboard(htmlContent, true);

        expect(result).toBe(true);
        expect(writeMock).toHaveBeenCalled();
        const item = writeMock.mock.calls[0][0][0];
        expect(item['text/html'].type).toBe('text/html');
        expect(item['text/plain'].type).toBe('text/plain');
    });

    test('falls back to execCommand when HTML ClipboardItem write fails', async () => {
        const writeMock = jest.fn().mockRejectedValue(new Error('Type text/html not supported on-write'));
        globalThis.ClipboardItem = jest.fn().mockImplementation((items) => items);

        Object.defineProperty(globalThis, 'navigator', {
            value: {
                clipboard: {
                    write: writeMock,
                },
            },
            writable: true,
            configurable: true,
        });

        const setData = jest.fn();
        const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
        Object.defineProperty(copyEvent, 'clipboardData', { value: { setData } });
        document.execCommand = jest.fn().mockImplementation(() => {
            document.activeElement.dispatchEvent(copyEvent);
            return true;
        });

        const htmlContent = '<table><tr><td>Test</td></tr></table>';
        const result = await copyToClipboard(htmlContent, true);

        expect(result).toBe(true);
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(setData).toHaveBeenCalledWith('text/html', htmlContent);
        expect(setData).toHaveBeenCalledWith('text/plain', htmlContent);
        expect(copyEvent.defaultPrevented).toBe(true);
        expect(document.querySelector('textarea')).toBeNull();

        // A later copy must not reuse the report's temporary listener.
        setData.mockClear();
        document.dispatchEvent(copyEvent);
        expect(setData).not.toHaveBeenCalled();
    });

    test.each(['ClipboardItem', 'write', 'clipboard'])('preserves HTML when %s is unavailable', async (missing) => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        const write = jest.fn().mockResolvedValue(undefined);
        globalThis.ClipboardItem = jest.fn().mockImplementation((items) => items);
        const clipboard = { writeText, write };
        if (missing === 'ClipboardItem') delete globalThis.ClipboardItem;
        if (missing === 'write') delete clipboard.write;
        Object.defineProperty(globalThis, 'navigator', {
            value: missing === 'clipboard' ? {} : { clipboard },
            writable: true,
            configurable: true,
        });
        const data = new Map();
        document.execCommand = jest.fn().mockImplementation(() => {
            const event = new Event('copy', { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'clipboardData', {
                value: { setData: (type, value) => data.set(type, value) },
            });
            document.activeElement.dispatchEvent(event);
            return true;
        });

        const html = '<table><tr><td>Report</td></tr></table>';
        expect(await copyToClipboard(html, true)).toBe(true);
        expect(data.get('text/html')).toBe(html);
        expect(data.get('text/plain')).toBe(html);
        expect(writeText).not.toHaveBeenCalled();
        expect(write).not.toHaveBeenCalled();
    });

    test.each([false, true])('rejects plain-only HTML fallback (copy event: %s)', async (dispatchCopy) => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        delete globalThis.ClipboardItem;
        Object.defineProperty(globalThis, 'navigator', {
            value: { clipboard: { writeText } },
            writable: true,
            configurable: true,
        });
        document.execCommand = jest.fn().mockImplementation(() => {
            if (dispatchCopy) document.activeElement.dispatchEvent(new Event('copy', { bubbles: true }));
            return true;
        });

        expect(await copyToClipboard('<b>Report</b>', true)).toBe(false);
        expect(writeText).not.toHaveBeenCalled();
        expect(document.querySelector('textarea')).toBeNull();
    });

    test.each([true, false])('cleans up and restores focus when execCommand returns %s', async (successful) => {
        Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true, configurable: true });
        focusTarget = document.createElement('button');
        document.body.appendChild(focusTarget);
        focusTarget.focus();
        document.execCommand = jest.fn().mockImplementation(() => {
            expect(document.activeElement.tagName).toBe('TEXTAREA');
            expect(document.activeElement.value).toBe('Fallback Text');
            return successful;
        });

        expect(await copyToClipboard('Fallback Text')).toBe(successful);
        expect(document.querySelector('textarea')).toBeNull();
        expect(document.activeElement).toBe(focusTarget);
    });

    test('returns false if both navigator.clipboard and execCommand fail', async () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: {},
            writable: true,
            configurable: true,
        });

        document.execCommand = jest.fn().mockImplementation(() => {
            throw new Error('execCommand not supported');
        });

        const result = await copyToClipboard('Will Fail');

        expect(result).toBe(false);
        expect(document.querySelector('textarea')).toBeNull();
    });

    test.each([false, true])('restores focus and removes the listener after an exception (HTML: %s)', async (isHtml) => {
        Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true, configurable: true });
        focusTarget = document.createElement('button');
        document.body.appendChild(focusTarget);
        focusTarget.focus();
        document.execCommand = jest.fn().mockImplementation(() => {
            throw new Error('Copy failed');
        });

        expect(await copyToClipboard('<b>Report</b>', isHtml)).toBe(false);
        expect(document.querySelector('textarea')).toBeNull();
        expect(document.activeElement).toBe(focusTarget);

        const setData = jest.fn();
        const event = new Event('copy', { cancelable: true });
        Object.defineProperty(event, 'clipboardData', { value: { setData } });
        document.dispatchEvent(event);
        expect(setData).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    test('handles non-string arguments correctly', async () => {
        const writeTextMock = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                clipboard: {
                    writeText: writeTextMock,
                },
            },
            writable: true,
            configurable: true,
        });

        const result = await copyToClipboard(12345);

        expect(result).toBe(true);
        expect(writeTextMock).toHaveBeenCalledWith('12345');
    });
});
