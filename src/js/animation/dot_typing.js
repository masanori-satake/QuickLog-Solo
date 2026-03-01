import { AnimationBase } from '../animations.js';

export default class DotTyping extends AnimationBase {
    static metadata = {
        name: {
            en: "Dot Typing",
            ja: "ドット・タイピング",
            de: "Punkt-Tippen",
            es: "Mecanografía de puntos",
            fr: "Saisie de points",
            pt: "Digitação de pontos",
            ko: "도트 타이핑",
            zh: "点打字"
        },
        description: {
            en: "Retro terminal-style animation with characters being typed and occasionally backspaced.",
            ja: "レトロなターミナル風の、文字がタイピングされ、時々バックスペースで消されるアニメーションです。",
            de: "Retro-Terminal-Animation, bei der Zeichen getippt und gelegentlich gelöscht werden.",
            es: "Animación retro estilo terminal con caracteres que se escriben y ocasionalmente se borran.",
            fr: "Animation de style terminal rétro avec des caractères saisis et parfois effacés.",
            pt: "Animação retrô estilo terminal com caracteres sendo digitados e ocasionalmente apagados.",
            ko: "복고풍 터미널 스타일의 애니메이션으로, 문자가 입력되고 때때로 백스페이스로 지워집니다.",
            zh: "复古终端风格动画，字符被输入，偶尔会被退格删除。"
        },
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

        // Simulating the buffer with occasional backspaces
        this.buffer = [];
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
