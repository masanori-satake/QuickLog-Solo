import os
import zipfile
import json
import subprocess

def create_package():
    package_name = "QuickLog-Solo"
    dist_dir = "dist"
    zip_filename = f"{package_name}.zip"
    zip_filepath = os.path.join(dist_dir, zip_filename)

    # Files and directories to include in the package
    includes = [
        "manifest.json",
        "index.html",
        "version.json",
        "js",
        "css",
        "assets"
    ]

    if not os.path.exists(dist_dir):
        os.makedirs(dist_dir)

    print(f"Creating package: {zip_filepath}")

    try:
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for item in includes:
                if os.path.isdir(item):
                    for root, dirs, files in os.walk(item):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, os.getcwd())
                            zipf.write(file_path, arcname)
                            print(f"  Added: {arcname}")
                elif os.path.isfile(item):
                    zipf.write(item, item)
                    print(f"  Added: {item}")
                else:
                    print(f"  Warning: {item} not found.")

        print(f"Successfully created {zip_filepath}")

        # Add the created zip to git as requested (Choice A)
        print(f"Adding {zip_filepath} to git...")
        subprocess.run(["git", "add", zip_filepath], check=True)
        return True

    except Exception as e:
        print(f"Error creating package: {e}")
        return False

if __name__ == "__main__":
    if create_package():
        exit(0)
    else:
        exit(1)
