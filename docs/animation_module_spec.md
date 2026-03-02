# 時間経過アニメーション モジュール I/F 仕様書

## 1. 目的
QuickLog-Solo の背景アニメーション機能をモジュール化し、外部開発者が独自のアニメーションロジックを追加・修正できるようにするためのインターフェース（I/F）を定義する。
本仕様は、「表現の自由度」と「開発のしやすさ（低ハードル）」の両立を目指す。

## 2. システム構成と役割分担

### 2.1. ディレクトリ構造と自動登録
アニメーションモジュールは `src/js/animation/` ディレクトリに個別のファイルとして格納されます。
ビルドプロセスにおいて、`scripts/generate_animation_registry.py` がこれらのファイルをスキャンし、`src/js/animation_registry.js` を自動生成します。
これにより、コアモジュールを修正することなく、新しいアニメーションを追加・削除することが可能です。

### 2.2. ライフサイクル・シーケンス図

#### アニメーション一覧の取得 (Metadata Discovery)
ユーザーが設定画面を開いた際など、インスタンス化の前にモジュールの情報を取得するフローです。
```mermaid
sequenceDiagram
    participant C_Disc as QuickLog 本体 (Core)
    participant R_Disc as animation_registry.js
    participant M_Disc as アニメーションモジュール (Class)

    C_Disc->>R_Disc: animations 配列を参照
    R_Disc->>M_Disc: static metadata 参照
    M_Disc-->>R_Disc: { name, description, author } を返却
    C_Disc->>C_Disc: 設定画面の選択肢を構築
```

#### 初期化と開始 (Initialization)
モジュールのインスタンスは、タスク開始時に作成され、描画領域の情報がセットされます。
```mermaid
sequenceDiagram
    participant U_Inst as ユーザー
    participant C_Inst as QuickLog 本体 (Core)

    U_Inst->>C_Inst: 業務カテゴリを選択
    C_Inst->>C_Inst: タイマー計測開始
    create participant M_Inst as アニメーションモジュール (Instance)
    C_Inst->>M_Inst: new モジュールクラス()
    C_Inst->>M_Inst: setup(width, height)
    Note over M_Inst: 内部状態（座標、配列等）の初期化
    C_Inst->>C_Inst: 描画ループ (requestAnimationFrame) 開始
```

#### 描画ループ (Drawing Loop)
描画はブラウザの更新周期に合わせて行われます。本体側で「ドット回避領域（Exclusion Area）」を算出し、モジュールへ提供します。
```mermaid
sequenceDiagram
    participant C_Loop as QuickLog 本体 (Core)
    participant M_Loop as アニメーションモジュール (Instance)
    participant D_Loop as LCDキャンバス

    loop requestAnimationFrame
        C_Loop->>C_Loop: progress (0-1) / step (0-239) 等の算出
        C_Loop->>C_Loop: テキスト遮蔽領域 (Exclusion Areas) の座標計算
        alt Sprite/Matrix Mode
            C_Loop->>M_Loop: draw(null, params)
            M_Loop-->>C_Loop: 描画データ (Array) を返却
        else Canvas Mode
            C_Loop->>M_Loop: draw(offscreenCtx, params)
            M_Loop->>M_Loop: offscreenCtx へモノクロ描画
        end
        C_Loop->>C_Loop: Exclusion Areas 内のドットを強制除去
        C_Loop->>D_Loop: 指定カテゴリ色で LCD スタイル描画
    end
```

#### 領域リサイズ (Viewport Resize)
サイドパネルの幅が変更された場合、インスタンスを破棄せず、`setup` を再送して状態を適合させます。
```mermaid
sequenceDiagram
    participant U_Size as ユーザー
    participant C_Size as QuickLog 本体 (Core)
    participant M_Size as アニメーションモジュール (Instance)

    U_Size->>C_Size: サイドパネルの境界をドラッグ
    C_Size->>C_Size: キャンバスのリサイズ
    C_Size->>C_Size: 新しい Exclusion Areas の算出
    C_Size->>M_Size: setup(newWidth, newHeight)
    Note over M_Size: 座標の再計算・状態の Fit 処理
```

