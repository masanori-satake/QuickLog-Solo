import { test, expect } from '@playwright/test';

test('manual inspection of LCD effect', async ({ page }) => {
  await page.goto('?test_cat=🐛%20バグ修正・品質改善&test_elapsed=10000');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'verification/final_lcd_check.png' });
});
