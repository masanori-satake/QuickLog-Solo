import os

def generate_icons():
    svg_path = os.path.join(os.getcwd(), 'src/assets/icon.svg')
    output_dir = os.path.join(os.getcwd(), 'src/assets')

    if not os.path.exists(svg_path):
        print(f"Error: {svg_path} not found.")
        return False

    with open(svg_path, 'r') as f:
        svg_content = f.read()

    # If VERCEL environment is detected, skip generation as it's not needed for the landing page
    # and Playwright might not be installed or configured.
    if os.environ.get('VERCEL'):
        print("Vercel environment detected. Skipping PNG icon generation for extension.")
        return True

    try:
        from playwright.sync_api import sync_playwright
        print("Playwright found. Generating icons...")
    except ImportError:
        print("Error: No module named 'playwright'. Please install it to generate extension icons.")
        return False

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as e:
            print(f"Error: Failed to launch browser: {e}")
            return False

        context = browser.new_context(
            viewport={'width': 512, 'height': 512},
            device_scale_factor=1
        )
        page = context.new_page()

        page.set_content(f"""
            <style>
              body, html {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }}
              svg {{ width: 100%; height: 100%; display: block; }}
            </style>
            {svg_content}
        """)

        for size in [16, 32, 48, 128]:
            output_path = os.path.join(output_dir, f"icon{size}.png")
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
