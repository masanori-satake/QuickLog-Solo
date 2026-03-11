import { chromium, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function generateScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 380, height: 600 },
    deviceScaleFactor: 2, // High DPI
  });

  const languages = ['ja', 'en'];
  const targetDir = path.join(process.cwd(), 'src/assets/guide');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const lang of languages) {
    const page = await context.newPage();
    const baseUrl = `http://localhost:8080/src/app.html?lang=${lang}&db=QuickLogSoloDB_Guide_${lang}`;

    console.log(`Generating screenshots for ${lang}...`);

    // 1. Main View
    await page.goto(baseUrl);
    // Wait for categories to be rendered (they are dynamic from DB)
    await page.waitForSelector('.category-btn', { timeout: 10000 });

    // Dismiss persistence modal if present
    const okBtn = page.locator('#confirm-ok-btn');
    if (await okBtn.isVisible()) {
      await okBtn.click();
      // Wait for modal to be hidden to ensure UI is ready
      await expect(page.locator('#confirm-modal')).toBeHidden({ timeout: 5000 });
    }

    await page.screenshot({ path: path.join(targetDir, `01_main_${lang}.png`) });

    // 2. Recording State
    await page.click('.category-btn:first-child');
    // The button might be different, it should be enabled after clicking category
    await page.waitForSelector('#end-btn:not([disabled])', { timeout: 10000 });

    // Wait for animation to settle a bit
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(targetDir, `02_recording_${lang}.png`) });

    // 3. Header Buttons (Report/Stats)
    // We can use a clip to focus on the header
    await page.screenshot({
      path: path.join(targetDir, `03_header_actions_${lang}.png`),
      clip: { x: 0, y: 0, width: 380, height: 120 }
    });

    // 4. Settings - Backup
    await page.click('#settings-toggle');
    await page.waitForSelector('#settings-popup', { state: 'visible' });
    await page.click('.tab-btn[data-tab="backup"]');
    await page.waitForSelector('#backup-tab', { state: 'visible' });
    await page.screenshot({ path: path.join(targetDir, `04_settings_backup_${lang}.png`) });

    await page.close();
  }

  await browser.close();
  console.log('Screenshots generated successfully in src/assets/guide/');
}

generateScreenshots().catch(err => {
  console.error('Error generating screenshots:', err);
  process.exit(1);
});
