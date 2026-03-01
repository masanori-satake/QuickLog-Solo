import { AnimationBase } from '../animations.js';

export default class MatrixCode extends AnimationBase {
    static metadata = {
        name: { en: "Matrix Code", ja: "マトリックス・コード" },
        description: { en: "Falling 'Digital Rain' effect inspired by science fiction.", ja: "SF映画を彷彿とさせる、降り注ぐ「デジタル・レイン」のエフェクトです。" },
        author: "QuickLog-Solo"
    };

    constructor() {
        super();
        this.columns = [];
    }

    setup(width, height) {
        const fontSize = 14;
        const cols = Math.floor(width / fontSize);
        if (this.columns.length !== cols) {
            this.columns = Array(cols).fill(0).map(() => ({
                y: Math.random() * height,
                speed: 2 + Math.random() * 5,
                chars: []
            }));
        }
    }

    draw(ctx, { height, progress }) {
        const fontSize = 14;
        ctx.font = fontSize + "px monospace";

        this.columns.forEach((col, i) => {
            // Update column
            col.y += col.speed;
            if (col.y > height + 100) {
                col.y = -100;
                col.speed = 2 + Math.random() * 5;
            }

            // Generate trail
            if (Math.random() > 0.5) {
                col.chars.push({
                    char: String.fromCharCode(0x30A0 + Math.random() * 96),
                    opacity: 1.0
                });
            }
            if (col.chars.length > 20) col.chars.shift();

            // Draw trail
            col.chars.forEach((c, idx) => {
                c.opacity *= 0.95;
                ctx.fillStyle = '#fff';
                ctx.globalAlpha = c.opacity * (0.4 + progress * 0.4);
                ctx.fillText(c.char, i * fontSize, col.y - (col.chars.length - idx) * fontSize);
            });

            // Bright leading character
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 1.0;
            const leadingChar = String.fromCharCode(0x30A0 + Math.random() * 96);
            ctx.fillText(leadingChar, i * fontSize, col.y);
        });
        ctx.globalAlpha = 1.0;
    }
}
