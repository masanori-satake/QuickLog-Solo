import fs from 'fs';
import path from 'path';

describe('Manifest Permissions Compliance (Permissions Delta Verification)', () => {
    test('manifest.json has exact approved permissions and no unexpected additions', () => {
        const manifestPath = path.resolve(process.cwd(), 'projects/app/manifest.chrome.json');
        const fileContent = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(fileContent);

        expect(manifest).toBeDefined();
        expect(manifest.permissions).toBeInstanceOf(Array);

        // Allowed baseline list of permissions
        const APPROVED_PERMISSIONS = [
            "tabs",
            "sidePanel",
            "alarms",
            "notifications",
            "clipboardRead",
            "storage",
            "unlimitedStorage"
        ];

        // Ensure no new permissions are added which could cause extension to be automatically disabled by Chrome
        for (const permission of manifest.permissions) {
            expect(APPROVED_PERMISSIONS).toContain(permission);
        }

        // Ensure all currently required permissions are defined
        expect(manifest.permissions).toContain("alarms");
        expect(manifest.permissions).toContain("notifications");
        expect(manifest.permissions).toContain("storage");
    });
});
