const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to the app
  await page.goto('http://localhost:8080/src/app.html');
  await page.waitForSelector('#timer-display');

  // Open settings
  await page.click('#settings-btn');
  await page.waitForSelector('#settings-modal', { state: 'visible' });

  // Go to Categories tab
  await page.click('.tab-btn[data-tab="categories"]');
  await page.waitForSelector('#settings-categories', { state: 'visible' });

  console.log('Adding page breaks...');
  // Add page break
  await page.click('#add-page-break-btn');
  await page.waitForTimeout(500);
  // Add another
  await page.click('#add-page-break-btn');
  await page.waitForTimeout(500);

  // Count items in category list
  const itemCount = await page.locator('#settings-categories .settings-item').count();
  console.log(`Total category items: ${itemCount}`);

  // Get text content of all items
  const items = await page.locator('#settings-categories .settings-item').allTextContents();
  console.log('Category items:', items);

  // Screenshot of the list (scrolled)
  await page.evaluate(() => {
    const list = document.querySelector('#settings-categories');
    list.scrollTop = list.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/home/jules/verification/settings_categories_scrolled.png' });

  // Test Export (NDJSON)
  console.log('Testing export...');
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export-categories-btn')
  ]);
  const downloadPath = path.join('/home/jules/verification', download.suggestedFilename());
  await download.saveAs(downloadPath);
  console.log(`Exported to ${downloadPath}`);

  // Check content of exported file
  const fs = require('fs');
  const content = fs.readFileSync(downloadPath, 'utf8');
  console.log('Exported content (first 2 lines):');
  console.log(content.split('\n').slice(0, 2).join('\n'));

  // Test Page Break effect on main screen
  await page.click('.close-btn'); // Close settings
  await page.waitForSelector('#settings-modal', { state: 'hidden' });

  // Check if pagination is active or if we can see the next page
  const pageDots = await page.locator('.page-dot').count();
  console.log(`Number of pages: ${pageDots}`);

  await browser.close();
})();
