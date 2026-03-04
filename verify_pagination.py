import asyncio
from playwright.async_api import async_playwright
import json
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Use a specific DB name for testing
        page = await browser.new_page()

        # Navigate to the app with a clean test DB
        await page.goto('http://localhost:8080/src/app.html?db=TestPaginationDB')

        # Wait for DB init
        await page.wait_for_timeout(1000)

        # Open settings
        await page.click('#settings-toggle')
        await page.click('.tab-btn[data-tab="categories"]')

        # Clear all categories first to have a clean slate
        # We can do this via Maintenance or just delete one by one.
        # Let's use the 'Reset' button in Maintenance tab to be sure we start fresh,
        # but that resets EVERYTHING including logs.

        await page.click('.tab-btn[data-tab="maintenance"]')
        # Reset Category and Settings
        await page.click('#reset-cat-settings-btn')
        await page.wait_for_selector('#confirm-modal:not(.hidden)')
        await page.click('#confirm-ok-btn')
        await page.wait_for_timeout(1000)

        # Now we are on page 1 of categories.
        # Let's add 2 categories and a page break in between.
        await page.click('#settings-toggle')
        await page.click('.tab-btn[data-tab="categories"]')

        # Add Cat A
        await page.fill('#new-category-name-settings', 'Cat A')
        await page.click('#add-category-btn-settings')

        # Add Page Break
        await page.click('#add-page-break-btn')

        # Add Cat B
        await page.fill('#new-category-name-settings', 'Cat B')
        await page.click('#add-category-btn-settings')

        # Add many more to see if it continues to next page
        # Note: ITEMS_PER_PAGE is 16.

        await page.wait_for_timeout(500)

        # Close settings
        await page.click('.close-btn')

        # Check Main UI pagination dots
        dots = await page.query_selector_all('.pagination-dot')
        print(f"Pagination dots count: {len(dots)}")

        # Check visible categories on Page 1
        cat_btns = await page.query_selector_all('.category-btn')
        texts = [await b.text_content() for b in cat_btns]
        print(f"Page 1 Categories: {texts}")

        # Take screenshot of category area
        await page.screenshot(path='/home/jules/verification/pagination_test.png')

        # Verify Category Editor reflects the items
        await page.click('#settings-toggle')
        await page.click('.tab-btn[data-tab="categories"]')
        editor_items = await page.query_selector_all('.category-editor-item')
        print(f"Editor items count: {len(editor_items)}")

        for i, item in enumerate(editor_items):
            is_pb = await item.evaluate("el => el.classList.contains('page-break-item')")
            name = await item.get_attribute('data-name')
            print(f"Item {i}: {name} (IsPageBreak: {is_pb})")

        # Test Export NDJSON
        async with page.expect_download() as download_info:
            await page.click('#export-categories-btn')
        download = await download_info.value
        path = f"/home/jules/verification/categories_export.ndjson"
        await download.save_as(path)

        with open(path, 'r') as f:
            lines = f.readlines()
            print("Exported NDJSON lines:")
            for line in lines:
                print(line.strip())

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
