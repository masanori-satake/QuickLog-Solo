import { AnimationBase } from '../animations.js';

export default class RightToLeft extends AnimationBase {
    static metadata = {
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
    draw(ctx, { width, height, progress }) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(width * (1 - progress), 0, width * progress, height);
    }
}
