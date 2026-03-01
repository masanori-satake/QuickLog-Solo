import { AnimationBase } from '../animations.js';

export default class MatrixCode extends AnimationBase {
    static metadata = {
        name: {
            en: "Matrix Code",
            ja: "マトリックス・コード",
            de: "Matrix-Code",
            es: "Código Matrix",
            fr: "Code Matrix",
            pt: "Código Matrix",
            ko: "매트릭스 코드",
            zh: "黑客帝国代码"
        },
        description: {
            en: "Falling 'Digital Rain' effect inspired by science fiction.",
            ja: "SF映画を彷彿とさせる、降り注ぐ「デジタル・レイン」のエフェクトです。",
            de: "Fallender 'Digital Rain'-Effekt, inspiriert von Science-Fiction.",
            es: "Efecto de 'lluvia digital' inspirado en la ciencia ficción.",
            fr: "Effet de 'pluie numérique' inspiré de la science-fiction.",
            pt: "Efeito de 'chuva digital' inspirado na ficção científica.",
            ko: "SF 영화에서 영감을 받은 떨어지는 '디지털 레인' 효과입니다.",
            zh: "受科幻电影启发的‘数字雨’效果。"
        },
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
