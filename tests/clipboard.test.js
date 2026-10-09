import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { copyToClipboard } from '../projects/app/js/app.js';

describe('copyToClipboard', () => {
    let originalNavigator;
    let originalExecCommand;

    beforeEach(() => {
        originalNavigator = globalThis.navigator;
        originalExecCommand = document.execCommand;
    });

    afterEach(() => {
        Object.defineProperty(globalThis, 'navigator', {
            value: originalNavigator,
            writable: true,
            configurable: true,
        });
        document.execCommand = originalExecCommand;
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
        delete globalThis.ClipboardItem;
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

        document.execCommand = jest.fn().mockReturnValue(true);

        const htmlContent = '<table><tr><td>Test</td></tr></table>';
        const result = await copyToClipboard(htmlContent, true);

        expect(result).toBe(true);
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        delete globalThis.ClipboardItem;
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
