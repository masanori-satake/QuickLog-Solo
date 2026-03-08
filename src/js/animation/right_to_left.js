import { AnimationBase } from '../animation_base.js';

/**
 * RightToLeft Animation
 * A simple linear fill that progresses from right to left.
 * 右から左へと背景を塗りつぶしていく、シンプルな進行インジケーターです。
 */
export default class RightToLeft extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Right to Left",
            ja: "右から左へ",
            de: "Rechts nach Links",
            es: "Derecha a Izquierda",
            fr: "Droite à Gauche",
            pt: "Direita para Esquerda",
            ko: "오른쪽에서 왼쪽으로",
            zh: "从右到左"
        },
        description: {
            en: "A simple linear fill that progresses from right to left.",
            ja: "右から左へと背景を塗りつぶしていく、シンプルな進行インジケーターです。",
            de: "Eine einfache lineare Füllung, die von rechts nach links fortschreitet.",
            es: "Un simple relleno lineal que progresa de derecha a izquierda.",
            fr: "Un simple remplissage linéaire qui progresse de droite à gauche.",
            pt: "Um simples preenchimento linear que progride da direita para a esquerda.",
            ko: "오른쪽에서 왼쪽으로 진행되는 간단한 선형 채우기입니다。",
            zh: "一种简单的线性填充，从左向右推进。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'sprite', exclusionStrategy: 'pseudo' };

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

        // Calculate the starting X position based on progress (from right to left)
        // 進捗に応じて開始X座標を計算（右から左へ）
        const startX = width * (1 - progress);
        const spacing = 6;

        // Fill the area with dots from right edge to startX
        // 右端からstartXまでの領域をドットで埋める
        for (let x = width; x >= startX; x -= spacing) {
            for (let y = 0; y < height; y += spacing) {
                sprites.push({ x, y, size: 2 });
            }
        }

        return sprites;
    }
}
