import { jest } from '@jest/globals';

let findRange;

describe('findRange security and robustness', () => {
    beforeAll(async () => {
        // Mock HTMLCanvasElement getContext
        HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
            fillRect: jest.fn(),
            clearRect: jest.fn(),
            getImageData: jest.fn().mockReturnValue({ data: [] }),
            putImageData: jest.fn(),
            createImageData: jest.fn(),
            setTransform: jest.fn(),
            drawImage: jest.fn(),
            save: jest.fn(),
            fillText: jest.fn(),
            restore: jest.fn(),
            beginPath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            closePath: jest.fn(),
            stroke: jest.fn(),
            translate: jest.fn(),
            scale: jest.fn(),
            rotate: jest.fn(),
            arc: jest.fn(),
            fill: jest.fn(),
            measureText: jest.fn().mockReturnValue({ width: 0 }),
            transform: jest.fn(),
            rect: jest.fn(),
            clip: jest.fn(),
        });

        // Mock matchMedia for JSDOM
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn().mockImplementation((query) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: jest.fn(),
                removeListener: jest.fn(),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            })),
        });

        // Setup minimal DOM elements required by studio.js top-level DOM initializations
        document.body.innerHTML = `
            <select id="sample-select"></select>
            <select id="lang-select-studio"></select>
            <input type="checkbox" id="theme-toggle" />
            <select id="meta-lang-select"></select>
            <button id="stop-btn"></button>
            <button id="rewind-btn"></button>
            <button id="play-btn"></button>
            <button id="ff-btn"></button>
            <button id="pause-btn"></button>
            <button id="eject-btn"></button>
            <div id="tape-counter"></div>
            <button id="download-btn"></button>
            <button id="upload-btn"></button>
            <input id="studio-upload-input" />
            <button id="pr-btn"></button>
            <div id="pr-modal"></div>
            <div class="editor-body">
                <div class="editor-gutter"></div>
                <textarea id="input-vars"></textarea>
                <div class="editor-highlight"></div>
            </div>
            <div class="editor-body">
                <div class="editor-gutter"></div>
                <textarea id="input-setup"></textarea>
                <div class="editor-highlight"></div>
            </div>
            <div class="editor-body">
                <div class="editor-gutter"></div>
                <textarea id="input-draw"></textarea>
                <div class="editor-highlight"></div>
            </div>
            <div class="editor-body">
                <div class="editor-gutter"></div>
                <textarea id="input-interaction"></textarea>
                <div class="editor-highlight"></div>
            </div>
            <input id="meta-name" />
            <input id="meta-author" />
            <input id="meta-desc" />
            <select id="config-mode"></select>
            <select id="config-exclusion-strategy"></select>
            <input type="checkbox" id="config-rewindable" />
            <canvas id="animation-canvas"></canvas>
            <div id="exclusion-simulator"></div>
            <div id="metrics-panel"></div>
            <input type="checkbox" id="show-metrics" />
            <input type="checkbox" id="show-exclusion" />
            <label id="show-canvas-label"></label>
            <input type="checkbox" id="show-canvas" />
            <button id="shrink-preview"></button>
            <button id="expand-preview"></button>
            <div id="preview-container"></div>
            <div id="raw-canvas-container"></div>
            <canvas id="raw-canvas"></canvas>
            <div id="preview-color-presets"></div>
            <input id="preview-speed" />
            <span id="speed-value"></span>
            <span id="metric-latency"></span>
            <span id="metric-density"></span>
            <span id="metric-change"></span>
            <span id="metric-status"></span>
            <div id="meter-latency"><div class="meter-needle"></div></div>
            <div id="meter-density"><div class="meter-needle"></div></div>
            <div id="meter-change"><div class="meter-needle"></div></div>
            <button id="toggle-wrap"></button>
            <button id="show-search"></button>
            <div id="search-bar"></div>
            <input id="search-input" />
            <input id="replace-input" />
            <button id="btn-replace"></button>
            <button id="btn-replace-all"></button>
            <button id="close-search"></button>
            <div id="console-section"><div class="console-header"></div></div>
            <div id="console-output"></div>
            <button id="clear-console"></button>
            <button id="toggle-console"></button>
            <a class="back-link"></a>
            <div id="toast"></div>
        `;

        const studio = await import('../projects/studio/js/studio.js');
        findRange = studio.findRange;
    });

    test('handles normal method name pattern', () => {
        const code = `
class TestAnim {
    setup(width, height) {
        this.width = width;
    }
}
        `;
        const result = findRange(code, 'setup');
        expect(result).not.toBeNull();
        expect(code.substring(result.start, result.end)).toContain('setup(width, height)');
    });

    test('handles special characters in namePattern without throwing SyntaxError or hanging', () => {
        const code = `
class TestAnim {
    setup(width, height) {}
}
        `;
        const specialPatterns = [
            'setup[test]',
            'setup(arg)',
            'setup*',
            'setup+pattern',
            'setup-method',
            'setup?val',
            'setup|other',
            'setup{1}',
            'setup^first',
            'setup$end',
        ];

        specialPatterns.forEach((pattern) => {
            expect(() => {
                const res = findRange(code, pattern);
                expect(res).toBeNull();
            }).not.toThrow();
        });
    });

    test('returns null for non-string pattern inputs', () => {
        expect(findRange('setup() {}', null)).toBeNull();
        expect(findRange('setup() {}', undefined)).toBeNull();
        expect(findRange('setup() {}', 123)).toBeNull();
    });
});
