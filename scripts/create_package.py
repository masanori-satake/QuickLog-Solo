import os
import zipfile
import json
import subprocess
import shutil

def create_zip(zip_filepath, includes, manifest_src, temp_dir, is_dev=False, version=""):
    print(f"Creating {'Dev ' if is_dev else ''}package: {zip_filepath}")
    try:
        # Create a temporary directory to assemble the package
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        os.makedirs(temp_dir)

        # Copy all includes to temp_dir
        for item in includes:
            if item == "manifest.json":
                manifest_dest = os.path.join(temp_dir, "manifest.json")
                shutil.copy2(os.path.join("src", manifest_src), manifest_dest)

                if is_dev:
                    with open(manifest_dest, 'r', encoding='utf-8') as f:
                        manifest_data = json.load(f)

                    # Add suffix and version to name for Dev builds
                    original_name = manifest_data.get("name", "QuickLog-Solo")
                    manifest_data["name"] = f"{original_name} (Dev v{version})"

                    with open(manifest_dest, 'w', encoding='utf-8') as f:
                        json.dump(manifest_data, f, indent=2, ensure_ascii=False)
                    print(f"  Modified manifest name: {manifest_data['name']}")

                print(f"  Added: manifest.json (from src/{manifest_src})")
                continue

            src_path = os.path.join("src", item)
            if os.path.isdir(src_path):
                def ignore_files(path, names):
                    ignored = []
                    # Exclude source SVG from all packages to ensure browser uses colored PNGs
                    if os.path.normpath(path).endswith('assets'):
                        if 'icon.svg' in names:
                            ignored.append('icon.svg')

                    # Physically exclude development-only animation modules from Release builds.
                    # Dev builds include all modules to facilitate support and verification.
                    if not is_dev and os.path.normpath(path).endswith(os.path.join('js', 'animation')):
                        for name in names:
                            full_path = os.path.join(path, name)
                            if os.path.isfile(full_path) and name.endswith('.js'):
                                with open(full_path, 'r', encoding='utf-8') as f:
                                    if 'devOnly: true' in f.read():
                                        ignored.append(name)
                    return ignored

                shutil.copytree(src_path, os.path.join(temp_dir, item), ignore=ignore_files)
                print(f"  Added: {item}/ (from src/{item})")
            elif os.path.isfile(src_path):
                shutil.copy2(src_path, os.path.join(temp_dir, item))
                print(f"  Added: {item} (from src/{item})")
            else:
                print(f"  Warning: {src_path} not found.")

        # For Dev builds, regenerate icons with orange branding (#ea580c) directly in the package
        if is_dev:
            print("  [Branding] Generating orange icons for Dev build...")
            dev_assets_dir = os.path.join(temp_dir, "assets")
            # Explicitly unset VERCEL env var during branding to ensure generation happens even in Vercel environment
            env = os.environ.copy()
            if 'VERCEL' in env:
                del env['VERCEL']
            subprocess.run(["python3", "scripts/generate_png_icons.py", dev_assets_dir, "#ea580c"], check=True, env=env)
            print("  [Branding] Orange PNG icons generated successfully.")

        # Final check for package hygiene
        print(f"  [Hygiene] Verifying {zip_filepath} content...")
        if os.path.exists(os.path.join(temp_dir, "assets", "icon.svg")):
             print("  [Hygiene] WARNING: icon.svg found in assembly dir. It should have been ignored.")
        else:
             print("  [Hygiene] icon.svg correctly excluded from package.")

        # Create zip from temporary directory
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)

        # Cleanup temporary assembly directory
        shutil.rmtree(temp_dir)

        print(f"Successfully created {zip_filepath}")
        return True
    except Exception as e:
        print(f"Error creating package {zip_filepath}: {e}")
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        return False

def create_packages():
    package_name = "QuickLog-Solo"
    dist_dir = "releases"

    if not os.path.exists(dist_dir):
        os.makedirs(dist_dir)

    # Load version from source
    with open("src/version.json", "r") as f:
        version = json.load(f).get("version", "unknown")

    common_includes = [
        "app.html",
        "version.json",
        "js",
        "css",
        "assets",
        "manifest.json"
    ]

    # --- Release Build Pipeline ---
    print("Generating production registry (excluding development animations)...")
    subprocess.run(["python3", "scripts/generate_animation_registry.py", "--exclude-dev"], check=True)

    # Create standard production packages
    chrome_zip = os.path.join(dist_dir, f"{package_name}-Chrome.zip")
    success_chrome = create_zip(chrome_zip, common_includes, "manifest.chrome.json", "temp_package_release_chrome")

    firefox_zip = os.path.join(dist_dir, f"{package_name}-Firefox.zip")
    success_firefox = create_zip(firefox_zip, common_includes, "manifest.firefox.json", "temp_package_release_firefox")

    # --- Dev Build Pipeline ---
    print("Generating development registry (including development animations)...")
    subprocess.run(["python3", "scripts/generate_animation_registry.py"], check=True)

    # Create development packages with branding and suffix
    chrome_dev_zip = os.path.join(dist_dir, f"{package_name}-Chrome-Dev.zip")
    success_chrome_dev = create_zip(chrome_dev_zip, common_includes, "manifest.chrome.json", "temp_package_dev_chrome", is_dev=True, version=version)

    firefox_dev_zip = os.path.join(dist_dir, f"{package_name}-Firefox-Dev.zip")
    success_firefox_dev = create_zip(firefox_dev_zip, common_includes, "manifest.firefox.json", "temp_package_dev_firefox", is_dev=True, version=version)

    # --- Post-Build Cleanup and Environment Restoration ---
    print("Restoring full development registry for local environment...")
    subprocess.run(["python3", "scripts/generate_animation_registry.py"], check=True)

    print("Restoring standard blue icons for local environment...")
    subprocess.run(["python3", "scripts/generate_png_icons.py"], check=True)

    if success_chrome and success_firefox and success_chrome_dev and success_firefox_dev:
        return True
    return False

if __name__ == "__main__":
    if create_packages():
        exit(0)
    else:
        exit(1)
