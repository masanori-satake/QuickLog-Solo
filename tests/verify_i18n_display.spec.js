
import { test, expect } from '@playwright/test';

const languages = ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'];

test.describe('I18n display verification', () => {
    for (const lang of languages) {
        test(`verify display for language: ${lang}`, async ({ page }) => {
            // Set language via URL parameter
            await page.goto(`/projects/app/app.html?lang=${lang}`);

            // Wait for application initialization
            await page.waitForSelector('#app');

            // Check if a key UI element has text (not just the key name)
            const stopBtnText = page.locator('#end-btn .btn-text');
            await expect(stopBtnText).toBeVisible();

            // Verify a specific label based on language
            const expectedStopTexts = {
                'ja': '終了',
                'en': 'Stop',
                'de': 'Beenden',
                'es': 'Detener',
                'fr': 'Arrêter',
                'pt': 'Parar',
                'ko': '종료',
                'zh': '停止'
            };
            await expect(stopBtnText).toHaveText(expectedStopTexts[lang]);

            // Open settings to see more labels
            const settingsBtn = page.locator('#settings-toggle');
            await settingsBtn.click();

            const generalTab = page.locator('.tab-btn[data-tab="general"]');
            await expect(generalTab).toBeVisible();

            // Take screenshot
            await page.screenshot({ path: `tests/screenshots/lang_verify_${lang}.png` });
        });
    }
});
