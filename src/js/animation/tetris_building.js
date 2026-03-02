import { AnimationBase } from '../animation_base.js';

export default class TetrisBuilding extends AnimationBase {
    static metadata = {
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
            ko: "떨어지는 블록이 쌓여 화면을 채우고, 그 과정에서 가로 줄을 지웁니다.",
            zh: "下落的方块堆叠以填满屏幕，并在此过程中消除行。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'matrix', usePseudoSpace: false };

    setup(_width, _height) {
        this.rows = 15;
        this.cols = 6;
        this.cellSize = 6;
        this.xOffset = 2;
        this.yOffset = 2;
        this.grid = Array(this.rows).fill(0).map(() => Array(this.cols).fill(0));
        this.lastBlockP = 0;
        this.clearingLine = -1;
        this.clearTimer = 0;
    }

    draw(_ctx, { width, height, progress, exclusionAreas }) {
        if (exclusionAreas && exclusionAreas.length > 0) {
            const gridWidth = this.cols * this.cellSize;
            const spots = [2, Math.floor(width / this.cellSize) - this.cols - 2];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot * this.cellSize + gridWidth > area.x && spot * this.cellSize < area.x + area.width;
                });
                if (!overlap) {
                    this.xOffset = spot;
                    break;
                }
            }
        }

        const totalBlocks = this.rows * this.cols;
        const targetBlocks = Math.floor(progress * totalBlocks);

        if (progress < this.lastBlockP) {
            this.grid = Array(this.rows).fill(0).map(() => Array(this.cols).fill(0));
            this.lastBlockP = 0;
        }

        for (let i = Math.floor(this.lastBlockP * totalBlocks); i < targetBlocks; i++) {
            this.addBlock();
        }
        this.lastBlockP = progress;

        if (this.clearingLine >= 0) {
            this.clearTimer++;
            if (this.clearTimer > 10) {
                this.grid.splice(this.clearingLine, 1);
                this.grid.unshift(Array(this.cols).fill(0));
                this.clearingLine = -1;
                this.clearTimer = 0;
            }
        } else {
            this.checkLineClear();
        }

        const matrix = Array(Math.ceil(height / 6)).fill(0).map(() => Array(Math.ceil(width / 6)).fill(0));

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c]) {
                    if (r === this.clearingLine && Math.floor(Date.now() / 100) % 2 === 0) continue;
                    const mr = this.yOffset + r;
                    const mc = this.xOffset + c;
                    if (matrix[mr] && mc < matrix[mr].length) {
                        matrix[mr][mc] = 3;
                    }
                }
            }
        }

        const fallP = (progress * totalBlocks) % 1;
        if (fallP > 0.1 && this.clearingLine < 0) {
            const seed = Math.floor(progress * totalBlocks);
            const c = seed % this.cols;
            const targetR = this.findLandingRow(c);
            const r = Math.floor(fallP * targetR);
            const mr = this.yOffset + r;
            const mc = this.xOffset + c;
            if (matrix[mr] && mc < matrix[mr].length) {
                matrix[mr][mc] = 2;
            }
        }
        return matrix;
    }

    addBlock() {
        const c = Math.floor(Math.random() * this.cols);
        const r = this.findLandingRow(c);
        if (r >= 0) this.grid[r][c] = 1;
    }

    findLandingRow(c) {
        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.grid[r][c] === 0) return r;
        }
        return -1;
    }

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
