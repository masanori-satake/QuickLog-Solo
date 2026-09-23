import os
import zipfile
import json
import subprocess
import shutil

def create_zip(zip_filepath, temp_dir):
    print(f"Creating package: {zip_filepath}")
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

            if os.path.normpath(path).endswith(os.path.join('js', 'animation')):
                for name in names:
                    full_path = os.path.join(path, name)
                    if os.path.isfile(full_path) and name.endswith('.js'):
                        with open(full_path, 'r', encoding='utf-8') as f:
                            if 'devOnly: true' in f.read():
                                ignored.append(name)
            return ignored

        shutil.copytree("shared", shared_dest, ignore=ignore_shared, dirs_exist_ok=True)

        # 3. Copy Subprojects (animation-maker, category-editor & alarm-editor)
        for subproj in ["animation-maker", "category-editor", "alarm-editor"]:
            subproj_src = os.path.join("projects", subproj)
            subproj_dest = os.path.join(temp_dir, "projects", subproj)
            os.makedirs(subproj_dest, exist_ok=True)
            for item in os.listdir(subproj_src):
                if item == "shared":
                    # Copy shared/ contents to this project's shared/ folder
                    dest_shared = os.path.join(subproj_dest, "shared")
                    shutil.copytree("shared", dest_shared, ignore=ignore_shared, dirs_exist_ok=True)
                else:
                    src_path = os.path.join(subproj_src, item)
                    if os.path.isdir(src_path):
                        shutil.copytree(src_path, os.path.join(subproj_dest, item))
                    else:
                        shutil.copy2(src_path, os.path.join(subproj_dest, item))

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

    chrome_zip = os.path.join(dist_dir, f"{package_name}-v{version}.zip")
    success_chrome = create_zip(chrome_zip, "temp_package_release_chrome")

    # Restoration
    subprocess.run(["python3", "scripts/generate_animation_registry.py"], check=True)
    subprocess.run(["python3", "scripts/generate_png_icons.py"], check=True)

    return success_chrome

if __name__ == "__main__":
    if create_packages(): exit(0)
    else: exit(1)
