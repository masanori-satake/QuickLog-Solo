import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const LOCALES = ['ja', 'en'];
const ASSET_DIR = 'src/assets/guide';

test.describe('Quick Start Guide Verification', () => {

  test('should have all required screenshots in assets directory', async () => {
    for (const lang of LOCALES) {
      const images = [
        `01_main_${lang}.png`,
        `02_recording_${lang}.png`,
        `03_header_actions_${lang}.png`,
        `04_settings_backup_${lang}.png`
      ];

      for (const imgName of images) {
        const imgPath = path.join(ASSET_DIR, imgName);
        expect(fs.existsSync(imgPath), `Screenshot missing: ${imgPath}`).toBe(true);
        const stats = fs.statSync(imgPath);
        expect(stats.size, `Screenshot is empty: ${imgPath}`).toBeGreaterThan(1000);
      }
    }
  });

  test('should display screenshots correctly in Japanese', async ({ page }) => {
    await page.goto(`http://localhost:8080/guide.html?lang=ja`);

    const imgMain = page.locator('#img-main');
    await expect(imgMain).toHaveAttribute('src', 'src/assets/guide/01_main_ja.png');
    await expect(imgMain).toBeVisible();

    const imgRec = page.locator('#img-recording');
    await expect(imgRec).toHaveAttribute('src', 'src/assets/guide/02_recording_ja.png');

    const imgHeader = page.locator('#img-header');
    await expect(imgHeader).toHaveAttribute('src', 'src/assets/guide/03_header_actions_ja.png');

    const imgBackup = page.locator('#img-backup');
    await expect(imgBackup).toHaveAttribute('src', 'src/assets/guide/04_settings_backup_ja.png');
  });

  test('should display screenshots correctly in English', async ({ page }) => {
    await page.goto(`http://localhost:8080/guide.html?lang=en`);

    const imgMain = page.locator('#img-main');
    await expect(imgMain).toHaveAttribute('src', 'src/assets/guide/01_main_en.png');
    await expect(imgMain).toBeVisible();

    const imgRec = page.locator('#img-recording');
    await expect(imgRec).toHaveAttribute('src', 'src/assets/guide/02_recording_en.png');

    const imgHeader = page.locator('#img-header');
    await expect(imgHeader).toHaveAttribute('src', 'src/assets/guide/03_header_actions_en.png');

    const imgBackup = page.locator('#img-backup');
    await expect(imgBackup).toHaveAttribute('src', 'src/assets/guide/04_settings_backup_en.png');
  });

});
