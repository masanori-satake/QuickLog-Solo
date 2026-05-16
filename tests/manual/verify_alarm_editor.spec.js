import { test, expect } from '@playwright/test';

test('capture alarm editor screenshots', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.waitForSelector('.business-days-section');
  await page.waitForTimeout(1000);

  // Switch to Japanese to show the requested localized state
  const jaBtn = page.locator('.switcher-btn', { hasText: 'JA' });
  await jaBtn.click();
  await page.waitForTimeout(500);

  // 1. Japanese Light Mode
  await page.screenshot({ path: 'final_ui_ja_light.png', fullPage: true });

  // 2. Dark Mode
  await page.click('button:has-text("ダーク")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'final_ui_ja_dark.png', fullPage: true });

  // 3. Guardrail test
  await page.click('.alarm-item:nth-child(1)');
  await page.selectOption('#alarm-type-select', 'monthly_date');
  await page.fill('#alarm-day-of-month-input', '1');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'final_ui_guardrail.png', fullPage: true });
});
