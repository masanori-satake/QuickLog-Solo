import { AnimationBase } from '../animations.js';

export default class DotTyping extends AnimationBase {
    static metadata = {
        name: { en: "Dot Typing", ja: "ドット・タイピング" },
        description: { en: "Retro terminal-style animation with characters being typed and occasionally backspaced.", ja: "レトロなターミナル風の、文字がタイピングされ、時々バックスペースで消されるアニメーションです。" },
        author: "QuickLog-Solo"
    };

    constructor() {
        super();
        this.chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
        this.rows = 5;
        this.cols = 15;
        this.buffer = [];
        this.backspaceCount = 0;
    }

    draw(ctx, { progress }) {
        ctx.fillStyle = '#fff';
        ctx.font = "12px monospace";
        ctx.globalAlpha = 0.7;

        const totalChars = this.rows * this.cols;
        const targetChars = Math.floor(progress * totalChars);

        // Update buffer based on progress and some randomness for backspace
        // To maintain stability over time, we use progress as the seed
        const timeFactor = Math.floor(progress * 1000);

        // Simulating the buffer with occasional backspaces
        this.buffer = [];
        let p = 0;
        for (let i = 0; i < targetChars; i++) {
            // Every 10 characters, let's pretend a backspace happened
            if (i % 15 === 14) {
               // Backspace 3 chars
               this.buffer.splice(-3);
            } else {
               this.buffer.push(this.chars[i % this.chars.length]);
            }
        }

        this.buffer.forEach((char, i) => {
            const r = Math.floor(i / this.cols);
            const c = i % this.cols;
            ctx.fillText(char, 20 + c * 15, 30 + r * 15);
        });

        // Cursor at the end of buffer
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            const lastIdx = this.buffer.length;
            const r = Math.floor(lastIdx / this.cols);
            const c = lastIdx % this.cols;
            ctx.fillRect(20 + c * 15, 30 + r * 15 - 10, 8, 12);
        }
        ctx.globalAlpha = 1.0;
    }
}
