
import { test, expect } from '@playwright/test';

const languages = ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'];

test.describe('I18n display verification', () => {
    for (const lang of languages) {
        test(`verify display for language: ${lang}`, async ({ page }) => {
            // Allow more time on slow CI runners
            test.setTimeout(60000);

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

            // Open settings to see more labels if not already open
            const settingsPopup = page.locator('#settings-popup');
            if (!(await settingsPopup.isVisible())) {
                const settingsBtn = page.locator('#settings-toggle');
                await expect(settingsBtn).toBeVisible();
                await settingsBtn.click();
            }

            await expect(settingsPopup).toBeVisible();
            const generalTab = page.locator('.tab-btn[data-tab="general"]');
            await expect(generalTab).toBeVisible();

            // Take screenshot
            // The directory is ensured to exist, or we can use Playwright's automatic results.
            // But manually specifying a path is fine for local verification.
            await page.screenshot({ path: `tests/screenshots/lang_verify_${lang}.png` });
        });
    }
});
