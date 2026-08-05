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

        // Verify exact, order-independent equality between approved and manifest permissions
        // This detects additions, removals, and duplicates
        const manifestSet = new Set(manifest.permissions);
        const approvedSet = new Set(APPROVED_PERMISSIONS);

        // Check for permissions in manifest but not approved (additions)
        for (const permission of manifest.permissions) {
            expect(approvedSet.has(permission)).toBe(true);
        }

        // Check for approved permissions not in manifest (removals)
        for (const permission of APPROVED_PERMISSIONS) {
            expect(manifestSet.has(permission)).toBe(true);
        }

        // Check for duplicates in manifest
        expect(manifest.permissions.length).toBe(manifestSet.size);
    });
});
