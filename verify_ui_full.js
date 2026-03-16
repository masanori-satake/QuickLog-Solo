const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/projects/app/app.html');
  await page.click('#settings-btn');
  await page.click('.tab-btn[data-tab="alarms"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verification/alarms_tab_full.png' });

  await page.goto('http://localhost:8080/projects/web/index.html?lang=ja');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verification/landing_page_ja_features.png' });

  await browser.close();
})();
