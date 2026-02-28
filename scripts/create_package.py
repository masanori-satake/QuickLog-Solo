import os
import zipfile
import json
import subprocess
import shutil

def create_zip(zip_filepath, includes, manifest_src):
    print(f"Creating package: {zip_filepath}")
    try:
        # Create a temporary directory to assemble the package
        temp_dir = "temp_package"
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        os.makedirs(temp_dir)

        # Copy all includes to temp_dir
        for item in includes:
            if item == "manifest.json":
                shutil.copy2(os.path.join("src", manifest_src), os.path.join(temp_dir, "manifest.json"))
                print(f"  Added: manifest.json (from src/{manifest_src})")
                continue

            src_path = os.path.join("src", item)
            if os.path.isdir(src_path):
                shutil.copytree(src_path, os.path.join(temp_dir, item))
                print(f"  Added: {item}/ (from src/{item})")
            elif os.path.isfile(src_path):
                shutil.copy2(src_path, os.path.join(temp_dir, item))
                print(f"  Added: {item} (from src/{item})")
            else:
                print(f"  Warning: {src_path} not found.")

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

    common_includes = [
        "app.html",
        "version.json",
        "js",
        "css",
        "assets",
        "manifest.json"
    ]

    # Chrome/Edge Package
    chrome_zip = os.path.join(dist_dir, f"{package_name}-Chrome.zip")
    success_chrome = create_zip(chrome_zip, common_includes, "manifest.chrome.json")

    # Firefox Package
    firefox_zip = os.path.join(dist_dir, f"{package_name}-Firefox.zip")
    success_firefox = create_zip(firefox_zip, common_includes, "manifest.firefox.json")

    if success_chrome and success_firefox:
        # Add the created zips to git
        print("Adding zip files to git...")
        subprocess.run(["git", "add", chrome_zip, firefox_zip], check=True)

        # Maintain a legacy QuickLog-Solo.zip for backward compatibility if needed,
        # or just use the Chrome one as default.
        # Here we copy Chrome one to the legacy name.
        legacy_zip = os.path.join(dist_dir, f"{package_name}.zip")
        shutil.copy2(chrome_zip, legacy_zip)
        subprocess.run(["git", "add", legacy_zip], check=True)

        return True
    return False

if __name__ == "__main__":
    if create_packages():
        exit(0)
    else:
        exit(1)
