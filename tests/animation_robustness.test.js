import { animations } from '../shared/js/animation_registry.js';

/**
 * Robustness Test for Animation Modules
 * Ensures that all animations can handle draw() calls without prior setup().
 * This prevents crashes during race conditions (e.g., startup with zero dimensions).
 */
describe('Animation Module Robustness', () => {
    animations.forEach((anim) => {
        test(`Animation "${anim.id}" should not crash if draw() is called before setup()`, () => {
            const instance = new anim.class();

            // Dummy parameters similar to what AnimationEngine/Worker would pass
            const params = {
                elapsedMs: 1000,
                progress: 0.5,
                step: 120,
                exclusionAreas: [],
                speed: 1.0
            };

            // Mock context for canvas mode animations
            const mockCtx = {
                rect: () => {},
                save: () => {},
                restore: () => {},
                translate: () => {},
                scale: () => {},
                rotate: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                clearRect: () => {},
                fillRect: () => {},
                strokeRect: () => {},
                closePath: () => {},
                clip: () => {},
                drawImage: () => {},
                getImageData: () => ({ data: new Uint8ClampedArray(100) }),
                setLineDash: () => {},
                fillText: () => {},
                measureText: () => ({ width: 10 }),
                createLinearGradient: () => ({ addColorStop: () => {} }),
                globalAlpha: 1.0,
                fillStyle: '#000',
                strokeStyle: '#000',
                lineWidth: 1,
                lineCap: 'butt',
                lineJoin: 'miter',
                font: '10px sans-serif'
            };

            // Should not throw
            expect(() => {
                instance.draw(mockCtx, params);
            }).not.toThrow();
        });
    });
});
