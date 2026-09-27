import { jest } from '@jest/globals';
import {
    generateQRCodeMatrix,
    renderQRCodeToCanvas,
} from '../shared/js/qr_code.js';

describe('QR Code Generator & Renderer for PWA Launch URL', () => {
    test('should generate QR code boolean matrix for input string', () => {
        const text = 'https://masanori-satake.github.io/QuickLog-Solo/projects/pwa/';
        const matrix = generateQRCodeMatrix(text);

        expect(Array.isArray(matrix)).toBe(true);
        expect(matrix.length).toBeGreaterThan(20);
        expect(matrix[0].length).toEqual(matrix.length);

        // Finder pattern check at top-left
        expect(matrix[0][0]).toBe(true);
        expect(matrix[0][6]).toBe(true);
        expect(matrix[6][0]).toBe(true);
        expect(matrix[6][6]).toBe(true);
        expect(matrix[1][1]).toBe(false);
    });

    test('should render QR Code onto HTML canvas', () => {
        const fillRectMock = jest.fn();
        const canvas = {
            width: 200,
            height: 200,
            getContext: jest.fn().mockReturnValue({
                fillRect: fillRectMock,
                fillStyle: '#000000',
            }),
        };

        renderQRCodeToCanvas('Test Payload', canvas, { width: 200 });

        expect(canvas.getContext).toHaveBeenCalledWith('2d');
        expect(fillRectMock).toHaveBeenCalled();
        expect(canvas.width).toBe(200);
        expect(canvas.height).toBe(200);
    });

    test('should throw error when payload exceeds version 40 QR capacity limit', () => {
        const hugePayload = 'X'.repeat(3000);
        expect(() => generateQRCodeMatrix(hugePayload)).toThrow('Payload too large for QR Code');
    });
});
