import { AnimationBase } from '../animation_base.js';

/**
 * LeftToRight Animation
 * A simple linear fill that progresses from left to right.
 * 左から右へと背景を塗りつぶしていく、シンプルな進行インジケーターです。
 */
export default class LeftToRight extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Left to Right",
            ja: "左から右へ",
            de: "Links nach Rechts",
            es: "Izquierda a Derecha",
            fr: "Gauche à Droite",
            pt: "Esquerda para Direita",
            ko: "왼쪽에서 오른쪽으로",
            zh: "从左到右"
        },
        description: {
            en: "A simple linear fill that progresses from left to right.",
            ja: "左から右へと背景を塗りつぶしていく、シンプルな進行インジケーターです。",
            de: "Eine einfache lineare Füllung, die von links nach rechts fortschreitet.",
            es: "Un simple relleno lineal que progresa de izquierda a derecha.",
            fr: "Un simple remplissage linéaire qui progresse de gauche à droite.",
            pt: "Um simples preenchimento linear que progride da esquerda para a direita.",
            ko: "왼쪽에서 오른쪽으로 진행되는 간단한 선형 채우기입니다。",
            zh: "一种简单的线性填充，从左向右推进。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'sprite', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
    }

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { progress = 0 } = {}) {
        const sprites = [];
        const width = this.width;
        const height = this.height;

        // Calculate the filling width based on progress
        // 進捗に応じて塗りつぶす幅を計算
        const fillWidth = width * progress;
        const spacing = 6;

        // Fill the area with dots
        // 領域をドットで埋める
        for (let x = 0; x < fillWidth; x += spacing) {
            for (let y = 0; y < height; y += spacing) {
                sprites.push({ x, y, size: 2 });
            }
        }

        return sprites;
    }
}
