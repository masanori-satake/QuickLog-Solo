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

                    # Update name for Dev version
                    original_name = manifest_data.get("name", "QuickLog-Solo")
                    manifest_data["name"] = f"{original_name} (Dev v{version})"

                    with open(manifest_dest, 'w', encoding='utf-8') as f:
                        json.dump(manifest_data, f, indent=2, ensure_ascii=False)
                    print(f"  Modified manifest name: {manifest_data['name']}")

                print(f"  Added: manifest.json (from src/{manifest_src})")
                continue

            src_path = os.path.join("src", item)
            if os.path.isdir(src_path):
                def ignore_dev_only(path, names):
                    ignored = []
                    # Only ignore modules inside src/js/animation/ if NOT a dev build
                    # Wait, if it IS a dev build, we might want to keep them?
                    # But the requirement says "Existing zip should be safe as before".
                    # For Dev ZIP, maybe we want dev animations too?
                    # The user didn't explicitly ask for dev animations in Dev ZIP,
                    # but usually Dev ZIP should have Dev features.
                    # However, to be "safe", let's follow the registry exclusion.

                    if not is_dev and os.path.normpath(path).endswith(os.path.join('js', 'animation')):
                        for name in names:
                            full_path = os.path.join(path, name)
                            if os.path.isfile(full_path) and name.endswith('.js'):
                                with open(full_path, 'r', encoding='utf-8') as f:
                                    if 'devOnly: true' in f.read():
                                        ignored.append(name)
                    return ignored

                shutil.copytree(src_path, os.path.join(temp_dir, item), ignore=ignore_dev_only)
                print(f"  Added: {item}/ (from src/{item})")
            elif os.path.isfile(src_path):
                shutil.copy2(src_path, os.path.join(temp_dir, item))
                print(f"  Added: {item} (from src/{item})")
            else:
                print(f"  Warning: {src_path} not found.")

        # If it's a dev build, regenerate icons with orange color directly into the temp_dir
        if is_dev:
            print("  Generating orange icons for Dev build...")
            dev_assets_dir = os.path.join(temp_dir, "assets")
            # Call generate_png_icons.py logic
            # Use the orange color #ea580c as requested
            subprocess.run(["python3", "scripts/generate_png_icons.py", dev_assets_dir, "#ea580c"], check=True)

        # Create zip from temp_dir
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)

        # Cleanup temp_dir
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

    # Get version
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

    # --- Release Build ---
    print("Generating production registry (excluding development animations)...")
    subprocess.run(["python3", "scripts/generate_animation_registry.py", "--exclude-dev"], check=True)

    # Chrome/Edge Release
    chrome_zip = os.path.join(dist_dir, f"{package_name}-Chrome.zip")
    success_chrome = create_zip(chrome_zip, common_includes, "manifest.chrome.json", "temp_package_release_chrome")

    # Firefox Release
    firefox_zip = os.path.join(dist_dir, f"{package_name}-Firefox.zip")
    success_firefox = create_zip(firefox_zip, common_includes, "manifest.firefox.json", "temp_package_release_firefox")

    # --- Dev Build ---
    # For Dev build, we might want to include dev animations.
    # Let's regenerate registry with dev animations.
    print("Generating development registry (including development animations)...")
    subprocess.run(["python3", "scripts/generate_animation_registry.py"], check=True)

    # Chrome Dev
    chrome_dev_zip = os.path.join(dist_dir, f"{package_name}-Chrome-Dev.zip")
    success_chrome_dev = create_zip(chrome_dev_zip, common_includes, "manifest.chrome.json", "temp_package_dev_chrome", is_dev=True, version=version)

    # Firefox Dev
    firefox_dev_zip = os.path.join(dist_dir, f"{package_name}-Firefox-Dev.zip")
    success_firefox_dev = create_zip(firefox_dev_zip, common_includes, "manifest.firefox.json", "temp_package_dev_firefox", is_dev=True, version=version)

    # Restore full development registry for local environment
    print("Restoring full development registry...")
    subprocess.run(["python3", "scripts/generate_animation_registry.py"], check=True)

    # Restore standard blue icons for local environment (safety first)
    print("Restoring standard blue icons...")
    subprocess.run(["python3", "scripts/generate_png_icons.py"], check=True)

    if success_chrome and success_firefox and success_chrome_dev and success_firefox_dev:
        return True
    return False

if __name__ == "__main__":
    if create_packages():
        exit(0)
    else:
        exit(1)
