import { test, expect } from '@playwright/test';

test('Feedback implementation verification', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  // 1. Check Language Flags
  await page.goto('http://localhost:8081/index.html');
  const langOptions = await page.locator('#lang-select-landing option').allTextContents();
  console.log('Lang Options:', langOptions);
  expect(langOptions[0]).toContain('🇺🇸');

  // 2. Check Category Editor UI
  await page.goto('http://localhost:8081/category-editor.html');
  await page.waitForSelector('.category-item');

  // Check pane width (approx) - Allow for border
  const listPane = page.locator('.list-pane');
  const box = await listPane.boundingBox();
  console.log('List pane width:', box.width);
  expect(box.width).toBeGreaterThanOrEqual(400);

  // Check Page Break Alignment
  await page.click('#add-page-break-btn');
  await page.waitForSelector('.category-item.page-break');
  const pbItem = page.locator('.category-item.page-break').last();
  const dragHandle = pbItem.locator('.drag-handle');
  const handleBox = await dragHandle.boundingBox();
  const itemBox = await pbItem.boundingBox();
  console.log('Drag handle X:', handleBox.x, 'Item X:', itemBox.x);
  expect(handleBox.x - itemBox.x).toBeLessThan(20); // Should be on the left

  // Check "Add Page Break" button alignment
  const footerActions = page.locator('.list-footer-actions');
  const addBtn = page.locator('#add-page-break-btn');
  const footerBox = await footerActions.boundingBox();
  const btnBox = await addBtn.boundingBox();
  console.log('Footer X:', footerBox.x, 'Btn X:', btnBox.x, 'Footer Width:', footerBox.width, 'Btn Width:', btnBox.width);
  // Btn right edge should be near footer right edge
  expect(footerBox.x + footerBox.width - (btnBox.x + btnBox.width)).toBeLessThan(30);

  // Check Animation Info
  await page.click('.category-item:nth-child(1)');
  await page.selectOption('#edit-animation', 'digital_rain');
  await expect(page.locator('#animation-info')).toBeVisible();
  const animDesc = await page.locator('#anim-desc').textContent();
  console.log('Anim desc:', animDesc);
  expect(animDesc.length).toBeGreaterThan(0);

  // Check NDJSON View Modal
  await page.click('#btn-show-code');
  await expect(page.locator('#code-modal')).toBeVisible();

  await page.screenshot({ path: '/home/jules/verification/feedback_refined.png' });
});
