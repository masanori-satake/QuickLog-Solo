import urllib.request
import re
import os

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

FONT_DIR = 'shared/assets/fonts'
os.makedirs(FONT_DIR, exist_ok=True)

FONTS_TO_BUNDLE = [
    ('Dela Gothic One', 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap', 15),
    ('Yusei Magic', 'https://fonts.googleapis.com/css2?family=Yusei+Magic&display=swap', 15),
    ('Roboto', 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap', 5),
    ('Inter', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap', 5),
    ('Montserrat', 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap', 5),
    ('Open Sans', 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap', 5),
    ('Ubuntu', 'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;700&display=swap', 5),
    ('Noto Sans JP', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap', 20),
]

css_rules = []

# First rule in fonts.css: Material Symbols
css_rules.append('''@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url('../assets/fonts/material-symbols-outlined.woff2') format('woff2');
}

.material-symbols-outlined {
  font-family: 'Material Symbols Outlined', sans-serif;
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  overflow-wrap: normal;
  direction: ltr;
  font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}''')

for font_name, url, max_blocks in FONTS_TO_BUNDLE:
    print(f'Processing {font_name}...')
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req) as resp:
        css_content = resp.read().decode('utf-8')

    blocks = re.findall(r'@font-face\s*\{[^}]+\}', css_content)

    # Take the last max_blocks (Google Fonts puts Latin and Japanese Kana / common UI kanji at the end of the CSS)
    selected_blocks = blocks[-max_blocks:] if len(blocks) > max_blocks else blocks

    saved_count = 0
    for block in selected_blocks:
        src_match = re.search(r'src:\s*url\((https://[^\)]+\.woff2)\)', block)
        if not src_match:
            continue
        woff2_url = src_match.group(1)
        safe_name = font_name.lower().replace(' ', '_')
        filename = f"{safe_name}_{saved_count}.woff2"
        filepath = os.path.join(FONT_DIR, filename)

        if not os.path.exists(filepath):
            req_file = urllib.request.Request(woff2_url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(req_file) as f_in:
                data = f_in.read()
            with open(filepath, 'wb') as f_out:
                f_out.write(data)

        local_block = block.replace(woff2_url, f'../assets/fonts/{filename}')
        css_rules.append(local_block)
        saved_count += 1

    print(f'  Saved {saved_count} essential font files for {font_name}')

with open('shared/css/fonts.css', 'w', encoding='utf-8') as f:
    f.write('/* QuickLog-Solo: Local Font Face Definitions (Offline & MV3 CSP Compliant) */\n\n' + '\n\n'.join(css_rules) + '\n')

print('Updated shared/css/fonts.css successfully!')
