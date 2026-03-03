import { AnimationBase } from '../animation_base.js';

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

    draw(ctx, { height }) {
        const sprites = [];
        const spacing = 6;

        this.columns.forEach((col, i) => {
            col.y += col.speed;
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
