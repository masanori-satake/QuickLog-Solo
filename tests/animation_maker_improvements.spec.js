import { test, expect } from '@playwright/test';

test.describe('QL-Animation Maker Improvements', () => {
  test('should verify play/pause button merger, guidelines visibility, scale math, and localization placeholders', async ({ page }) => {
    // 1. Load QL-Animation Maker directly in Japanese
    await page.goto('/projects/animation-maker/index.html?lang=ja&theme=dark');
    await page.waitForSelector('#maker-app');

    // 2. Verify Title does not contain (Beta) or (β版)
    const titleText = await page.locator('.header-left h1').textContent();
    expect(titleText).not.toContain('Beta');
    expect(titleText).not.toContain('β');

    // 3. Verify single play/pause button is present and pause/play two buttons are gone
    const playPauseBtn = page.locator('#btn-play-pause');
    await expect(playPauseBtn).toBeVisible();
    await expect(page.locator('#btn-play')).not.toBeVisible();
    await expect(page.locator('#btn-pause')).not.toBeVisible();

    // Verify initial play/pause icon is pause (since standard play is true on start)
    const initialIcon = await playPauseBtn.locator('.material-symbols-outlined').textContent();
    expect(initialIcon).toBe('pause');

    // Click to pause
    await playPauseBtn.click();
    const pausedIcon = await playPauseBtn.locator('.material-symbols-outlined').textContent();
    expect(pausedIcon).toBe('play_arrow');

    // 4. Verify boundary-line has fluorescent green color style
    const boundaryLine = page.locator('.boundary-line').first();
    await expect(boundaryLine).toBeVisible();
    const borderStyle = await boundaryLine.evaluate(el => window.getComputedStyle(el).borderTop);
    // Should contain fluorescent green #39ff14 or rgb representation
    expect(borderStyle).toContain('rgb(57, 255, 20)'); // rgb(57, 255, 20) is #39ff14

    // 5. Verify localized placeholders in Japanese
    const nameInput = page.locator('#meta-name');
    const authorInput = page.locator('#meta-author');
    const descInput = page.locator('#meta-desc');

    const namePlaceholder = await nameInput.getAttribute('placeholder');
    const authorPlaceholder = await authorInput.getAttribute('placeholder');
    const descPlaceholder = await descInput.getAttribute('placeholder');

    expect(namePlaceholder).toBe('マイアニメーション');
    expect(authorPlaceholder).toBe('あなたのお名前');
    expect(descPlaceholder).toBe('アニメーションの簡単な説明');

    // 6. Verify scale-with-height ON/OFF display matches at 100% height
    // We can evaluate scale factor calculation directly
    const scaleFactorBefore = await page.evaluate(() => {
        // Toggle scaleWithHeight OFF
        document.getElementById('config-scale-height').checked = false;
        return window.getScaleFactor();
    });

    const scaleFactorAfter = await page.evaluate(() => {
        // Toggle scaleWithHeight ON
        document.getElementById('config-scale-height').checked = true;
        return window.getScaleFactor();
    });

    // At standard height 100%, scaleFactor should be identical regardless of ON/OFF
    expect(scaleFactorBefore).toBe(scaleFactorAfter);
  });

  test('should verify duplicate import name handling in app.js', async ({ page }) => {
    // Load main application
    const dbName = `DuplicateImportTestDB_${Math.random().toString(36).substring(7)}`;
    await page.goto(`?db=${dbName}`);
    await page.waitForSelector('#app');

    // Handle persistence modal if visible
    const okBtn = page.locator('#confirm-ok-btn');
    if (await okBtn.isVisible()) {
      await okBtn.click();
    }

    // Go to Custom Animations tab
    await page.click('#settings-toggle');
    await page.click('.tab-btn[data-tab="custom-anim"]');

    // We will simulate calling importCustomAnimation twice with the same name
    const samplePackage = JSON.stringify({
      format: "quicklog-animation-package",
      formatVersion: "1.0",
      id: "my-test-id-unique-123",
      metadata: {
        name: "My Animation",
        description: "Test",
        author: "User"
      },
      config: {
        exclusionStrategy: "freedom"
      },
      payload: {
        imageData: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        renderSpec: {
          focusX: 0,
          focusY: 0,
          targetHeight: 100,
          maxWidth: 200,
          scaleWithHeight: false,
          overflowBehavior: "categoryColor"
        }
      }
    });

    // Import first time
    await page.evaluate(async (text) => {
      await window.importCustomAnimation(text);
    }, samplePackage);

    // Import second time
    await page.evaluate(async (text) => {
      await window.importCustomAnimation(text);
    }, samplePackage);

    // Verify option elements in select dropdown
    const selectOptions = await page.locator('#custom-anim-select option').allTextContents();
    console.log('Select options:', selectOptions);

    // One should be "My Animation" and the other should be "My Animation (1)"
    expect(selectOptions).toContain('My Animation');
    expect(selectOptions).toContain('My Animation (1)');
  });
});
