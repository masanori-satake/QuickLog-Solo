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
            'projects/app/app.html'
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

                if (
                    url.startsWith('http://') ||
                    url.startsWith('https://') ||
                    url.startsWith('data:') ||
                    url.startsWith('chrome://') ||
                    url.startsWith('edge://') ||
                    url.startsWith('#') ||
                    url.startsWith('javascript:') ||
                    url === 'about:blank'
                ) {
                    continue;
                }

                // Strip query parameters and hash
                const cleanUrl = url.split('?')[0].split('#')[0];
                if (!cleanUrl) continue;

                const targetPath = path.resolve(htmlDir, cleanUrl);
                expect({ file: relHtml, asset: url, targetPath }).toEqual({
                    file: relHtml,
                    asset: url,
                    targetPath: expect.stringMatching(/./)
                });
                expect(fs.existsSync(targetPath)).toBe(true);
            }
        });
    });

    test('No vercel.app URLs remain in primary app, web HTML, or README', () => {
        const filesToCheck = [
            'README.md',
            'projects/app/js/app.js',
            'projects/web/index.html',
            'docs/animation_module_spec.md'
        ];

        filesToCheck.forEach((relFile) => {
            const filePath = path.join(rootDir, relFile);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                expect(content).not.toContain('quick-log-solo.vercel.app');
                expect(content).not.toContain('quicklog-solo.vercel.app');
            }
        });
    });
});
