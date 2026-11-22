import { jest } from '@jest/globals';
import ChristmasTrees from '../shared/js/animation/christmas_trees.js';

describe('ChristmasTrees Animation Module', () => {
    let animation;
    let mockCtx;

    beforeEach(() => {
        animation = new ChristmasTrees();
        mockCtx = {
            save: jest.fn(),
            restore: jest.fn(),
            translate: jest.fn(),
            scale: jest.fn(),
            rotate: jest.fn(),
            beginPath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            quadraticCurveTo: jest.fn(),
            closePath: jest.fn(),
            ellipse: jest.fn(),
            rect: jest.fn(),
            stroke: jest.fn(),
            fill: jest.fn(),
            fillStyle: '#ffffff',
            strokeStyle: '#ffffff',
            lineWidth: 1,
            lineCap: 'butt',
            lineJoin: 'miter',
            globalAlpha: 1
        };
    });

    test('metadata is properly configured', () => {
        expect(ChristmasTrees.metadata).toBeDefined();
        expect(ChristmasTrees.metadata.name.ja).toBe('クリスマスツリー');
        expect(ChristmasTrees.metadata.name.en).toBe('Christmas Trees');
        expect(ChristmasTrees.metadata.rewindable).toBe(true);
    });

    test('setup initializes dimensions', () => {
        animation.setup(320, 80);
        expect(animation.width).toBe(320);
        expect(animation.height).toBe(80);
    });

    test('draw renders two trees, stars and ground without errors', () => {
        animation.setup(320, 80);
        expect(() => animation.draw(mockCtx, { elapsedMs: 5000 })).not.toThrow();
        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.fill).toHaveBeenCalled();
        // One trunk rect per tree
        expect(mockCtx.rect).toHaveBeenCalledTimes(2);
        // Ornaments and ground dots are drawn as ellipses
        expect(mockCtx.ellipse).toHaveBeenCalled();
    });

    test('draw handles zero or negative dimensions gracefully', () => {
        animation.setup(0, 0);
        expect(() => animation.draw(mockCtx, { elapsedMs: 1000 })).not.toThrow();
        expect(mockCtx.beginPath).not.toHaveBeenCalled();
    });
});
