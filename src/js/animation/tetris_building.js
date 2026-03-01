import { AnimationBase } from '../animations.js';

export default class TetrisBuilding extends AnimationBase {
    static metadata = {
        name: { en: "Tetris Building", ja: "テトリス・ビルディング" },
        description: { en: "Blocks stack up to fill the screen.", ja: "ブロックが積み上がり画面を満たします。" },
        author: "QuickLog-Solo"
    };
    setup(width, height) {
        this.rows = 10;
        this.cols = 6;
        this.cellSize = Math.min(width / this.cols, height / this.rows);
        this.xOffset = (width - (this.cols * this.cellSize)) / 2;
        this.yOffset = (height - (this.rows * this.cellSize)) / 2;
    }

    draw(ctx, { width, height, progress }) {
        const totalBlocks = this.rows * this.cols;
        const blocksToDraw = Math.floor(progress * totalBlocks);

        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.6;

        for (let i = 0; i < blocksToDraw; i++) {
            const r = this.rows - 1 - Math.floor(i / this.cols);
            const c = i % this.cols;
            ctx.fillRect(this.xOffset + c * this.cellSize + 1, this.yOffset + r * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2);
        }

        // Line clear effect at the end
        if (progress > 0.95) {
            ctx.globalAlpha = (1 - progress) * 10;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, height);
        }
        ctx.globalAlpha = 1.0;
    }
}
