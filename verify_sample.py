import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        # Ensure we are in a clean state
        await page.goto('http://localhost:8080/src/studio.html')
        await page.wait_for_selector('#sample-select')

        # Select "Hero Pot" (sample 2 in list usually, but let's select by value)
        await page.select_option('#sample-select', 'hero_pot')
        await page.wait_for_timeout(1000) # Wait for parsing

        # Click Test
        await page.click('#test-btn')
        await page.wait_for_timeout(2000) # Wait for animation to start

        await page.screenshot(path='/home/jules/verification/studio_hero_pot_test.png')

        # Verify preview color change
        # Click the green preset (index 6 or so)
        presets = await page.query_selector_all('.color-preset')
        await presets[5].click()
        await page.wait_for_timeout(500)
        await page.screenshot(path='/home/jules/verification/studio_hero_pot_green.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
