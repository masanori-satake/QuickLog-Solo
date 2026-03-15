import os
import zipfile
import json
import subprocess
import shutil

def create_zip(zip_filepath, manifest_src, temp_dir, is_dev=False, version=""):
    print(f"Creating {'Dev ' if is_dev else ''}package: {zip_filepath}")
    try:
        # Create a temporary directory to assemble the package
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        os.makedirs(temp_dir)

        # 1. Copy App Project Files
        app_dir = "projects/app"
        for item in os.listdir(app_dir):
            if item == "shared": continue # Skip symlink
            src_path = os.path.join(app_dir, item)

            if item.startswith("manifest."):
                if item == manifest_src:
                    manifest_dest = os.path.join(temp_dir, "manifest.json")
                    shutil.copy2(src_path, manifest_dest)

                    if is_dev:
                        with open(manifest_dest, 'r', encoding='utf-8') as f:
                            manifest_data = json.load(f)
                        original_name = manifest_data.get("name", "QuickLog-Solo")
                        manifest_data["name"] = f"{original_name} (Dev v{version})"
                        with open(manifest_dest, 'w', encoding='utf-8') as f:
                            json.dump(manifest_data, f, indent=2, ensure_ascii=False)
                        print(f"  Modified manifest name: {manifest_data['name']}")
                continue

            if os.path.isdir(src_path):
                shutil.copytree(src_path, os.path.join(temp_dir, item))
            else:
                shutil.copy2(src_path, os.path.join(temp_dir, item))

        # 2. Copy Shared Files (Merge into 'shared' directory in ZIP)
        shared_dest = os.path.join(temp_dir, "shared")
        os.makedirs(shared_dest)

        def ignore_shared(path, names):
            ignored = []
            if os.path.normpath(path).endswith('assets'):
                if 'icon.svg' in names: ignored.append('icon.svg')
                if 'guide' in names: ignored.append('guide')
                if 'badges' in names: ignored.append('badges')

            if not is_dev and os.path.normpath(path).endswith(os.path.join('js', 'animation')):
                for name in names:
                    full_path = os.path.join(path, name)
                    if os.path.isfile(full_path) and name.endswith('.js'):
                        with open(full_path, 'r', encoding='utf-8') as f:
                            if 'devOnly: true' in f.read():
                                ignored.append(name)
            return ignored

        shutil.copytree("shared", shared_dest, ignore=ignore_shared, dirs_exist_ok=True)

        # For Dev builds, regenerate icons with orange branding
        if is_dev:
            print("  [Branding] Generating orange icons for Dev build...")
            dev_assets_dir = os.path.join(shared_dest, "assets")
            env = os.environ.copy()
            if 'VERCEL' in env: del env['VERCEL']
            subprocess.run(["python3", "scripts/generate_png_icons.py", dev_assets_dir, "#ea580c"], check=True, env=env)

        # Create zip from temporary directory
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)

        shutil.rmtree(temp_dir)
        print(f"Successfully created {zip_filepath}")
        return True
    except Exception as e:
        print(f"Error creating package {zip_filepath}: {e}")
        if os.path.exists(temp_dir): shutil.rmtree(temp_dir)
        return False

def create_packages():
    package_name = "QuickLog-Solo"
    dist_dir = "releases"
    if not os.path.exists(dist_dir): os.makedirs(dist_dir)

    with open("projects/app/version.json", "r") as f:
        version = json.load(f).get("version", "unknown")

    # --- Release Build Pipeline ---
    print("Generating production registry...")
    subprocess.run(["python3", "scripts/generate_animation_registry.py", "--exclude-dev"], check=True)

    chrome_zip = os.path.join(dist_dir, f"{package_name}-Chrome.zip")
    success_chrome = create_zip(chrome_zip, "manifest.chrome.json", "temp_package_release_chrome")

    firefox_zip = os.path.join(dist_dir, f"{package_name}-Firefox.zip")
    success_firefox = create_zip(firefox_zip, "manifest.firefox.json", "temp_package_release_firefox")

    # --- Dev Build Pipeline ---
    print("Generating development registry...")
    subprocess.run(["python3", "scripts/generate_animation_registry.py"], check=True)

    chrome_dev_zip = os.path.join(dist_dir, f"{package_name}-Chrome-Dev.zip")
    success_chrome_dev = create_zip(chrome_dev_zip, "manifest.chrome.json", "temp_package_dev_chrome", is_dev=True, version=version)

    firefox_dev_zip = os.path.join(dist_dir, f"{package_name}-Firefox-Dev.zip")
    success_firefox_dev = create_zip(firefox_dev_zip, "manifest.firefox.json", "temp_package_dev_firefox", is_dev=True, version=version)

    # Restoration
    subprocess.run(["python3", "scripts/generate_animation_registry.py"], check=True)
    subprocess.run(["python3", "scripts/generate_png_icons.py"], check=True)

    return success_chrome and success_firefox and success_chrome_dev and success_firefox_dev

if __name__ == "__main__":
    if create_packages(): exit(0)
    else: exit(1)
