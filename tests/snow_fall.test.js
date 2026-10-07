import SnowFall from '../shared/js/animation/snow_fall.js';

describe('SnowFall Animation Module', () => {
    let anim;

    beforeEach(() => {
        anim = new SnowFall();
    });

    test('metadata contains required fields for 8 supported languages', () => {
        expect(SnowFall.metadata).toBeDefined();
        expect(SnowFall.metadata.specVersion).toBe('1.0');
        expect(SnowFall.metadata.author).toBe('QuickLog-Solo');
        expect(SnowFall.metadata.rewindable).toBe(true);

        const locales = ['en', 'ja', 'de', 'es', 'fr', 'pt', 'ko', 'zh'];
        locales.forEach(loc => {
            expect(SnowFall.metadata.name[loc]).toBeDefined();
            expect(typeof SnowFall.metadata.name[loc]).toBe('string');
            expect(SnowFall.metadata.description[loc]).toBeDefined();
            expect(typeof SnowFall.metadata.description[loc]).toBe('string');
        });
    });

    test('config specifies sprite mode and jump exclusion strategy', () => {
        expect(anim.config).toEqual({
            mode: 'sprite',
            exclusionStrategy: 'jump'
        });
    });

    test('setup initializes background flakes and foreground crystals', () => {
        anim.setup(300, 150);
        expect(anim.width).toBe(300);
        expect(anim.height).toBe(150);

        expect(anim.backgroundFlakes.length).toBeGreaterThan(0);
        expect(anim.foregroundCrystals.length).toBeGreaterThan(0);

        // Verify crystal pattern index is valid
        anim.foregroundCrystals.forEach(crystal => {
            expect(crystal.patternIndex).toBeGreaterThanOrEqual(0);
            expect(crystal.patternIndex).toBeLessThan(SnowFall.CRYSTAL_PATTERNS.length);
            expect(crystal.speedY).toBeGreaterThan(0);
        });
    });

    test('draw returns array of sprite dots with x, y, and size properties', () => {
        anim.setup(300, 150);
        const sprites = anim.draw(null, { elapsedMs: 1000 });

        expect(Array.isArray(sprites)).toBe(true);
        expect(sprites.length).toBeGreaterThan(0);

        sprites.forEach(sprite => {
            expect(typeof sprite.x).toBe('number');
            expect(typeof sprite.y).toBe('number');
            expect([1, 2]).toContain(sprite.size);
        });
    });

    test('preserves fall distance over the same elapsed time when frames are skipped', () => {
        anim.setup(300, 150);
        [...anim.backgroundFlakes, ...anim.foregroundCrystals].forEach(particle => {
            particle.y = 0;
        });
        const skippedFrames = new SnowFall();
        skippedFrames.setup(300, 150);
        skippedFrames.backgroundFlakes = anim.backgroundFlakes.map(flake => ({ ...flake }));
        skippedFrames.foregroundCrystals = anim.foregroundCrystals.map(crystal => ({ ...crystal }));

        for (let frame = 0; frame <= 60; frame++) {
            anim.draw(null, { elapsedMs: frame * (1000 / 60) });
        }
        skippedFrames.draw(null, { elapsedMs: 1000 });

        for (const layer of ['backgroundFlakes', 'foregroundCrystals']) {
            anim[layer].forEach((particle, index) => {
                expect(particle.y).toBeCloseTo(particle.speedY * 60);
                expect(skippedFrames[layer][index].y).toBeCloseTo(particle.y);
            });
        }
    });

    test('does not fall when elapsed time is unchanged', () => {
        anim.setup(300, 150);
        anim.draw(null, { elapsedMs: 100 });
        const particles = [...anim.backgroundFlakes, ...anim.foregroundCrystals];
        const positions = particles.map(particle => particle.y);

        anim.draw(null, { elapsedMs: 100 });

        expect(particles.map(particle => particle.y)).toEqual(positions);
    });

    test('handles time rewinding / reset cleanly', () => {
        anim.setup(300, 150);
        anim.draw(null, { elapsedMs: 5000 });

        // Jump backwards in time
        const spritesRewound = anim.draw(null, { elapsedMs: 1000 });
        expect(Array.isArray(spritesRewound)).toBe(true);
        expect(spritesRewound.length).toBeGreaterThan(0);
    });

    test('handles zero or negative width/height gracefully', () => {
        anim.setup(0, 0);
        const sprites = anim.draw(null, { elapsedMs: 1000 });
        expect(sprites).toEqual([]);
    });

    test('contains multiple crystal pattern definitions', () => {
        expect(SnowFall.CRYSTAL_PATTERNS.length).toBeGreaterThanOrEqual(3);
        SnowFall.CRYSTAL_PATTERNS.forEach(pattern => {
            expect(Array.isArray(pattern)).toBe(true);
            expect(pattern.length).toBeGreaterThan(0);
            expect(Array.isArray(pattern[0])).toBe(true);
        });
    });
});
