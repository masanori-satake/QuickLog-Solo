# 依頼: QuickLog-Solo の GitHub Actions を common-workflows(@v1) へ移行

あなたは QuickLog-Solo リポジトリの開発を担当します。同一作者（masanori-satake）の `-Solo` シリーズ Chrome 拡張機能群では、CI/CD を共通ワークフロー基盤 **`masanori-satake/common-workflows`（`@v1` タグ追従）** に統一する移行を進めており、既に **ServiceRoute / FlexPaste / ActionsBoard / OmniView / Replace / TabMagnet / Issues / DeskDeck** の8プロジェクトが移行完了しています。**最後に残った QuickLog-Solo を移行してください。**

QuickLog-Solo は `-Solo` シリーズの中で最も複雑（Vite ビルド、アニメーションレジストリ自動生成、Chrome/Dev の2種ZIP、Vercel デプロイ、ガイドスクショ自動生成など）です。**安易に他プロジェクトのコピーを当てはめず、下記の固有事情を必ず考慮してください。**

---

## 0. 厳守事項（対話・言語・ブランチ）

- **ディーププランニングモード**: 変更前に要件を完全に理解し、不確実性がゼロになるまで質問を続けること。前提・期待結果をユーザーに確認し、計画承認後に自律実行する（AGENTS.md の運用指示に従う）。
- **言語**: ユーザーとの対話、PR タイトル・説明、コミットメッセージ（`feat:` 等のプレフィックス以降）はすべて **日本語**。コード内コメントは英語で可。`submit` 前に `scripts/language_check.py` で日本語を含むことを確認。
- **ブランチ運用**: `main` への直接コミットは禁止。`chore/migrate-common-workflows` のような feature ブランチを作成し、PR 経由でマージする。
- **バージョンバンプ**: `projects/app/` または `shared/` を変更した場合のみ `python3 scripts/bump_version.py` でバンプが必要。**今回はワークフローとスクリプト中心の変更なので、`projects/app/`・`shared/` の実体を変更しないならバンプ不要**（判断はユーザーに確認）。
- **正典**: `docs/spec.md` と `AGENTS.md` が設計の正典。矛盾する変更をしない。

---

## 1. 移行のゴール

`.github/workflows/` の自前実装を common-workflows(@v1) の再利用可能ワークフロー呼び出しへ置き換え、他 `-Solo` とパラメータ・カバレッジ・リリースZIP名を統一する。ただし QuickLog 固有のビルド（Vite・アニメーションレジストリ・2種ZIP・Vercel）は壊さないこと。

### common-workflows が提供する再利用可能ワークフロー（呼び出し方）

```yaml
uses: masanori-satake/common-workflows/.github/workflows/base-ci.yml@v1
uses: masanori-satake/common-workflows/.github/workflows/base-security.yml@v1
uses: masanori-satake/common-workflows/.github/workflows/base-coverage.yml@v1
uses: masanori-satake/common-workflows/.github/workflows/base-deploy-pages.yml@v1
uses: masanori-satake/common-workflows/.github/workflows/base-version-bump.yml@v1
uses: masanori-satake/common-workflows/.github/workflows/base-release.yml@v1
```

各 base ワークフローの主な仕様（他 `-Solo` の移行で確定済み）:

- **base-ci.yml**: 入力 `run_typecheck`/`run_lint`/`run_test`（既定 true）, `install_command`。Node=`lts/*`、Python=`3.12`、依存は lockfile 有無で `npm ci`/`npm install` 自動判定。**`scripts/ci_checks.py` が存在すれば自動実行**。`requirements.txt` があれば `pip install -r requirements.txt`、`requirements.txt` に `playwright` が含まれれば chromium もインストール。最後に `npm run typecheck/lint/test/build --if-present` を実行。
- **base-security.yml**: `npm audit`（high 以上）+ OSV-Scanner。パラメータは base 側に閉じ込め済み、`with:` 不要。
- **base-coverage.yml**: `npm run coverage` を実行し `coverage/coverage-summary.json`（json-summary 形式）を集計、PR に sticky コメント。入力 `min_coverage`（既定 0）。**第三者 action 非依存**（gh でコメント）。
- **base-deploy-pages.yml**: `projects/web` を GitHub Pages へ公開（`publish_dir` 既定 = `projects/web`）。
- **base-version-bump.yml**: PR で `projects/app/**` 変更時、`projects/app/manifest.json` の version が base ブランチから上がっているか jq で検証。
- **base-release.yml**: タグ `v*.*.*` push で起動する想定。**方式A**（`package_source_dir` 指定時に `{リポジトリ名}-v{version}.zip` を生成）。入力 `package_source_dir`, `manifest_rename`("元:新"), `generate_icons`(bool), `icon_svg_path`, `icon_output_dir`, `release_files`（既定 `releases/*.zip`）。**`package_source_dir` を空にすると従来方式で `release_files`（既定 `releases/*.zip`）を Release へ添付する。**

