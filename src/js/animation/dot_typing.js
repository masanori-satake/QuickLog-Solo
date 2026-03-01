import { AnimationBase } from '../animations.js';

export default class DotTyping extends AnimationBase {
    static metadata = {
        name: { en: "Dot Typing", ja: "ドット・タイピング" },
        description: { en: "Random characters being typed out.", ja: "ランダムな文字がタイピングされます。" },
        author: "QuickLog-Solo"
    };
    constructor() {
        super();
        this.chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
        this.rows = 5;
        this.cols = 15;
    }
    draw(ctx, { progress }) {
        ctx.fillStyle = '#fff';
        ctx.font = "12px monospace";
        ctx.globalAlpha = 0.7;

        const totalChars = this.rows * this.cols;
        const charsToDraw = Math.floor(progress * totalChars);

        for (let i = 0; i < charsToDraw; i++) {
            const r = Math.floor(i / this.cols);
            const c = i % this.cols;
            const char = this.chars[i % this.chars.length];
            ctx.fillText(char, 20 + c * 15, 30 + r * 15);
        }

        // Cursor
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            const r = Math.floor(charsToDraw / this.cols);
            const c = charsToDraw % this.cols;
            ctx.fillRect(20 + c * 15, 30 + r * 15 - 10, 8, 12);
        }
        ctx.globalAlpha = 1.0;
    }
}
