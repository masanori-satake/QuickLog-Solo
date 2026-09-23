"""共通CIポリシーチェックの単一エントリ."""
import subprocess
import sys

CHECKS = [
    ("ルート整合性 (Root Cleanliness)", ["python3", "scripts/check_root_files.py"]),
    ("プロジェクトポリシー (Project Policy Guard)", ["python3", "scripts/verify_project_policies.py"]),
    ("バージョン整合性 (Version Consistency)", ["python3", "scripts/check_version.py"]),
    ("依存関係ゼロ確認 (No Production Dependencies)", ["python3", "scripts/audit_production_dependencies.py"]),
]

def main() -> int:
    failed = []
    for label, command in CHECKS:
        print(f"::group::{label}")
        result = subprocess.run(command, check=False)
        print("::endgroup::")
        if result.returncode != 0:
            failed.append(label)
    if failed:
        print("::error::以下のチェックに失敗しました: " + ", ".join(failed))
        return 1
    print("すべてのCIポリシーチェックに合格しました。")
    return 0

if __name__ == "__main__":
    sys.exit(main())
