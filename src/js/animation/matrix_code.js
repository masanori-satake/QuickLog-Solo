import { AnimationBase } from '../animations.js';

export default class MatrixCode extends AnimationBase {
    static metadata = {
        name: { en: "Matrix Code", ja: "マトリックス・コード" },
        description: { en: "Falling digital rain effect.", ja: "降り注ぐデジタル・レインの効果です。" },
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
            this.columns = Array(cols).fill(0).map(() => Math.random() * height);
        }
    }
    draw(ctx, { height, progress }) {
        const fontSize = 14;
        ctx.fillStyle = '#fff';
        ctx.font = fontSize + "px monospace";
        ctx.globalAlpha = 0.4 + progress * 0.4;

        this.columns.forEach((y, i) => {
            const char = String.fromCharCode(0x30A0 + Math.random() * 96);
            ctx.fillText(char, i * fontSize, y);

            if (y > height && Math.random() > 0.975) {
                this.columns[i] = 0;
            } else {
                this.columns[i] += fontSize;
            }
        });
    }
}
