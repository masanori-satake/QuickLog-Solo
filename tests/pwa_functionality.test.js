import fs from 'fs';
import path from 'path';

describe('PWA Functionality and Extension Isolation Tests', () => {
    const rootDir = process.cwd();

    test('PWA manifest exists and is valid Web App Manifest', () => {
        const manifestPath = path.join(rootDir, 'projects/pwa/manifest.webmanifest');
        expect(fs.existsSync(manifestPath)).toBe(true);

        const content = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);

        expect(manifest.name).toBe('QuickLog-Solo');
        expect(manifest.short_name).toBe('QuickLog');
        expect(manifest.start_url).toBe('./');
        expect(manifest.display).toBe('standalone');
        expect(Array.isArray(manifest.icons)).toBe(true);

        const icon192 = manifest.icons.find((i) => i.sizes === '192x192');
        const icon512 = manifest.icons.find((i) => i.sizes === '512x512');
        expect(icon192).toBeDefined();
        expect(icon512).toBeDefined();
    });

    test('PWA index.html and sw.js exist and have safe-area / PWA setup', () => {
        const htmlPath = path.join(rootDir, 'projects/pwa/index.html');
        const swPath = path.join(rootDir, 'projects/pwa/sw.js');
        const jsPath = path.join(rootDir, 'projects/pwa/js/pwa.js');

        expect(fs.existsSync(htmlPath)).toBe(true);
        expect(fs.existsSync(swPath)).toBe(true);
        expect(fs.existsSync(jsPath)).toBe(true);

        const html = fs.readFileSync(htmlPath, 'utf-8');
        expect(html).toContain('window.IS_PWA = true');
        expect(html).toContain('manifest.webmanifest');
        expect(html).toContain('apple-mobile-web-app-capable');

        const sw = fs.readFileSync(swPath, 'utf-8');
        expect(sw).toContain('quicklog-pwa-');
        expect(sw).toContain('STATIC_ASSETS');
    });

    test('Chrome Extension manifest and background.js remain intact and isolated', () => {
        const extManifestPath = path.join(rootDir, 'projects/app/manifest.json');
        const extBgPath = path.join(rootDir, 'projects/app/js/background.js');

        expect(fs.existsSync(extManifestPath)).toBe(true);
        expect(fs.existsSync(extBgPath)).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(extManifestPath, 'utf-8'));
        expect(manifest.manifest_version).toBe(3);
        expect(manifest.background.service_worker).toBe('js/background.js');

        const bgContent = fs.readFileSync(extBgPath, 'utf-8');
        expect(bgContent).not.toContain('quicklog-pwa-');
    });

    test('Vercel routing includes PWA rewrite/redirect rules', () => {
        const vercelPath = path.join(rootDir, 'vercel.json');
        expect(fs.existsSync(vercelPath)).toBe(true);

        const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
        const pwaRedirect = vercel.redirects.find((r) => r.source === '/pwa/');
        expect(pwaRedirect).toBeDefined();
        expect(pwaRedirect.destination).toBe('/projects/pwa/');
    });
});