> 補足: base-ci / base-coverage は **`npm ci`（`--legacy-peer-deps` なし）** を使う。QuickLog の `package-lock.json` で peer 依存競合があると `npm ci` が失敗するため、事前に `npm ci` がクリーンに通ることを必ず確認すること（Issues-Solo では `jest-chrome` が競合して除去が必要だった前例あり）。

---

## 2. QuickLog-Solo の現状（重要・固有事情）

### 既存ワークフロー（5本、すべて自前実装）
- `tests-and-lint.yml`: Python 静的チェック（check_root_files / verify_project_policies / check_version / verify_version_impact / audit_production_dependencies）、ESLint、Stylelint、Jest（**tj-actions/changed-files による差分限定実行**、カバレッジは `ArtiomTr/jest-coverage-report-action@v2` で PR コメント）、E2E（Playwright + `python3 -m http.server 8080`）、アニメーション品質テスト。
- `osv-scan.yml`: OSV-Scanner のみ（npm audit なし）。
- `release_extension_packages.yml`: タグ `v*.*.*` push で `npm run build` → `releases/*.zip`（Chrome版・Dev版の2種）を draft Release にアップロードして公開。
- `release_web_deploy.yml`: `main` push で `npm run build` → `dist_web/` を組み立てて **Vercel** にデプロイ（`amondnet/vercel-action`、シークレット `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`）。
- `update_guide_screenshots.yml`: 手動トリガーでガイド用スクショ生成 → PR 作成。
- 自前 composite action `.github/actions/setup-and-install`（Node セットアップ + `npm ci` + 任意で Playwright）。

### ビルド・スクリプトの固有事情（ここが他 Solo と大きく異なる）
- **`npm run build`** = `generate_png_icons.py` → `generate_animation_registry.py` → `check_version.py` → `create_package.py` → `vite build`。**単純な ZIP 化ではない。**
- **`create_package.py`** が **2種の ZIP** を生成: `QuickLog-Solo-v{version}.zip`（Chrome/本番、devOnly アニメ除外）と `QuickLog-Solo-Dev-v{version}.zip`（Dev、manifest 名に "(Dev vX)" 付与・固定 key 追加・オレンジアイコン）。ZIP には `projects/app` + `shared/` + サブプロジェクト（animation-maker/category-editor/alarm-editor）を含む複雑な構成。
- **バージョンの真実の源は `projects/app/version.json`**（`package.json` の version ではない箇所がある）。`create_package.py` は version.json を読む。一方 `package.json` にも version がある。**base-version-bump は `projects/app/manifest.json` を見る**が、QuickLog は **`manifest.chrome.json`** を使う（`manifest.json` が存在しない可能性）。ここは要確認・要調整。
- **manifest は `projects/app/manifest.chrome.json`**（`create_package.py` が ZIP 内で `manifest.json` にリネームしている）。
- **アイコンは `shared/assets/icon.svg` → `shared/assets/icon*.png`**（出力先が `shared/assets`。他 Solo の `projects/app/icons` とは異なる）。
- **`requirements.txt` あり**（Python 依存: playwright 等）。
- **テスト**: `npm test` は `generate_animation_registry.py` → `verify_animations.py` → `jest`（ESM）。**Jest 実行前にアニメーションレジストリ生成が必須**。E2E も同様。
- **Vite ビルド**（`vite build`）が本番成果物の一部。
- **`.github/actions/setup-and-install`** を全ワークフローが使用。

---

## 3. 事前に必ず確認・調査すべきこと（質問 or 調査）

以下は QuickLog 固有の判断が必要な点。**推測で進めず、コードを読んで事実確認し、不明点はユーザーに質問すること。**

