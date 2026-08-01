# 詳細設計仕様書：背景アニメーション「レトロ表示モード」の追加

仕様バージョン: 1.0 (Creative & Engineering Edition)

## 1. はじめに・背景と目的

本ドキュメントは、作業メモツール `QuickLog-Solo` の背景アニメーション表示領域に対して、既存の物理演算や運動ロジックを一切破壊することなく、極めて没入感の高い3種類のレトロな画面表示エフェクトを追加するための詳細設計仕様書です。

### 追加する3種のモード
1. **レトロゲーム液晶 (Retro Game LCD)**：初代ゲームボーイのような緑がかった4階調反射型液晶。
2. **ブラウン管モニター (CRT Monitor)**：ネオングリーンまたはアンバーゴールドの走査線と残光を再現。
3. **ニキシー管 (Nixie Tube)**：ガス放電特有の暖かいオレンジ色のグロー効果とハニカムメッシュ・ガラス反射。

---

## 2. 現状の技術スタックと描画方式の確認

調査の結果、`QuickLog-Solo` の背景アニメーション描画システムは **HTML5 Canvas（キャンバス描画方式）** を採用していることが確認されました。

### 現状の描画フロー
1. 各アニメーションモジュールは、Web Worker (`animation_worker.js`) 内で座標・物理演算を実行します。
2. 演算結果（ドットの位置とサイズ）は、最終的に `drawResponse` メッセージを介してメインスレッドの `AnimationEngine` (`shared/js/animations.js`) に渡されます。
3. `AnimationEngine` の `_renderDots(dots)` メソッドが呼び出され、描画対象のキャンバス (`#animation-canvas`) に対して、以下の処理を実行します。
   - `this.ctx.clearRect(...)` による全面クリア。
   - `this.color` (M3カテゴリに応じたテーマカラー) を `fillStyle` に適用。
   - 各ドットを `this.ctx.fillRect(...)` で矩形描画。

前面のテキストやタイマー情報 (`#current-task-display-base`) は、このキャンバスの上に絶対配置 (Absolute Positioning) で重ね合わされています。

---

## 3. 採用するアプローチ：「ハイブリッド方式（アプローチB ＋ Aの融合）」

本実装では、最もビジュアルの再現性が高く安全な **「ハイブリッドアプローチ（フックでのパレット差し替え ＋ CSSフィルター＆オーバーレイ）」** を提案します。

### なぜハイブリッドなのか？
- **アプローチA (CSSフィルターのみ) の限界**：
  CSSの `hue-rotate` や `feColorMatrix` のみを用いた場合、現在アクティブなカテゴリ（M3テーマカラーの一次色・二次色など）によって元のドットの色が異なるため、相対的なフィルター効果では「絶対的な液晶の緑4階調」や「絶対的なニキシーオレンジ」を正確に固定することが困難です。
- **アプローチB (パレット差し替え) の長所**：
  Canvasの `_renderDots` 段階で、ドット色および背景クリア色をレトロパレットの絶対値に強制上書きすることで、どの業務カテゴリ（赤、紫、黄など）が選択されていても、100%正確な一貫した色彩を保証します。
- **CSSオーバーレイの長所**：
  走査線、グリッドパターン、ガラス反射ハイライト、高速フリッカー、ネオングローといった質感表現は、CSSの `linear-gradient` や `filter: drop-shadow`、`@keyframes` を用いることで、GPUアクセラレーションを活かした極めて滑らかでパフォーマンスに優れた演出が可能となります。

---

## 4. 各表示モードの仕様詳細

選択された表示モードに応じて、表示領域コンテナ (`#current-task-display`) にクラス名 `.retro-lcd`、`.retro-crt`、または `.retro-nixie` を付与します。

### ① レトロゲーム液晶 (Retro Game LCD)
- **Canvasレイヤー (アプローチB)**:
  - 背景色：`#9bbc0f` (最明：バックグラウンド)
  - ドットカラーの階調マッピング (明るさ/サイズに応じて段階的に適用)：
    - サイズ1 (小)：`#8bac0f` (明るい中間色)
    - サイズ2 (中)：`#306230` (暗い中間色)
    - サイズ3/4 (大)：`#0f380f` (最暗：シャドウ)
- **CSS・DOMレイヤー (アプローチA)**:
  - **ピクセルグリッド**：極薄の縦横格子を `linear-gradient` 背景を持つ疑似要素 (`::after`) で重ねる。
    ```css
    background: linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
    background-size: 6px 6px; /* CELL_SIZE (6) に完全同期 */
    ```
  - **質感フィルター**：コントラストを抑え、少しレトロな反射型液晶のマット感を再現。
    ```css
    filter: contrast(0.9) saturate(1.1);
    ```

### ② ブラウン管モニター (CRT Monitor)
- **Canvasレイヤー (アプローチB)**:
  - 背景色：`#030c04` (極めて暗い黒緑)
  - ドットカラー：`#33ff33` (蛍光グリーン)
- **CSS・DOMレイヤー (アプローチA)**:
  - **水平走査線 (Scanlines)**：
    ```css
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
    background-size: 100% 4px;
    ```
  - **残光・にじみ (Phosphor Glow)**：
    `#animation-canvas` に `filter: drop-shadow(0 0 4px rgba(51, 255, 51, 0.8))` を適用。
  - **ビネット & 湾曲 (Vignette & Curvature)**：
    コンテナの内側に、周辺減光グラデーションおよび緩やかな魚眼をイメージさせるシャドウ・角丸インナーフレームを重ねる。
    ```css
    box-shadow: inset 0 0 20px rgba(0,0,0,0.85);
    ```
  - **微小フリッカー (Flicker)**：
    ```css
    @keyframes crt-flicker {
        0%, 100% { opacity: 0.995; }
        50% { opacity: 1.0; }
    }
    animation: crt-flicker 0.15s infinite;
    ```

