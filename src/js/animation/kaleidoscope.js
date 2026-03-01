import { AnimationBase } from '../animations.js';

export default class Kaleidoscope extends AnimationBase {
    static metadata = {
        name: { en: "Kaleidoscope", ja: "万華鏡" },
        description: { en: "Symmetrical patterns in motion.", ja: "動く対称的なパターンです。" },
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
