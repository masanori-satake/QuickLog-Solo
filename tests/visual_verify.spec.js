import { test, expect } from '@playwright/test';

test('visual verification of exclusion areas and animations', async ({ page }) => {
  await page.goto('http://localhost:8080/src/app.html');

  // Start a task to trigger animation
  await page.click('.category-btn:first-child');

  // Wait for animation to start
  await page.waitForTimeout(1000);

  // Capture screenshot of the active task display
  await page.locator('#current-task-display').screenshot({ path: 'v-active-task-final.png' });

  // Resume and change animation to Matrix (last one)
  await page.click('#settings-toggle');
  await page.selectOption('#animation-select', 'matrix-code');
  await page.click('.close-btn');
  await page.waitForTimeout(1000);
  await page.locator('#current-task-display').screenshot({ path: 'v-matrix-task-final.png' });
});
