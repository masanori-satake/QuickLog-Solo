# Vercel への自動デプロイ方法（推奨）

本アプリは静的ファイルのみで構成されているため、Vercel の無料プランで簡単にホストできます。GitHub Actions を使用して、プッシュ時に自動デプロイする設定手順は以下の通りです。

#### 1. Vercel での準備
1. [Vercel](https://vercel.com/) にログインし、新しいプロジェクトを作成します（GitHub リポジトリをインポート）。
   - 「Import Git Repository」から本リポジトリを選択します。
   - Framework Preset は「Other」を選択（静的HTMLのみのため自動認識されます）。
2. Vercel のプロジェクト設定およびアカウント設定から以下の情報を取得します：
   - **Project ID**: プロジェクトの **Settings** > **General** セクションに記載されています。
   - **Org ID**: アカウントの種類によって項目名が異なります。
     - **個人アカウント (Hobbyプラン)** の場合: アカウントの **Settings** > **General** にある **Personal Account ID** を使用します。
     - **チームアカウント** の場合: チームの **Settings** > **General** にある **Team ID** を使用します。
3. Vercel の **Account Settings** > **Tokens** で、新しい **Access Token** を発行します（名前は任意）。

#### 2. GitHub リポジトリでの設定
1. GitHub リポジトリの **Settings** > **Secrets and variables** > **Actions** を開きます。
2. **New repository secret** をクリックし、以下の3つを追加します（**Name** に以下の文字列を、**Secret** に取得した値を入力します）：
   - `VERCEL_TOKEN`: 発行した Access Token（`vcp_` で始まる文字列。**そのまま全て**入力してください）
   - `VERCEL_ORG_ID`: 取得した Org ID
   - `VERCEL_PROJECT_ID`: 取得した Project ID

   > **注意:**
   > - トークンの先頭にある `vcp_` は Vercel の新しいトークン形式のプレフィックスであり、正常なものです。削除せずにそのまま入力してください。
   > - コピー＆ペースト時に前後に**余計なスペースや改行**が入らないようご注意ください。
   > - シークレットの「Name」にはスペースやハイフン（`-`）は使用できません。必ず上記通りのアンダースコア（`_`）を含んだ名称にしてください。

#### 3. 自動デプロイの実行
- `main` ブランチにプッシュすると、`.github/workflows/deploy.yml` が実行され、自動的に Vercel へデプロイされます。
- デプロイ完了後、Vercel から提供される URL にアクセスすると PWA として「インストール」が可能になります。
