import { AnimationBase } from '../animations.js';

export default class Kaleidoscope extends AnimationBase {
    static metadata = {
        name: {
            en: "Kaleidoscope",
            ja: "万華鏡",
            de: "Kaleidoskop",
            es: "Caleidoscopio",
            fr: "Kaléidoscope",
            pt: "Caleidoscópio",
            ko: "만화경",
            zh: "万花筒"
        },
        description: {
            en: "Hypnotic, symmetrical geometric patterns that shift and rotate.",
            ja: "変化しながら回転する、催眠的で対称的な幾何学模様です。",
            de: "Hypnotische, symmetrische geometrische Muster, die sich verschieben und rotieren.",
            es: "Patrones geométricos simétricos e hipnóticos que se desplazan y rotan.",
            fr: "Motifs géométriques symétriques et hypnotiques qui se déplacent et tournent.",
            pt: "Padrões geométricos simétricos e hipnóticos que se deslocam e giram.",
            ko: "변화하고 회전하는 최면적이고 대칭적인 기하학적 패턴입니다.",
            zh: "催眠、对称的几何图案，不断移动和旋转。"
        },
        author: "QuickLog-Solo"
    };
    setup(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.segments = 8;
    }

    draw(ctx, { progress }) {
        const time = Date.now() / 2000;
        ctx.fillStyle = '#fff';

        for (let i = 0; i < this.segments; i++) {
            ctx.save();
            ctx.translate(this.centerX, this.centerY);
            ctx.rotate((i * Math.PI * 2) / this.segments + time);

            const size = 20 + 30 * Math.sin(progress * Math.PI + i);
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(size, size);
            ctx.lineTo(size * 1.5, 0);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }
}
