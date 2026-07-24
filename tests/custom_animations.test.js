import { jest } from '@jest/globals';

// Setup mock chrome storage APIs
global.chrome = {
    storage: {
        sync: {
            set: jest.fn().mockImplementation(() => Promise.resolve()),
            remove: jest.fn().mockImplementation(() => Promise.resolve()),
            get: jest.fn().mockImplementation(() => Promise.resolve({}))
        },
        local: {
            set: jest.fn().mockImplementation(() => Promise.resolve()),
            remove: jest.fn().mockImplementation(() => Promise.resolve()),
            get: jest.fn().mockImplementation(() => Promise.resolve({}))
        }
    }
};

describe('Custom Animation Package Logic & Tiering Storage API tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Should validate correctness of standard test qlanim packages', () => {
        const jsModulePackage = {
            format: "quicklog-animation-package",
            formatVersion: "1.0",
            id: "test_studio_sample",
            type: "js-module",
            metadata: {
                specVersion: "1.0",
                name: { en: "Moving Circle", ja: "動く円" },
                description: { en: "A simple moving circle on canvas", ja: "キャンバス上を動くシンプルな円" },
                author: "Test Author",
                rewindable: true
            },
            config: {
                mode: "canvas",
                exclusionStrategy: "mask"
            },
            payload: {
                code: "export default class CustomAnimation {}"
            }
        };

        const gifSpritePackage = {
            format: "quicklog-animation-package",
            formatVersion: "1.0",
            id: "test_maker_sample",
            type: "gif-sprite",
            metadata: {
                specVersion: "1.0",
                name: { en: "Test Sprite", ja: "テストスプライト" },
                description: { en: "A dummy sprite for testing", ja: "検証用のダミースプライト" },
                author: "Test Author",
                rewindable: true
            },
            config: {
                mode: "sprite",
                exclusionStrategy: "mask"
            },
            payload: {
                imageData: "data:image/png;base64,abc",
                renderSpec: {
                    frameWidth: 8,
                    frameHeight: 8,
                    frameCount: 1,
                    fps: 10,
                    zoom: 1
                }
            }
        };

        const validateQlanim = (data) => {
            if (!data || typeof data !== 'object') return false;
            if (data.format !== 'quicklog-animation-package') return false;
            if (typeof data.id !== 'string' || !data.id) return false;
            if (data.type !== 'js-module' && data.type !== 'gif-sprite') return false;
            if (!data.metadata || typeof data.metadata !== 'object') return false;
            if (!data.config || typeof data.config !== 'object') return false;
            if (!data.payload || typeof data.payload !== 'object') return false;

            if (data.type === 'js-module') {
                if (typeof data.payload.code !== 'string' || !data.payload.code) return false;
            } else if (data.type === 'gif-sprite') {
                if (typeof data.payload.imageData !== 'string' || !data.payload.imageData) return false;
                if (!data.payload.renderSpec || typeof data.payload.renderSpec !== 'object') return false;
            }
            return true;
        };

        expect(validateQlanim(jsModulePackage)).toBe(true);
        expect(validateQlanim(gifSpritePackage)).toBe(true);
        expect(validateQlanim({ format: 'wrong' })).toBe(false);
    });

    test('Should simulate tiered storage save correctly for js-module custom animations', async () => {
        const id = "test_studio_sample";
        const type = "js-module";
        const metadata = { name: "Test" };
        const config = { mode: "canvas" };
        const code = "export default class CustomAnimation {}";

        // Save active ID in storage sync
        await chrome.storage.sync.set({ activeAnimationId: id });
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({ activeAnimationId: id });

        // Save metadata & code in storage local
        const custom_animation_metadata = { id, type, metadata, config };
        await chrome.storage.local.set({
            custom_animation_metadata,
            [`custom_animation_code_${id}`]: code
        });

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            custom_animation_metadata,
            [`custom_animation_code_${id}`]: code
        });
    });
});
