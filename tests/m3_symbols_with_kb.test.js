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
            translate: jest.fn(),
            rotate: jest.fn(),
            fillText: jest.fn(),
            strokeText: jest.fn(),
            measureText: jest.fn(() => ({
                width: 108,
                actualBoundingBoxLeft: 50,
                actualBoundingBoxRight: 58,
                actualBoundingBoxAscent: 70,
                actualBoundingBoxDescent: 16
            })),
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
        expect(Array.isArray(instance.symbols)).toBe(true);
        expect(instance.symbols.length).toBeGreaterThan(100);
        expect(instance.symbols).toContain('pause');
        expect(instance.symbols).toContain('spa');
        expect(instance.symbols).toContain('wifi');
        expect(instance.min_duration).toBe(6000);
        expect(instance.max_duration).toBe(8000);
        expect(instance.zoom_in_scale_start).toBe(1.0);
        expect(instance.zoom_in_scale_end).toBe(1.4);
        expect(instance.zoom_out_scale_start).toBe(2.0);
        expect(instance.zoom_out_scale_end).toBe(1.2);
        expect(instance.kb_easing).toBe('ease-in-out');
        expect(instance.max_tilt_deg).toBe(20);
        expect(instance.min_visibility_ratio).toBe(0.60);
    });

    test('should deterministically generate cycle properties for the same cycle index', () => {
        const propsCycle0 = instance._getCycleProperties(0);
        const propsCycle0Again = instance._getCycleProperties(0);
        expect(propsCycle0).toEqual(propsCycle0Again);

        expect(typeof propsCycle0.symbol).toBe('string');
        expect(instance.symbols).toContain(propsCycle0.symbol);
        expect(propsCycle0.duration).toBeGreaterThanOrEqual(6000);
        expect(propsCycle0.duration).toBeLessThanOrEqual(8000);
        expect(propsCycle0.sizeFactor).toBeGreaterThanOrEqual(0.85);
        expect(propsCycle0.sizeFactor).toBeLessThanOrEqual(1.25);
        expect(Math.abs(propsCycle0.tiltDeg)).toBeLessThanOrEqual(20);
        expect(['in', 'out']).toContain(propsCycle0.zoomDirection);
    });

    test('should distribute zoom-in and zoom-out directions approximately evenly', () => {
        let zoomInCount = 0;
        let zoomOutCount = 0;
        const total = 1000;

        for (let i = 0; i < total; i++) {
            const props = instance._getCycleProperties(i);
            if (props.zoomDirection === 'in') {
                zoomInCount++;
                expect(props.scaleStart).toBe(1.0);
                expect(props.scaleEnd).toBe(1.4);
            } else {
                zoomOutCount++;
                expect(props.scaleStart).toBe(2.0);
                expect(props.scaleEnd).toBe(1.2);
            }
        }

        expect(zoomInCount / total).toBeCloseTo(0.50, 1);
        expect(zoomOutCount / total).toBeCloseTo(0.50, 1);
    });

    test('should calculate deterministic cycle time info with variable durations', () => {
        const info0 = instance._getCycleTimeInfo(0);
        expect(info0.cycleIndex).toBe(0);
        expect(info0.cycleStartMs).toBe(0);
        expect(info0.cycleProgress).toBe(0);

        const props0 = instance._getCycleProperties(0);
        const info0End = instance._getCycleTimeInfo(props0.duration - 1);
        expect(info0End.cycleIndex).toBe(0);
        expect(info0End.cycleProgress).toBeGreaterThan(0.99);

        const info1Start = instance._getCycleTimeInfo(props0.duration);
        expect(info1Start.cycleIndex).toBe(1);
        expect(info1Start.cycleStartMs).toBe(props0.duration);
        expect(info1Start.cycleProgress).toBe(0);
    });

    test('should reuse cached cycle boundaries and preserve rewinding after seven days', () => {
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const originalGetCycleProperties = instance._getCycleProperties.bind(instance);
        instance._getCycleProperties = jest.fn(originalGetCycleProperties);

        const longElapsedInfo = instance._getCycleTimeInfo(sevenDaysMs);
        expect(longElapsedInfo.cycleIndex).toBeGreaterThan(80000);
        expect(longElapsedInfo.cycleStartMs).toBeLessThanOrEqual(sevenDaysMs);
        expect(longElapsedInfo.cycleStartMs + longElapsedInfo.duration).toBeGreaterThan(sevenDaysMs);
        expect(longElapsedInfo.cycleProgress).toBeGreaterThanOrEqual(0);
        expect(longElapsedInfo.cycleProgress).toBeLessThan(1);

        const callsAfterInitialLookup = instance._getCycleProperties.mock.calls.length;
        const rewoundInfo = instance._getCycleTimeInfo(sevenDaysMs - 24 * 60 * 60 * 1000);
        const repeatedInfo = instance._getCycleTimeInfo(sevenDaysMs);

        expect(rewoundInfo.cycleIndex).toBeLessThan(longElapsedInfo.cycleIndex);
        expect(repeatedInfo).toEqual(longElapsedInfo);
        expect(instance._getCycleProperties.mock.calls.length - callsAfterInitialLookup).toBeLessThan(10);
    });

    test('should apply smooth opacity curve starting from 0.0 to 1.0 back to 0.0', () => {
        instance.setup(300, 200);

        // At start of cycle (progress ~ 0), opacity is 0
        instance.draw(mockCtx, { elapsedMs: 0 });
        expect(mockCtx.globalAlpha).toBeCloseTo(0, 5);

        // At midpoint of cycle
        const props0 = instance._getCycleProperties(0);
        instance.draw(mockCtx, { elapsedMs: props0.duration / 2 });
        expect(mockCtx.globalAlpha).toBeCloseTo(1, 5);

        // At end of cycle
        instance.draw(mockCtx, { elapsedMs: props0.duration - 0.001 });
        expect(mockCtx.globalAlpha).toBeCloseTo(0, 2);
    });

    test('should generate tilt angles within +-20 degrees across cycles', () => {
        for (let i = 0; i < 100; i++) {
            const props = instance._getCycleProperties(i);
            expect(props.tiltDeg).toBeGreaterThanOrEqual(-20);
            expect(props.tiltDeg).toBeLessThanOrEqual(20);
            expect(Math.abs(props.tiltRad)).toBeLessThanOrEqual((20 * Math.PI) / 180 + 0.001);
        }
    });

    test('should select symbols from the full symbols array across cycles', () => {
        const selectedSymbols = new Set();
        const totalCycles = 1000;

        for (let i = 0; i < totalCycles; i++) {
            const props = instance._getCycleProperties(i);
            expect(instance.symbols).toContain(props.symbol);
            selectedSymbols.add(props.symbol);
        }

        // Verify a wide variety of distinct symbols are picked
        expect(selectedSymbols.size).toBeGreaterThan(50);
    });

    test('should render canvas drawing with translate and rotate without error across frame steps', () => {
        instance.setup(300, 200);

        // Draw multiple frames across cycle transitions
        const timeSteps = [0, 500, 1250, 2400, 2500, 3750, 5000];

        timeSteps.forEach(elapsedMs => {
            expect(() => {
                instance.draw(mockCtx, { elapsedMs });
            }).not.toThrow();
        });

        expect(mockCtx.translate).toHaveBeenCalled();
        expect(mockCtx.rotate).toHaveBeenCalled();
        expect(mockCtx.fillText).toHaveBeenCalled();
        expect(mockCtx.strokeText).toHaveBeenCalled();
    });

    test.each([
        [-20, 0, 0],
        [-20, 0, 1],
        [-20, 1, 0],
        [-20, 1, 1],
        [20, 0, 0],
        [20, 0, 1],
        [20, 1, 0],
        [20, 1, 1],
    ])('should keep at least the minimum visible area at maximum tilt (%i deg, %i, %i)', (tiltDeg, rPosX, rPosY) => {
        const width = 300;
        const height = 200;
        const tiltRad = (tiltDeg * Math.PI) / 180;
        const textBounds = { left: 50, right: 58, ascent: 70, descent: 16 };
        instance.setup(width, height);
        instance._getCycleProperties = jest.fn(() => ({
            duration: 7000,
            symbol: 'pause',
            sizeFactor: 1,
            tiltRad,
            tiltDeg,
            rPosX,
            rPosY,
            zoomDirection: 'in',
            scaleStart: 1.0,
            scaleEnd: 1.4,
        }));

        instance.draw(mockCtx, { elapsedMs: 0 });

        const [cx, cy] = mockCtx.translate.mock.calls[0];
        const strokeRadius = mockCtx.lineWidth / 2;
        const corners = [
            [-textBounds.left - strokeRadius, -textBounds.ascent - strokeRadius],
            [textBounds.right + strokeRadius, -textBounds.ascent - strokeRadius],
            [textBounds.right + strokeRadius, textBounds.descent + strokeRadius],
            [-textBounds.left - strokeRadius, textBounds.descent + strokeRadius],
        ].map(([x, y]) => [
            cx + x * Math.cos(tiltRad) - y * Math.sin(tiltRad),
            cy + x * Math.sin(tiltRad) + y * Math.cos(tiltRad),
        ]);

        const xs = corners.map(([x]) => x);
        const ys = corners.map(([, y]) => y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const visibleWidth = Math.max(0, Math.min(width, maxX) - Math.max(0, minX));
        const visibleHeight = Math.max(0, Math.min(height, maxY) - Math.max(0, minY));
        const visibleAreaRatio = (visibleWidth * visibleHeight) / ((maxX - minX) * (maxY - minY));

        expect(visibleAreaRatio).toBeGreaterThanOrEqual(instance.min_visibility_ratio - Number.EPSILON);
    });

    test('should handle edge cases like zero width/height safely', () => {
        instance.setup(0, 0);
        expect(() => {
            instance.draw(mockCtx, { elapsedMs: 1000 });
        }).not.toThrow();
    });
});
