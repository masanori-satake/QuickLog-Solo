import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:8080/index.html')
        await page.wait_for_selector('.scene-section.card')

        card = page.locator('.scene-section.card')
        margin = await card.evaluate("el => window.getComputedStyle(el).marginTop")
        print(f"Card Margin Top: {margin}")

        await browser.close()

asyncio.run(run())
