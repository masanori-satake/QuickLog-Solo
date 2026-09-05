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
        expect(SnoringZzz.metadata.name.en).toBe('Snoring Zzz...');
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
        animation.nextSpawnInterval = Infinity;
        animation.draw(null, { elapsedMs: 2000 });
        const elementBeforeRewind = animation.elements[0];
        const rewindSprites = animation.draw(null, { elapsedMs: 100 });
        expect(Array.isArray(rewindSprites)).toBe(true);
        expect(animation.elements).not.toContain(elementBeforeRewind);
        expect(animation.lastElapsedMs).toBe(100);
    });

    test('moves elements the same distance at 30 FPS and 60 FPS', () => {
        const positionAfterOneSecond = (fps) => {
            const instance = new SnoringZzz();
            instance.setup(200, 150);
            instance.elements = [{
                x: 50,
                y: 100,
                side: 'left',
                minX: 5,
                maxX: 80,
                type: '.',
                speedY: 0.5,
                speedX: 0,
                swayAmplitude: 0,
                swayFrequency: 0,
                swayPhase: 0,
                scale: 1,
                rotation: 0,
                spawnTime: 0
            }];
            instance.nextSpawnInterval = Infinity;

            for (let frame = 0; frame <= fps; frame++) {
                instance.draw(null, { elapsedMs: frame * 1000 / fps });
            }

            return instance.elements[0].y;
        };

        expect(positionAfterOneSecond(30)).toBeCloseTo(positionAfterOneSecond(60));
        expect(positionAfterOneSecond(60)).toBeCloseTo(70);
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
