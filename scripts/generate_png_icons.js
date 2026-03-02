import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 48, 128];
const SVG_PATH = path.join(process.cwd(), 'src/assets/icon.svg');
const OUTPUT_DIR = path.join(process.cwd(), 'src/assets');

async function generateIcons() {
  const svgContent = fs.readFileSync(SVG_PATH, 'utf8');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Set the content to the SVG, ensuring it fills the viewport
  await page.setContent(`
    <style>
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
      svg { width: 100%; height: 100%; display: block; }
    </style>
    ${svgContent}
  `);

  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon${size}.png`);
    console.log(`Generating ${size}x${size} icon: ${outputPath}`);

    await page.setViewportSize({ width: size, height: size });
    await page.screenshot({
      path: outputPath,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size }
    });
  }

  await browser.close();
  console.log('Icon generation complete.');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
