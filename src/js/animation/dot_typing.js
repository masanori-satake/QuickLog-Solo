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

    config = { mode: 'sprite', usePseudoSpace: true };

    constructor() {
        super();
        this.rows = 5;
        this.cols = 15;
    }

    draw(ctx, { progress }) {
        const sprites = [];
        const totalChars = this.rows * this.cols;
        const targetChars = Math.floor(progress * totalChars);

        const buffer = [];
        for (let i = 0; i < targetChars; i++) {
            if (i % 15 === 14) {
               buffer.splice(-3);
            } else {
               buffer.push(i);
            }
        }

        buffer.forEach((_, i) => {
            const r = Math.floor(i / this.cols);
            const c = i % this.cols;
            const x = 20 + c * 15;
            const y = 30 + r * 15;
            sprites.push({ x, y, size: 2 });
            sprites.push({ x: x + 2, y: y + 2, size: 1 });
        });

        if (Math.floor(Date.now() / 500) % 2 === 0) {
            const lastIdx = buffer.length;
            const r = Math.floor(lastIdx / this.cols);
            const c = lastIdx % this.cols;
            const x = 20 + c * 15;
            const y = 30 + r * 15;
            sprites.push({ x, y: y - 5, size: 3 });
        }
        return sprites;
    }
}
