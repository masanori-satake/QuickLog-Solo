import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/src/app.html?test_cat=🐛%20バグ修正・品質改善&test_elapsed=60000');
  await page.waitForTimeout(2000); // Wait for animation to start
  await page.screenshot({ path: '/home/jules/verification/tetris_visibility.png' });

  // Also check Matrix for thin lines
  await page.goto('http://localhost:8080/src/app.html?test_cat=💻%20開発・プログラミング&test_elapsed=60000');
  await page.waitForTimeout(2000); // Wait for animation to start
  await page.screenshot({ path: '/home/jules/verification/matrix_visibility.png' });

  await browser.close();
})();
