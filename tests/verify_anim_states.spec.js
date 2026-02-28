import { test, expect } from '@playwright/test';

test('capture tetris animation at 50%', async ({ page }) => {
  // Navigate to app with 60s elapsed (50% of 2m cycle)
  await page.goto('?test_cat=🐛%20バグ修正・品質改善&test_elapsed=60000');

  // Wait for animation to render
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'verification/anim_tetris_50pct.png' });
});

test('capture plant animation at 85%', async ({ page }) => {
  // Plant growth has a flower at > 0.8
  await page.goto('?test_cat=🌱%20アイデア出し・企画立案&test_elapsed=102000');

  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'verification/anim_plant_85pct.png' });
});

test('capture matrix animation', async ({ page }) => {
  await page.goto('?test_cat=💻%20開発・プログラミング&test_elapsed=30000');

  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'verification/anim_matrix.png' });
});