### ③ ニキシー管 (Nixie Tube)
- **Canvasレイヤー (アプローチB)**:
  - 背景色：`#0c0603` (サビ・金属感を伴う黒褐色)
  - ドットカラー：`#ff5500` (ネオン放電色：輝点中心には `#fff` や明るいオレンジをわずかに滲ませるか、グローにより輝かせる)
- **CSS・DOMレイヤー (アプローチA)**:
  - **多重プラズマ・グロウ**：
    `#animation-canvas` に重層的なドロップシャドウを適用し、ネオン放電の強力な発光感を再現。
    ```css
    filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px #ff5500) drop-shadow(0 0 12px #ff2a00);
    ```
  - **ガラスバルブ反射**：
    ガラス管を模した極薄の円弧状グラデーションハイライトを疑似要素で重ねる。
  - **ハニカム陽極網 (Anode Mesh)**：
    背景に極小の網目パターンを配し、フィラメントの背後にある網を表現。
    ```css
    background-image: radial-gradient(rgba(255,255,255,0.03) 15%, transparent 15%);
    background-size: 5px 5px;
    ```

---

## 5. 統合ロジックと実装設計

### 5.1. 設定項目（データ構造とUI）
1. `STORE_SETTINGS` に新しいキー `SETTING_KEY_DISPLAY_MODE` (値: `'displayMode'`) を定義します。
2. 選択可能な値：
   - `'normal'` (標準、デフォルト)
   - `'retro-lcd'` (レトロ液晶)
   - `'retro-crt'` (ブラウン管)
   - `'retro-nixie'` (ニキシー管)
3. 設定画面の一般 (General) タブに、「表示モード」選択 dropdown (`#display-mode-select`) を追加します。

### 5.2. UI（i18nと言語ファイル）
8つの全言語ファイル (`en.js`, `ja.js`, `de.js`, `es.js`, `fr.js`, `pt.js`, `ko.js`, `zh.js`) に対して、以下のリソースキーを追加します。
- `setting-display-mode`
- `display-mode-normal`
- `display-mode-retro-lcd`
- `display-mode-retro-crt`
- `display-mode-retro-nixie`
- `tooltip-display-mode-select`

### 5.3. スタイルシート (`projects/app/css/style.css`)
各レトロクラスに対応したCSS定義を追加します。
- `.retro-lcd`, `.retro-crt`, `.retro-nixie` クラス
- 各モード用の疑似要素 (`::before`, `::after`) による走査線、グリッド、ガラスハイライト、ハニカムネット、ビネットの重ね合わせ
- フリッカー用 `@keyframes` アニメーション
- 前面テキスト (`#current-task-display-base`) の読みやすさを確保するためのカラー調整

### 5.4. メインアプリケーション (`projects/app/js/app.js`)
- `syncState()` メソッド内で `displayMode` を取得し、`#current-task-display` のクラスリストへトグルします。
- `display-mode-select` の変更イベントを監視し、DBに保存の上、`syncState()` を呼び出して即座に描画に反映させます。

### 5.5. アニメーションエンジン (`shared/js/animations.js`)
`AnimationEngine` クラスに現在の `displayMode` を設定または参照できるようにし、`_renderDots(dots)` 内のクリア・描画ロジックを分岐・オーバーライドします。

```javascript
    _renderDots(dots) {
        if (!dots) return;
        const mode = this.displayMode || 'normal';

        // 1. 背景のクリア・塗りつぶし
        if (mode === 'retro-lcd') {
            this.ctx.fillStyle = '#9bbc0f';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (mode === 'retro-crt') {
            this.ctx.fillStyle = '#030c04';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (mode === 'retro-nixie') {
            this.ctx.fillStyle = '#0c0603';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 2. ドットの描画
        dots.forEach(dot => {
            const dotX = dot.x + (CELL_SIZE - dot.size) / 2;
            const dotY = dot.y + (CELL_SIZE - dot.size) / 2;

            if (mode === 'retro-lcd') {
                // 4階調マッピング
                if (dot.size === 4) this.ctx.fillStyle = '#0f380f'; // 最暗
                else if (dot.size === 3) this.ctx.fillStyle = '#306230'; // 暗い中間
                else this.ctx.fillStyle = '#8bac0f'; // 明るい中間
            } else if (mode === 'retro-crt') {
                this.ctx.fillStyle = '#33ff33'; // リン光グリーン
            } else if (mode === 'retro-nixie') {
                this.ctx.fillStyle = '#ff5500'; // ネオンオレンジ
            } else {
                this.ctx.fillStyle = this.color; // M3 カテゴリカラー
            }

            this.ctx.fillRect(dotX, dotY, dot.size, dot.size);
        });
    }
```

---

## 6. 保証事項

- **既存アニメーション運動ロジックの完全な維持**：
  物理演算、波紋、パーティクル、テトリス等のロジックには一切手を加えません。影響を受けるのは、最終的な「ドットの色」「背景色」「キャンバスに重なるCSSオーバーレイ」のみです。
- **M3カラーパレットとの調和**：
  レトロモードがOFF（標準モード）の時は、完全にオリジナルのM3カラーパレットおよび透過設定で動作し、一ミリのデグレも発生させません。
- **パフォーマンス保証**：
  CSS3のグラデーションや軽量フィルター (`drop-shadow`)、ハードウェアアクセラレーションを活用し、CPUやメモリに不要な負荷を与えません。

## 7. 免責事項 (Disclaimer)
本ソフトウェアは個人開発によるオープンソースプロジェクトであり、無保証です。利用により生じたいかなる損害についても、開発者は一切の責任を負いません。自己責任でご利用ください。
