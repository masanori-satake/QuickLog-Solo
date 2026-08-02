# Spec ディレクトリ命名規則

## 連番プレフィックス

`.kiro/specs/` 配下の各 Spec ディレクトリには、作成順序を示す4桁の連番プレフィックスを付与する。

### 形式

```
.kiro/specs/{NNNN}_{feature-name}/
```

- `NNNN`: 0001 から始まる4桁のゼロ埋め連番
- `feature-name`: kebab-case の機能名

### ルール

1. 新しい Spec を作成する際は、既存の最大番号 + 1 を付与する
2. 番号は一度付与したら変更しない（削除しても欠番のまま残す）
3. 番号は作成順序の記録であり、実行優先度を意味しない

### 例

```
.kiro/specs/
├── 0001_repository-cleanup/
├── 0002_settings-panel-readonly/
├── 0003_settings-ui-polish/
└── 0004_backup-restore-maintenance-overhaul/
```
