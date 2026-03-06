import asyncio
from playwright.async_api import async_playwright
import os

async def reproduce():
    async def run_server():
        process = await asyncio.create_subprocess_exec(
            'python3', '-m', 'http.server', '8081',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        return process

    server = await run_server()
    await asyncio.sleep(2)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:8081/src/studio.html')

        # 1. Check Wrap button state
        wrap_btn = page.locator('#toggle-wrap')
        is_active = await wrap_btn.evaluate("el => el.classList.contains('active')")
        print(f"Wrap button active: {is_active}")
        await wrap_btn.screenshot(path='verification/repro_wrap_btn.png')

        # 2. Select an animation (e.g., Hero Pot, which has canvas mode)
        await page.select_option('#sample-select', 'hero_pot')
        await asyncio.sleep(1)

        # Check raw canvas (should have black area if Canvas mode)
        await page.screenshot(path='verification/repro_after_selection.png')

        # 3. Start test
        await page.click('#test-btn')
        await asyncio.sleep(2)
        await page.screenshot(path='verification/repro_during_test.png')

        # 4. Stop test
        await page.click('#test-btn')
        await asyncio.sleep(1)
        await page.screenshot(path='verification/repro_after_stop.png')

        await browser.close()

    server.terminate()
    await server.wait()

if __name__ == "__main__":
    if not os.path.exists('verification'):
        os.makedirs('verification')
    asyncio.run(reproduce())
