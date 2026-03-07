import { AnimationBase } from '../animation_base.js';

/**
 * TetrisBuilding Animation
 * Falling blocks stack up to fill the screen, clearing rows along the way.
 * 落ちてくるブロックが積み上がり、横一列が揃うと消えていくビルドアップ・アニメーションです。
 */
export default class TetrisBuilding extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Tetris Building",
            ja: "テトリス・ビルディング",
            de: "Tetris-Bau",
            es: "Construcción Tetris",
            fr: "Construction Tetris",
            pt: "Construção Tetris",
            ko: "테트리스 빌딩",
            zh: "俄罗斯方块建筑"
        },
        description: {
            en: "Falling blocks stack up to fill the screen, clearing rows along the way.",
            ja: "落ちてくるブロックが積み上がり、横一列が揃うと消えていくビルドアップ・アニメーションです。",
            de: "Fallende Blöcke stapeln sich, um den Bildschirm zu füllen, und löschen dabei Reihen.",
            es: "Bloques que caen se apilan para llenar la pantalla, despejando filas por el camino.",
            fr: "Des blocs qui tombent s'empilent pour remplir l'écran, effaçant des lignes au passage.",
            pt: "Blocos que caem se empilham para preencher a tela, limpando linhas pelo caminho.",
            ko: "떨어지는 블록이 쌓여 화면을 채우고, 그 과정에서 가로 줄을 지웁니다。",
            zh: "下落的方块堆叠以填满屏幕，并在此过程中消除行。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'matrix', usePseudoSpace: false };

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        // Tetris grid configuration
        // テトリス・グリッドの設定
        this.cols = 6;
        this.cellSize = 12; // 2x2 matrix cells
        this.rows = Math.floor((height - 12) / this.cellSize);

        // Horizontal placement (default to left)
        // 水平位置の初期設定（デフォルトは左端）
        this.xOffset = 1;
        this.yOffset = 0.5;

        // Initialize empty grid
        // 空のグリッドを初期化
        this.grid = Array(this.rows).fill(0).map(() => Array(this.cols).fill(0));

        this.lastBlockP = 0;
        this.clearingLine = -1;
        this.clearTimer = 0;
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { progress = 0, exclusionAreas = [] } = {}) {
        const width = this.width;
        const height = this.height;

        // Smart placement logic: move the grid if UI text overlaps
        // 回避ロジック：UIテキストと重なる場合はグリッドを移動させる
        if (exclusionAreas && exclusionAreas.length > 0) {
            const gridWidthPx = this.cols * this.cellSize;
            // Potential spots: left or right / 配置候補：左または右
            const spots = [1, Math.floor(width / 6) - (this.cols * 2) - 1];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return (spot * this.cellSize) < (area.x + area.width) &&
                           (spot * this.cellSize + gridWidthPx) > area.x;
                });
                if (!overlap) {
                    this.xOffset = spot;
                    break;
                }
            }
        }

        // 1. Manage Block Spawning based on progress
        // 1. 進捗に基づいたブロック生成
        const totalBlocks = this.rows * this.cols;
        const targetBlocks = Math.floor(progress * totalBlocks);

        // Reset grid if progress resets / 進捗がリセットされたらグリッドもリセット
        if (progress < this.lastBlockP) {
            this.grid = Array(this.rows).fill(0).map(() => Array(this.cols).fill(0));
            this.lastBlockP = 0;
        }

        // Add missing blocks / 足りない分のブロックを追加
        for (let i = Math.floor(this.lastBlockP * totalBlocks); i < targetBlocks; i++) {
            this.addBlock();
        }
        this.lastBlockP = progress;

        // 2. Handle Line Clearing animation
        // 2. ライン消去アニメーションの処理
        if (this.clearingLine >= 0) {
            this.clearTimer++;
            if (this.clearTimer > 10) {
                // Remove line and shift top blocks down
                // 行を消して上のブロックを詰める
                this.grid.splice(this.clearingLine, 1);
                this.grid.unshift(Array(this.cols).fill(0));
                this.clearingLine = -1;
                this.clearTimer = 0;
            }
        } else {
            this.checkLineClear();
        }

        // 3. Render Grid to Matrix
        // 3. グリッドをマトリックス形式に変換
        const matrixRows = Math.ceil(height / 6);
        const matrixCols = Math.ceil(width / 6);
        const matrix = Array(matrixRows).fill(0).map(() => Array(matrixCols).fill(0));

        // Draw stacked blocks
        // 積み上がったブロックの描画
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c]) {
                    // Flash line when clearing / 消去中の行は点滅
                    if (r === this.clearingLine && Math.floor(progress * 10000 / 100) % 2 === 0) continue;

                    // Each block is 2x2 in the matrix
                    // 1ブロックを2x2のドットで描画
                    for (let dr = 0; dr < 2; dr++) {
                        for (let dc = 0; dc < 2; dc++) {
                            const mr = Math.floor((this.yOffset + r) * 2 + dr);
                            const mc = Math.floor((this.xOffset + c) * 2 + dc);
                            if (matrix[mr] && mc < matrix[mr].length) {
                                matrix[mr][mc] = 3;
                            }
                        }
                    }
                }
            }
        }

        // 4. Draw Falling Block
        // 4. 落下中のブロックの描画
        const fallP = (progress * totalBlocks) % 1;
        if (fallP > 0.1 && this.clearingLine < 0) {
            const seed = Math.floor(progress * totalBlocks);
            const c = seed % this.cols;
            const targetR = this.findLandingRow(c);
            const r = Math.floor(fallP * targetR);
            for (let dr = 0; dr < 2; dr++) {
                for (let dc = 0; dc < 2; dc++) {
                    const mr = Math.floor((this.yOffset + r) * 2 + dr);
                    const mc = Math.floor((this.xOffset + c) * 2 + dc);
                    if (matrix[mr] && mc < matrix[mr].length) {
                        matrix[mr][mc] = 2;
                    }
                }
            }
        }

        return matrix;
    }

    /**
     * Add a block at a random available column
     * 空いているランダムな列にブロックを追加
     */
    addBlock() {
        const c = Math.floor(Math.random() * this.cols);
        const r = this.findLandingRow(c);
        if (r >= 0) this.grid[r][c] = 1;
    }

    /**
     * Find the lowest empty row for a column
     * 指定した列の最下段の空き行を探す
     */
    findLandingRow(c) {
        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.grid[r][c] === 0) return r;
        }
        return -1;
    }

    /**
     * Check if any line is completely filled
     * 横一列が揃っているか確認
     */
    checkLineClear() {
        for (let r = 0; r < this.rows; r++) {
            if (this.grid[r].every(cell => cell === 1)) {
                this.clearingLine = r;
                this.clearTimer = 0;
                break;
            }
        }
    }
}