1. **`npm ci` がクリーンに通るか**（peer 依存競合の有無）。通らなければ根本原因を特定し、解消方針をユーザーに確認。
2. **base-version-bump が見る `projects/app/manifest.json` が存在するか**。QuickLog は `manifest.chrome.json` 運用。存在しない場合、base-version-bump の入力 `manifest_path`（もしあれば）で `manifest.chrome.json` を指すか、あるいは version-bump は QuickLog 独自の `verify_version_impact.py` を `ci_checks.py` 側に残すか、ユーザーと相談。
3. **カバレッジ**: 現状は差分限定 Jest + 第三者 action。base-coverage は `npm run coverage`（json-summary）前提。QuickLog に `coverage` スクリプトがない・Jest 設定が json-summary 未対応なら、`package.json` に `coverage`（例: `jest --coverage --coverageReporters=json-summary` 相当。ただしアニメーションレジストリ生成の前段が必要）を追加する必要がある。**差分限定実行はやめて全件実行へ統一する方針**（他 Solo と揃える）でよいかユーザーに確認。
4. **E2E・アニメーション品質テストの扱い**: 他 Solo では E2E を CI から外した（統一方針）。QuickLog も E2E/animation-eval を CI から外すか、残すかをユーザーに確認（Playwright + ローカルサーバ + レジストリ生成が必要で重い）。
5. **リリース（2種ZIP）**: base-release の方式A は単一 ZIP を `projects/app` から作る前提。QuickLog は `create_package.py` が **2種ZIP**を独自構成で作る。**方式A に載せると Chrome/Dev の2種や shared・サブプロジェクト同梱が壊れる**。→ **リリースは QuickLog 独自の `create_package.py` を維持し、base-release は `package_source_dir` を空にして `release_files: 'releases/*.zip'` で「`npm run build` が生成した releases/*.zip を添付するだけ」に留める**構成が現実的。この方針でよいかユーザーに確認。
6. **Vercel デプロイ**: base-deploy-pages は GitHub Pages 向け。QuickLog は **Vercel** デプロイ（`release_web_deploy.yml`）。common-workflows に Vercel 用 base はない。→ **Vercel デプロイは QuickLog 独自ワークフローとして維持**するのが妥当（Pages へ移すのは別判断）。ユーザーに確認。
7. **ガイドスクショ更新ワークフロー**（`update_guide_screenshots.yml`）: 共通化対象外。**そのまま維持**でよいか確認。
8. **アイコン出力先** `shared/assets`（他 Solo は `projects/app/icons`）。generate-icons 共通 action を使うなら `icon_output_dir` を `shared/assets` に、`icon_svg_path` を `shared/assets/icon.svg` に指定する必要がある。ただし QuickLog は Dev 版でオレンジ色アイコンを別生成するなど独自処理があるため、**アイコン生成はローカル `generate_png_icons.py` を維持**するのが無難。ユーザーに確認。

---

## 4. 推奨する移行方針（要ユーザー承認）

他 Solo の実績を踏まえた推奨案。**QuickLog は「共通化できる部分だけ base に寄せ、独自ビルド/デプロイは維持する」ハイブリッド**を推奨:

- **共通化する（base 呼び出しに置換）**:
  - `code-quality.yml`（base-ci）: `run_typecheck: false`。lint（eslint+stylelint）と test（jest）は `npm run lint`/`npm run test` で base-ci から実行。Python 検証は **`scripts/ci_checks.py` を新設**して集約（check_root_files / verify_project_policies / check_version / audit_production_dependencies。verify_version_impact は base-version-bump へ委譲するか要相談）。**差分限定をやめて全件実行**。
  - `security-scan.yml`（base-security）: npm audit + OSV に統一（現状 OSV のみ → npm audit 追加。脆弱性が出たら devDeps を修正）。
  - `coverage.yml`（base-coverage）: `npm run coverage` を用意できる場合のみ。用意が難しい/重い場合はユーザーと相談のうえ見送り可。
  - `version-bump.yml`（base-version-bump）: manifest パスの整合を取れる場合のみ。取れない場合は独自維持。
- **独自維持する（common-workflows に寄せない）**:
  - リリース（2種ZIP、`create_package.py` + Vite）: `release_extension_packages.yml` は温存、または base-release を `release_files: 'releases/*.zip'`＋独自 build ステップで薄く包む。
  - Vercel デプロイ（`release_web_deploy.yml`）: 温存。
  - ガイドスクショ（`update_guide_screenshots.yml`）: 温存。
  - アイコン生成（`generate_png_icons.py`、Dev オレンジ含む）: 温存。
- **削除**: 自前 `.github/actions/setup-and-install`（base 側に集約できた範囲のみ。独自維持ワークフローが使い続けるなら残す — 要判断）。

> **重要**: 「全部を base に寄せる」ことが目的ではなく、「他 Solo と揃えられる品質ゲート（CI/セキュリティ）を統一しつつ、QuickLog 固有のビルド・配布を壊さない」ことがゴール。過度な共通化で Vite/2種ZIP/Vercel を破壊しないこと。

---

## 5. 作業手順（承認後）

1. `main` を最新化し `chore/migrate-common-workflows` ブランチを作成。
2. `scripts/ci_checks.py` を新設（Python から各チェックを `subprocess.run(..., check=False)` で順に実行。TabMagnet/Issues/DeskDeck と同じパターン。**shebang は付けない、`subprocess.run` には `check=False` を明示** — ruff の EXE001/PLW1510 を避けるため）。
3. 承認された方針に沿って `.github/workflows/` を再構成（共通化するものは base 呼び出しへ、独自維持するものはそのまま）。
4. `package.json` のスクリプトを必要に応じて調整（`coverage` 追加、lint の統合など）。base-ci は `npm run lint/test/build --if-present` を呼ぶ点に注意（`build` が Vite/2種ZIP まで走ると CI が重くなる・失敗しうるので、CI で `npm run build` を走らせたくない場合は base-ci の挙動を踏まえた設計にする）。
5. **ローカル検証**を必ず実施:
   - `npm ci`（クリーンに通ること・脆弱性ゼロ）
   - `npm test`（アニメーションレジストリ生成 → jest がパス）
   - `npm run lint`（eslint + stylelint）
   - `python3 scripts/ci_checks.py`（新設した集約チェックがパス）
   - リリース系を変えた場合は `npm run build` で2種ZIPが従来通り生成されることを確認
6. コミット（UTF-8 メッセージは `git commit -F <file>` を使う。`-m` は環境により文字化けするため）→ push → `gh pr create --body-file`（日本語タイトル・本文）。
7. CI 結果を確認（base CI / security / coverage / pre-commit.ci / CodeRabbit）。**pre-commit.ci が ruff/prettier/stylelint で自動修正コミットを push することがある**ので、その場合はローカルを `git pull`（または `git reset --hard origin/<branch>`）してから追随する。
8. `scripts/language_check.py` で PR タイトル・本文に日本語が含まれることを確認。

---

## 6. 既知の落とし穴（他 Solo 移行で踏んだもの）

- **`npm ci` の peer 依存競合**: 競合があると base-ci/base-coverage が即失敗する。事前にローカルで `npm ci` を通すこと。
- **`scripts/ci_checks.py` の ruff 指摘**: shebang（EXE001）と `subprocess.run` の `check` 省略（PLW1510）は pre-commit.ci(ruff) で落ちる。最初から shebang なし・`check=False` で書く。
- **改行コード（CRLF）**: prettier/stylelint がローカル Windows(CRLF) で全ファイル警告を出すことがあるが、CI(Linux/LF) では通ることが多い。ローカル警告に振り回されず、CI の結果で判断する。
- **バージョン不整合**: QuickLog は `version.json` / `package.json` / `manifest.chrome.json` / README バッジ など複数箇所に version がある。`check_version.py` が全整合を検証するので、バンプ時は `bump_version.py` で一括更新する。
- **アニメーションレジストリ**: `generate_animation_registry.py` を先に走らせないと jest/e2e が失敗する。CI の各テストステップの前段でレジストリ生成が必要。
- **CI で `npm run build` を走らせる是非**: base-ci は末尾で `npm run build --if-present` を実行する。QuickLog の `build` は Vite + 2種ZIP + アイコン生成まで走り重く、Playwright 等も絡む。**base-ci に build を走らせたくない場合は、`build` スクリプトの内容や base-ci の呼び出し方を工夫する**（例: CI 用に build を空にはできないので、リリース専用フローに寄せる等）。ここは設計上の要注意ポイント。

---

## 7. 参考: 他 `-Solo` の呼び出し側ワークフロー例（DeskDeck-Solo）

```yaml
# code-quality.yml
jobs:
  ci:
    uses: masanori-satake/common-workflows/.github/workflows/base-ci.yml@v1
    with:
      run_typecheck: false

# security-scan.yml
jobs:
  security:
    uses: masanori-satake/common-workflows/.github/workflows/base-security.yml@v1

# version-bump.yml
jobs:
  version-bump:
    uses: masanori-satake/common-workflows/.github/workflows/base-version-bump.yml@v1
```

`scripts/ci_checks.py` の雛形（DeskDeck-Solo の実装）:

```python
"""共通CIポリシーチェックの単一エントリ."""
import subprocess
import sys

CHECKS = [
    ("ルート整合性 (Root Cleanliness)", ["python3", "scripts/check_root_files.py"]),
    ("プロジェクトポリシー (Project Policy)", ["python3", "scripts/verify_project_policies.py"]),
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
```

---

## 8. 完了条件（Definition of Done）

- 共通化対象のワークフローが common-workflows(@v1) 呼び出しに置き換わっている。
- QuickLog 固有のビルド（Vite・2種ZIP）、Vercel デプロイ、ガイドスクショ、アイコン生成が壊れていない。
- ローカルで `npm ci` / `npm test` / `npm run lint` / `scripts/ci_checks.py` がパスする。
- PR の全 CI（base CI / security / coverage(採用時) / pre-commit.ci / CodeRabbit）がグリーン。
- PR タイトル・本文・コミットメッセージが日本語で、`language_check.py` を通過する。
- `docs/spec.md`・`AGENTS.md` の設計思想に反していない。

まずは上記「3. 事前に確認すべきこと」を調査し、「4. 推奨方針」への同意可否と各論点の判断をユーザーに確認するところから始めてください。
