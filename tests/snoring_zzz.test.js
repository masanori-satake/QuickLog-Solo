import SnoringZzz from '../shared/js/animation/snoring_zzz.js';

describe('SnoringZzz Animation Module', () => {
    let animation;

    beforeEach(() => {
        animation = new SnoringZzz();
    });

    test('has valid static metadata with expected name', () => {
        expect(SnoringZzz.metadata).toBeDefined();
        expect(SnoringZzz.metadata.name).toBeDefined();
        expect(SnoringZzz.metadata.name.ja).toBe('Zzz...');
        expect(SnoringZzz.metadata.name.en).toBe('Zzz...');
    });

    test('config specifies mode sprite and exclusionStrategy jump', () => {
        expect(animation.config).toEqual({
            mode: 'sprite',
            exclusionStrategy: 'jump'
        });
    });

    test('setup initializes canvas dimensions and spawns initial elements', () => {
        animation.setup(200, 100);
        expect(animation.width).toBe(200);
        expect(animation.height).toBe(100);
        expect(animation.elements.length).toBeGreaterThan(0);
    });

    test('draw returns sprite list without throwing', () => {
        animation.setup(200, 100);
        const sprites = animation.draw(null, { elapsedMs: 500 });
        expect(Array.isArray(sprites)).toBe(true);
        expect(sprites.length).toBeGreaterThan(0);

        sprites.forEach(sprite => {
            expect(sprite).toHaveProperty('x');
            expect(sprite).toHaveProperty('y');
            expect(sprite).toHaveProperty('size');
            expect(typeof sprite.x).toBe('number');
            expect(typeof sprite.y).toBe('number');
            expect(typeof sprite.size).toBe('number');
        });
    });

    test('handles time rewinding gracefully', () => {
        animation.setup(200, 100);
        animation.draw(null, { elapsedMs: 2000 });
        const rewindSprites = animation.draw(null, { elapsedMs: 100 });
        expect(Array.isArray(rewindSprites)).toBe(true);
    });

    test('elements stay within left/right regions to clear middle text area', () => {
        animation.setup(300, 100);

        // Advance frames
        for (let t = 0; t <= 5000; t += 500) {
            animation.draw(null, { elapsedMs: t });
        }

        animation.elements.forEach(elem => {
            if (elem.side === 'left') {
                expect(elem.x).toBeLessThan(150);
            } else if (elem.side === 'right') {
                expect(elem.x).toBeGreaterThan(150);
            }
        });
    });
});
