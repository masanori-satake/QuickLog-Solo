import { AnimationBase } from '../animation_base.js';

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
            ko: "오른쪽에서 왼쪽으로 진행되는 간단한 선형 채우기입니다.",
            zh: "一种简单的线性填充，从右向左推进。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'sprite', usePseudoSpace: true };

    draw(ctx, { width, height, progress }) {
        const sprites = [];
        const startX = width * (1 - progress);
        const spacing = 6;
        for (let x = width; x >= startX; x -= spacing) {
            for (let y = 0; y < height; y += spacing) {
                sprites.push({ x, y, size: 2 });
            }
        }
        return sprites;
    }
}
