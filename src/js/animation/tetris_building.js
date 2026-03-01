import { AnimationBase } from '../animations.js';

export default class TetrisBuilding extends AnimationBase {
    static metadata = {
        name: { en: "Tetris Building", ja: "テトリス・ビルディング" },
        description: { en: "Falling blocks stack up to fill the screen, clearing rows along the way.", ja: "落ちてくるブロックが積み上がり、横一列が揃うと消えていくビルドアップ・アニメーションです。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.rows = 15;
        this.cols = 6;
        this.cellSize = Math.min(width / (this.cols + 2), height / this.rows);
        this.xOffset = 10;
        this.yOffset = (height - (this.rows * this.cellSize)) / 2;
        this.grid = Array(this.rows).fill(0).map(() => Array(this.cols).fill(0));
        this.lastBlockP = 0;
        this.clearingLine = -1;
        this.clearTimer = 0;
    }

    draw(ctx, { width, height, progress, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.cellSize = Math.min(width / (this.cols + 2), height / this.rows);

        // Reposition grid if overlapping
        if (exclusionAreas && exclusionAreas.length > 0) {
            const gridWidth = this.cols * this.cellSize;
            const spots = [10, width - gridWidth - 10, (width - gridWidth) / 2];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot + gridWidth > area.x && spot < area.x + area.width;
                });
                if (!overlap) {
                    this.xOffset = spot;
                    break;
                }
            }
        }

        ctx.fillStyle = '#fff';
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
            if (this.clearTimer > 20) {
                this.grid.splice(this.clearingLine, 1);
                this.grid.unshift(Array(this.cols).fill(0));
                this.clearingLine = -1;
                this.clearTimer = 0;
            }
        } else {
            this.checkLineClear();
        }

        ctx.globalAlpha = 0.6;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c]) {
                    if (r === this.clearingLine && Math.floor(Date.now() / 100) % 2 === 0) continue;
                    ctx.fillRect(this.xOffset + c * this.cellSize + 1, this.yOffset + r * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2);
                    ctx.globalAlpha = 1.0;
                    ctx.strokeRect(this.xOffset + c * this.cellSize + 2, this.yOffset + r * this.cellSize + 2, this.cellSize - 4, this.cellSize - 4);
                    ctx.globalAlpha = 0.6;
                }
            }
        }

        const fallP = (progress * totalBlocks) % 1;
        if (fallP > 0.1 && this.clearingLine < 0) {
            ctx.globalAlpha = 0.8;
            const seed = Math.floor(progress * totalBlocks);
            const c = seed % this.cols;
            const targetR = this.findLandingRow(c);
            const r = fallP * targetR;
            const rotation = (Date.now() / 100) % (Math.PI * 2);

            ctx.save();
            ctx.translate(this.xOffset + (c + 0.5) * this.cellSize, this.yOffset + (r + 0.5) * this.cellSize);
            ctx.rotate(rotation);
            ctx.fillRect(-this.cellSize/2 + 2, -this.cellSize/2 + 2, this.cellSize - 4, this.cellSize - 4);
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;
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
