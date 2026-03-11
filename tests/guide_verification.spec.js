import { test, expect } from '@playwright/test';

test('Verify Guide links and accessibility with extended descriptions', async ({ page }) => {
    // Check Japanese version
    await page.goto('http://localhost:8080/index.html?lang=ja');
    const guideLinkJa = page.locator('#quick-start-guide-link');
    await expect(guideLinkJa).toBeVisible();
    await expect(guideLinkJa).toContainText('Quick Start Guide を見る (印刷にも対応)');

    await guideLinkJa.click();
    await expect(page).toHaveURL(/guide.html\?lang=ja/);
    await expect(page.locator('h1')).toContainText('Quick Start Guide');
    await expect(page.locator('[data-i18n="guide-title"]')).toContainText('1秒で記録、1秒で集計。');

    // Check English version
    await page.goto('http://localhost:8080/index.html?lang=en');
    const guideLinkEn = page.locator('#quick-start-guide-link');
    await expect(guideLinkEn).toBeVisible();
    await expect(guideLinkEn).toContainText('View Quick Start Guide (Printable PDF ready)');

    await guideLinkEn.click();
    await expect(page).toHaveURL(/guide.html\?lang=en/);
    await expect(page.locator('[data-i18n="guide-title"]')).toContainText('Record in 1s, Total in 1s.');

    // Check German version
    await page.goto('http://localhost:8080/index.html?lang=de');
    const guideLinkDe = page.locator('#quick-start-guide-link');
    await expect(guideLinkDe).toBeVisible();
    await expect(guideLinkDe).toContainText('Quick Start Guide ansehen (Druckfertiges PDF)');

    await guideLinkDe.click();
    await expect(page).toHaveURL(/guide.html\?lang=en/); // Defaults to en if not ja/en
});
