import { jest } from '@jest/globals';
import ChristmasSleigh from '../shared/js/animation/christmas_sleigh.js';

describe('ChristmasSleigh Animation Module', () => {
    let animation;
    let mockCtx;

    beforeEach(() => {
        animation = new ChristmasSleigh();
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
        expect(ChristmasSleigh.metadata).toBeDefined();
        expect(ChristmasSleigh.metadata.name.ja).toBe('サンタのそり');
        expect(ChristmasSleigh.metadata.name.en).toBe("Santa's Sleigh");
        expect(ChristmasSleigh.metadata.rewindable).toBe(true);
    });

    test('setup initializes dimensions', () => {
        animation.setup(320, 80);
        expect(animation.width).toBe(320);
        expect(animation.height).toBe(80);
    });

    test('sleigh travels from off-screen left to off-screen right over one cycle', () => {
        animation.setup(320, 80);
        const startX = animation.sleighXAt(0, 1);
        const midX = animation.sleighXAt(60000, 1);
        const endX = animation.sleighXAt(119999, 1);

        expect(startX).toBeLessThan(0);
        expect(midX).toBeGreaterThan(0);
        expect(midX).toBeLessThan(320);
        expect(endX).toBeGreaterThan(320);
    });

    test('draw renders stars, trail and the sleigh without errors', () => {
        animation.setup(320, 80);
        expect(() => animation.draw(mockCtx, { elapsedMs: 60000 })).not.toThrow();
        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.fill).toHaveBeenCalled();
        expect(mockCtx.ellipse).toHaveBeenCalled();
    });

    test('draw is deterministic for the same elapsedMs (rewindable)', () => {
        animation.setup(320, 80);
        expect(animation.sleighXAt(30000, 1)).toBe(animation.sleighXAt(30000, 1));
        expect(animation.sleighYAt(30000, 1)).toBe(animation.sleighYAt(30000, 1));
    });

    test('draw handles zero or negative dimensions gracefully', () => {
        animation.setup(0, 0);
        expect(() => animation.draw(mockCtx, { elapsedMs: 1000 })).not.toThrow();
        expect(mockCtx.beginPath).not.toHaveBeenCalled();
    });
});