#### 終了と破棄 (Termination)
タスクの停止、一時停止、または別のアニメーションへの切り替え時にインスタンスは破棄されます。
```mermaid
sequenceDiagram
    participant C_Term as QuickLog 本体 (Core)
    participant M_Term as アニメーションモジュール (Instance)

    C_Term->>C_Term: 停止/一時停止/切替イベント発生
    C_Term->>C_Term: requestAnimationFrame 停止
    C_Term->>C_Term: activeAnimation = null (参照解除)
    Note over M_Term: ガベージコレクション対象へ
    destroy M_Term
```

### 2.3. QuickLog-Solo 本体（コア）の役割
- **時間計測とサイクル管理:** `Date.now()` に基づく正確な時間経過の計測、120秒（2分）を 1周期とする計時サイクル（0～239 のステップ）の算出、およびタスク開始時からの総経過時間（ミリ秒）の管理。
- **レンダリングエンジン:** モジュールから提供されたデータに基づき、LCD ドットマトリクススタイル（4段階のドットサイズ）でのキャンバス描画。
- **視認性確保（自動遮蔽）:** 業務カテゴリ名や経過時間などのテキスト表示エリアを自動的に検出し、アニメーションドットの描画を避ける「ドット回避（Exclusion Area）」処理の実行。
- **リソース管理:** アニメーションの開始・停止・リサイズ制御。

### 2.4. アニメーションモジュール（ロジック）の役割
- **状態管理:** `setup` で受け取った領域情報に基づき、内部のパーティクルや座標情報を管理する。
- **パターン生成:** `draw` メソッドを通じて提供される進捗情報（`progress`, `step`）に応じた描画を行う。
- **視認性への配慮 (推奨):** 提供される `exclusionAreas` を利用して、テキストを避けるような「賢い」アニメーションを実装できる。
- **メタデータの提供:** クラスの静的プロパティとして名前や作者情報を定義する。

## 3. インターフェース仕様

### 3.1. モジュール定義 (Metadata & Config)
各モジュールは `AnimationBase` クラスを継承し、以下のプロパティを持つことが期待される。

#### static metadata
モジュールの情報オブジェクト（設定画面等で使用）。
- `name`: アニメーション名（文字列、または言語コードをキーとしたオブジェクト）。
- `description`: 簡単な説明（多言語対応可）。
- `author`: 開発者名。

#### config (Instance property)
描画エンジンへの動作指示設定。
- `mode`: 描画モードの指定。
    - `'canvas'`: (デフォルト) Canvas API を使用した自由な描画。
    - `'matrix'`: 2次元配列を返すグリッド描画。
    - `'sprite'`: `{x, y, size}` の配列を返すオブジェクト描画。
- `usePseudoSpace`: 疑似空間（Pseudo-space）を使用するかどうかのフラグ。
    - `true`: 遮蔽領域（テキスト等）を「最初から存在しない」ものとして扱い、連続した一本の領域として座標計算を行えるようにします。オブジェクトが遮蔽物を飛び越えて移動するようなシンプルな実装に適しています。
    - `false`: (デフォルト) 実際のキャンバス座標を使用します。遮蔽物を避けたり、遮蔽物の上に乗ったりするような高度な演出に適しています。

### 3.2. 呼び出しサイクル
- **計算用ステップ:** 500ms ごとに `step` (0-239) がインクリメントされる。
- **描画周期:** `requestAnimationFrame` (通常 60fps) に同期。
- **周期の長さ:** 120秒 (2分) で 1サイクル。ただし `elapsedMs` を利用することで、2分を超える独自のストーリー展開も可能。

### 3.3. 提供される情報 (Input Parameters)

#### A. セットアップ時 (`setup(width, height)`)
- `width`: 描画領域の幅 (px)。`usePseudoSpace: true` の場合は、遮蔽領域を除いた仮想的な幅が渡されます。
- `height`: 描画領域の高さ (px)
※開始時およびリサイズ時に呼び出される。

