import os
import subprocess
from playwright.sync_api import sync_playwright

SIZES = [16, 32, 48, 128]
SVG_PATH = os.path.join(os.getcwd(), 'src/assets/icon.svg')
OUTPUT_DIR = os.path.join(os.getcwd(), 'src/assets')

def generate_icons():
    if not os.path.exists(SVG_PATH):
        print(f"Error: {SVG_PATH} not found.")
        return False

    with open(SVG_PATH, 'r') as f:
        svg_content = f.read()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={'width': 512, 'height': 512},
            device_scale_factor=1
        )
        page = context.new_page()

        # Set the content to the SVG, ensuring it fills the viewport
        page.set_content(f"""
            <style>
              body, html {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }}
              svg {{ width: 100%; height: 100%; display: block; }}
            </style>
            {svg_content}
        """)

        for size in SIZES:
            output_path = os.path.join(OUTPUT_DIR, f"icon{size}.png")
            print(f"Generating {size}x{size} icon: {output_path}")

            page.set_viewport_size({'width': size, 'height': size})
            page.screenshot(
                path=output_path,
                omit_background=True,
                clip={'x': 0, 'y': 0, 'width': size, 'height': size}
            )

        browser.close()

    print('Icon generation complete.')
    return True

if __name__ == "__main__":
    if generate_icons():
        exit(0)
    else:
        exit(1)
