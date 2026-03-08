import { AnimationBase } from '../animation_base.js';

/**
 * Digital Rain Animation
 * Falling code effect inspired by science fiction.
 * SF映画のような、コードが降り注ぐエフェクトです。
 */
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

    config = { mode: 'sprite', exclusionStrategy: 'pseudo' };

    constructor() {
        super();
        this.columns = [];
    }

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        const spacing = 6;
        const colCount = Math.floor(width / spacing);

        // Initialize columns only if the count has changed (e.g., resizing)
        // 列の数が変わった場合のみ初期化（リサイズ対応）
        if (this.columns.length !== colCount) {
            this.columns = Array(colCount).fill(0).map(() => this.createColumn(height));
        }
    }

    /**
     * Create a single rain column
     * 1つのレイン列を作成
     */
    createColumn(height) {
        return {
            y: Math.random() * (height + 200) - 100,
            speed: 1 + Math.random() * 3,
            maxDots: 10 + Math.random() * 20,
            dots: []
        };
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { speed = 1 } = {}) {
        const sprites = [];
        const spacing = 6;
        const height = this.height;

        this.columns.forEach((col, i) => {
            // Update vertical position
            // 垂直位置の更新
            col.y += col.speed * speed;

            // Wrap around top if it goes off bottom
            // 画面下端を超えたら上に戻す
            if (col.y > height + 100) {
                const newCol = this.createColumn(height);
                newCol.y = -100;
                Object.assign(col, newCol);
            }

            // Record trail position
            // 軌跡の位置を記録
            col.dots.push({ y: col.y });
            if (col.dots.length > col.maxDots) {
                col.dots.shift();
            }

            // Generate sprites for the trail
            // 軌跡のスプライトを生成
            col.dots.forEach((dot, idx) => {
                // Leading dot is larger
                // 先頭のドットを大きくする
                const isLead = idx === col.dots.length - 1;
                const size = isLead ? 3 : (idx > col.dots.length - 6 ? 2 : 1);
                sprites.push({ x: i * spacing, y: dot.y, size: size });
            });
        });

        return sprites;
    }
}
