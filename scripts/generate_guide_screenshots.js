import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LOCALES = ['ja', 'en'];
const ASSET_DIR = 'src/assets/guide';
const BASE_URL = 'http://localhost:8080/src/app.html';

async function generateScreenshots() {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 760, height: 1200 },
        deviceScaleFactor: 2,
    });

    const timestamp = Date.now();
    for (const lang of LOCALES) {
        console.log(`Generating screenshots for ${lang === 'ja' ? 'Japanese' : 'English'}...`);
        const dbName = `test-gen-${lang}-${timestamp}`;

        const page = await context.newPage();

        // --- 01_main: Stopped state ---
        await page.goto(`${BASE_URL}?lang=${lang}&db=${dbName}`);
        await page.waitForSelector('.category-btn'); // Ensure categories are rendered
        await page.screenshot({
            path: path.join(ASSET_DIR, `01_main_${lang}.png`),
            clip: { x: 120, y: 170, width: 335, height: 460 }
        });

        // --- 02_recording: Recording state ---
        const testCat = lang === 'ja' ? '開発' : 'Development';
        await page.goto(`${BASE_URL}?lang=${lang}&db=${dbName}&test_cat=${testCat}&test_elapsed=3661000&test_resumable=${testCat}`);
        await page.waitForSelector('.status-running');
        await page.waitForSelector('.category-btn');
        await page.waitForTimeout(500);

        await page.screenshot({
            path: path.join(ASSET_DIR, `02_recording_${lang}.png`),
            clip: { x: 120, y: 170, width: 335, height: 460 }
        });

        // --- 03_header_actions: Zoom on report/aggregation buttons ---
        await page.screenshot({
            path: path.join(ASSET_DIR, `03_header_actions_${lang}.png`),
            clip: { x: 335, y: 170, width: 120, height: 50 }
        });

        // --- 04_settings_backup: Backup settings ---
        await page.click('#settings-toggle');
        await page.waitForSelector('#settings-popup:not(.hidden)');
        await page.click('[data-tab="backup"]');
        await page.waitForSelector('#backup-tab:not(.hidden)');

        await page.screenshot({
            path: path.join(ASSET_DIR, `04_settings_backup_${lang}.png`),
            clip: { x: 120, y: 170, width: 335, height: 460 }
        });

        await page.close();
    }

    await browser.close();
}

generateScreenshots().then(() => {
    console.log('Done!');
}).catch(err => {
    console.error('Error generating screenshots:', err);
    process.exit(1);
});
