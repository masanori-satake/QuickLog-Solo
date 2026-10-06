import { jest } from '@jest/globals';
import HalloweenJack from '../shared/js/animation/halloween_jack.js';

describe('HalloweenJack Animation Module', () => {
    let animation;
    let mockCtx;

    beforeEach(() => {
        animation = new HalloweenJack();
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
            stroke: jest.fn(),
            fill: jest.fn(),
            fillStyle: '#ffffff',
            strokeStyle: '#ffffff',
            lineWidth: 1,
            globalAlpha: 1
        };
    });

    test('metadata is properly configured', () => {
        expect(HalloweenJack.metadata).toBeDefined();
        expect(HalloweenJack.metadata.name.ja).toBe('ハロウィン');
        expect(HalloweenJack.metadata.name.en).toBe('Halloween');
        expect(HalloweenJack.metadata.rewindable).toBe(true);
    });

    test('setup initializes dimensions and bats', () => {
        animation.setup(200, 100);
        expect(animation.width).toBe(200);
        expect(animation.height).toBe(100);
        expect(animation.bats.length).toBe(3);
    });

    test('draw renders pumpkin and bats without errors', () => {
        animation.setup(200, 100);
        expect(() => animation.draw(mockCtx, { elapsedMs: 1000 })).not.toThrow();
        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.ellipse).toHaveBeenCalled();
    });

    test('draw handles zero or negative dimensions gracefully', () => {
        animation.setup(0, 0);
        expect(() => animation.draw(mockCtx, { elapsedMs: 1000 })).not.toThrow();
        expect(mockCtx.beginPath).not.toHaveBeenCalled();
    });
});