#### B. 描画時 (`draw(ctx, params)`)
`params` オブジェクトを通じて以下の情報が提供される。
- `width / height`: 現在の領域サイズ。
- `elapsedMs`: タスク開始時からの総経過時間 (ms)。
- `progress`: 現在の 120秒周期の進捗率 (0.0 ～ 1.0)。
- `step`: 現在の計時ステップ (0 ～ 239)。
- `exclusionAreas`: テキスト等が表示されている遮蔽領域の配列。
    - 形式: `Array<{x: number, y: number, width: number, height: number}>`
    - **注意:** フォントの切り替えやテキスト長の変化により、描画中にサイズが変動する場合があるため、毎フレームチェックすることを推奨する。

### 3.4. 出力データ形式 (Output)
`config.mode` の設定に応じて、以下のいずれかの形式でデータを出力します。

#### A. スプライト形式 (Sprite Mode)
`draw` 関数の戻り値として、ドット（オブジェクト）の座標とサイズの配列を返します。
- **データ構造:** `Array<{x: number, y: number, size: number}>`
- **size の値:** `1` (小), `2` (中), `3` (大)
- **メリット:** 最も直感的です。`usePseudoSpace: true` と組み合わせることで、遮蔽領域を一切気にせず、好きな座標にドットを置くだけでアニメーションが完成します。

#### B. マトリックス形式 (Matrix Mode)
`draw` 関数の戻り値として、グリッド状の配置データを返します。
- **データ構造:** 2次元配列 `Array<Array<number>>` (rows x cols)
- **各要素の値:** `0`～`3` (ドットなし～大ドット)
- **メリット:** ライフゲームやテトリスのような、セル単位のロジックを実装するのに適しています。

#### C. キャンバス描画形式 (Canvas Mode)
引数の `ctx` に対して直接描画します（戻り値は `void`）。
- **描画ルール:** モノクロ（白 `#fff`）で描画します。
- **メリット:** Canvas API の全ての機能（曲線、グラデーション、画像の描画等）を利用でき、最も表現力が高いモードです。

### 3.5. インタラクション (Events)
必要に応じて、以下のメソッドを実装することでユーザー操作に反応できます。

- `onClick(x, y)`: キャンバスがクリックされたときに呼び出されます。
- `onMouseMove(x, y)`: マウスが移動したときに呼び出されます。
※ `usePseudoSpace: true` の場合、`x` 座標は自動的に仮想空間の座標に変換されます。

## 4. 実装例

### 例1: Sprite Mode + Pseudo-space (基本)
遮蔽領域を気にせず、画面を横切るだけの星を描画します。

```javascript
import { AnimationBase } from '../animations.js';

export default class ShootingStar extends AnimationBase {
    static metadata = {
        name: "Shooting Star",
        author: "QuickLog-Solo"
    };

    config = { mode: 'sprite', usePseudoSpace: true };

    setup(width, height) {
        this.stars = Array(10).fill(0).map(() => ({
            x: Math.random() * width,
            y: Math.random() * height,
            speed: 1 + Math.random() * 3
        }));
    }

    draw(ctx, { width }) {
        return this.stars.map(star => {
            star.x = (star.x + star.speed) % width;
            return { x: star.x, y: star.y, size: 2 };
        });
    }
}
```

### 例2: Canvas Mode + Interaction (応用)
クリックした場所に円を描画します。

```javascript
import { AnimationBase } from '../animations.js';

export default class Ripple extends AnimationBase {
    static metadata = { name: "Ripple", author: "Dev" };

    ripples = [];

    onClick(x, y) {
        this.ripples.push({ x, y, r: 0 });
    }

    draw(ctx) {
        ctx.strokeStyle = '#fff';
        this.ripples.forEach((rp, i) => {
            rp.r += 2;
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
            ctx.stroke();
        });
        this.ripples = this.ripples.filter(rp => rp.r < 100);
    }
}
```

## 5. 視認性の担保について
本体側のレンダリングエンジンが、モジュールから受け取ったデータの描画直前に、テキスト領域と重なるドットを**強制的に**非表示にします。そのため、モジュール側で `exclusionAreas` を無視して描画しても視認性は損なわれませんが、`exclusionAreas` を活用することで、より自然で洗練された「避けるアニメーション」を構築できます。
