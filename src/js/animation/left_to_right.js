import { AnimationBase } from '../animation_base.js';

export default class LeftToRight extends AnimationBase {
    static metadata = {
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
            ko: "왼쪽에서 오른쪽으로 진행되는 간단한 선형 채우기입니다.",
            zh: "一种简单的线性填充，从左向右推进。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'sprite', usePseudoSpace: true };

    draw(ctx, { width, height, progress }) {
        const sprites = [];
        const fillWidth = width * progress;
        const spacing = 6;
        for (let x = 0; x < fillWidth; x += spacing) {
            for (let y = 0; y < height; y += spacing) {
                sprites.push({ x, y, size: 2 });
            }
        }
        return sprites;
    }
}
