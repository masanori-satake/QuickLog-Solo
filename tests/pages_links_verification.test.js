import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GitHub Pages Links & Asset Verification', () => {
    const rootDir = path.resolve(__dirname, '..');

    test('All HTML relative resource paths (css, js, img, favicon, links) exist on disk', () => {
        const htmlFiles = [
            'index.html',
            'projects/web/index.html',
            'projects/web/guide.html',
            'projects/web/transparency.html',
            'projects/web/policy.html',
            'projects/category-editor/index.html',
            'projects/alarm-editor/index.html',
            'projects/animation-maker/index.html',
            'projects/studio/index.html',
            'projects/pwa/index.html',
            'projects/app/app.html',
        ];

        htmlFiles.forEach((relHtml) => {
            const htmlPath = path.join(rootDir, relHtml);
            expect(fs.existsSync(htmlPath)).toBe(true);

            const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
            const htmlDir = path.dirname(htmlPath);

            // Extract src and href attributes (ignoring http(s):, data:, chrome://, edge://, #)
            const attrRegex = /(?:src|href)=["']([^"']+)["']/g;
            let match;

            while ((match = attrRegex.exec(htmlContent)) !== null) {
                const url = match[1];

                // Ignore non-relative scheme URLs (http:, https:, data:, chrome:, edge:, javascript:, vbscript:, etc.), fragments, and about:blank
                if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || url.startsWith('#') || url === 'about:blank') {
                    continue;
                }

                // Strip query parameters and hash
                const cleanUrl = url.split('?')[0].split('#')[0];
                if (!cleanUrl) continue;

                const targetPath = path.resolve(htmlDir, cleanUrl);
                expect({ file: relHtml, asset: url, targetPath }).toEqual({
                    file: relHtml,
                    asset: url,
                    targetPath: expect.stringMatching(/./),
                });
                expect(fs.existsSync(targetPath)).toBe(true);
            }
        });
    });

    test('Expected GitHub Pages URLs remain and no vercel.app URLs remain', () => {
        const pagesBase = 'https://masanori-satake.github.io/QuickLog-Solo/';
        const expectedPathsByFile = {
            'README.md': {
                'projects/category-editor/': 2,
                'projects/alarm-editor/': 2,
                'projects/animation-maker/': 2,
                'projects/studio/': 2,
            },
            'projects/app/js/app.js': {
                'projects/category-editor/': 1,
                'projects/alarm-editor/': 1,
                'projects/': 2,
            },
            'projects/web/index.html': {
                'projects/category-editor': 1,
            },
            'docs/animation_module_spec.md': {
                'projects/studio/': 1,
            },
        };

        Object.entries(expectedPathsByFile).forEach(([relFile, expectedPaths]) => {
            const filePath = path.join(rootDir, relFile);
            expect(fs.existsSync(filePath)).toBe(true);
            const content = fs.readFileSync(filePath, 'utf-8');
            expect(content).not.toContain('quick-log-solo.vercel.app');
            expect(content).not.toContain('quicklog-solo.vercel.app');

            const actualUrls = content.match(/https:\/\/masanori-satake\.github\.io\/QuickLog-Solo\/[^\s'"`)]+/g) || [];
            const expectedUrls = Object.entries(expectedPaths).flatMap(([urlPath, count]) =>
                Array(count).fill(`${pagesBase}${urlPath}`)
            );
            expect(actualUrls.sort()).toEqual(expectedUrls.sort());
        });
    });
});
