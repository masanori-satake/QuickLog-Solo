import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import M3SymbolsWithKB from '../shared/js/animation/m3_symbols_with_kb.js';

describe('M3SymbolsWithKB Animation Module', () => {
    let instance;
    let mockCtx;

    beforeEach(() => {
        instance = new M3SymbolsWithKB();
        mockCtx = {
            save: jest.fn(),
            restore: jest.fn(),
            fillText: jest.fn(),
            strokeText: jest.fn(),
            globalAlpha: 1.0,
            fillStyle: '#000000',
            strokeStyle: '#000000',
            lineWidth: 1,
            font: '10px sans-serif',
            textAlign: 'left',
            textBaseline: 'top'
        };
    });

    test('should have valid metadata and configuration', () => {
        const metadata = M3SymbolsWithKB.metadata;
        expect(metadata.specVersion).toBe('2.0');
        expect(metadata.author).toBe('QuickLog-Solo');
        expect(metadata.rewindable).toBe(true);

        const locales = ['en', 'ja', 'de', 'es', 'fr', 'pt', 'ko', 'zh'];
        locales.forEach(lang => {
            expect(metadata.name[lang]).toBeDefined();
            expect(typeof metadata.name[lang]).toBe('string');
            expect(metadata.description[lang]).toBeDefined();
            expect(typeof metadata.description[lang]).toBe('string');
        });

        expect(instance.config.mode).toBe('canvas');
        expect(instance.config.exclusionStrategy).toBe('mask');
    });

    test('should initialize default parameter settings', () => {
        expect(instance.symbol_category_weights).toEqual({
            pause: 0.60,
            relax: 0.20,
            abstract: 0.15,
            random: 0.05
        });
        expect(instance.kb_scale_start).toBe(1.0);
        expect(instance.kb_scale_end).toBe(1.4);
        expect(instance.kb_duration).toBe(2500);
        expect(instance.kb_easing).toBe('ease-in-out');
    });

    test('should deterministically pick symbols for the same cycle index', () => {
        const symbolCycle0 = instance._getSymbolForCycle(0);
        const symbolCycle0Again = instance._getSymbolForCycle(0);
        expect(symbolCycle0).toBe(symbolCycle0Again);

        const symbolCycle1 = instance._getSymbolForCycle(1);
        const symbolCycle2 = instance._getSymbolForCycle(2);

        expect(typeof symbolCycle0).toBe('string');
        expect(typeof symbolCycle1).toBe('string');
        expect(typeof symbolCycle2).toBe('string');
    });

    test('should conform to category target weights across sample cycles', () => {
        const counts = { pause: 0, relax: 0, abstract: 0, random: 0 };
        const totalCycles = 10000;

        const allSymbols = instance.categories;

        for (let i = 0; i < totalCycles; i++) {
            const sym = instance._getSymbolForCycle(i);
            if (allSymbols.pause.includes(sym)) counts.pause++;
            else if (allSymbols.relax.includes(sym)) counts.relax++;
            else if (allSymbols.abstract.includes(sym)) counts.abstract++;
            else if (allSymbols.random.includes(sym)) counts.random++;
        }

        // Check that frequencies approximate expected weights (within +/- 3% tolerance)
        expect(counts.pause / totalCycles).toBeCloseTo(0.60, 1);
        expect(counts.relax / totalCycles).toBeCloseTo(0.20, 1);
        expect(counts.abstract / totalCycles).toBeCloseTo(0.15, 1);
        expect(counts.random / totalCycles).toBeCloseTo(0.05, 1);
    });

    test('should render canvas drawing without error across frame steps', () => {
        instance.setup(300, 200);

        // Draw multiple frames across cycle transitions
        const timeSteps = [0, 500, 1250, 2400, 2500, 3750, 5000];

        timeSteps.forEach(elapsedMs => {
            expect(() => {
                instance.draw(mockCtx, { elapsedMs });
            }).not.toThrow();
        });

        expect(mockCtx.fillText).toHaveBeenCalled();
        expect(mockCtx.strokeText).toHaveBeenCalled();
    });

    test('should handle edge cases like zero width/height safely', () => {
        instance.setup(0, 0);
        expect(() => {
            instance.draw(mockCtx, { elapsedMs: 1000 });
        }).not.toThrow();
    });
});
