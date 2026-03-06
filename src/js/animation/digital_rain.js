import { AnimationBase } from '../animation_base.js';

export default class DigitalRain extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Digital Rain",
            ja: "デジタル・レイン",
            de: "Digitaler Regen",
            es: "Lluvia digital",
            fr: "Pluie numérique",
            pt: "Chuva digital",
            ko: "디지털 레인",
            zh: "数字雨"
        },
        description: {
            en: "Falling code effect inspired by science fiction.",
            ja: "SF映画を彷彿とさせる、コードが降り注ぐエフェクトです。",
            de: "Fallender Code-Effekt, inspiriert von Science-Fiction.",
            es: "Efecto de código cayendo inspirado en la ciencia ficción.",
            fr: "Effet de code tombant inspiré de la science-fiction.",
            pt: "Efeito de código caindo inspirado na ficção científica.",
            ko: "SF 영화에서 영감을 받은 떨어지는 코드 효과입니다.",
            zh: "受科幻电影启发的代码雨效果。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'sprite', usePseudoSpace: true };

    constructor() {
        super();
        this.columns = [];
    }

    setup(width, height) {
        const spacing = 6;
        const cols = Math.floor(width / spacing);
        if (this.columns.length !== cols) {
            this.columns = Array(cols).fill(0).map(() => ({
                y: Math.random() * height,
                speed: 1 + Math.random() * 3,
                maxDots: 10 + Math.random() * 20,
                dots: []
            }));
        }
    }

    draw(ctx, { height, speed }) {
        const sprites = [];
        const spacing = 6;

        this.columns.forEach((col, i) => {
            col.y += col.speed * speed;
            if (col.y > height + 100) {
                col.y = -100;
                col.speed = 1 + Math.random() * 3;
                col.maxDots = 10 + Math.random() * 20;
            }

            // Add leading dot
            col.dots.push({ y: col.y });
            if (col.dots.length > col.maxDots) col.dots.shift();

            col.dots.forEach((dot, idx) => {
                const size = idx === col.dots.length - 1 ? 3 : (idx > col.dots.length - 6 ? 2 : 1);
                sprites.push({ x: i * spacing, y: dot.y, size: size });
            });
        });
        return sprites;
    }
}
