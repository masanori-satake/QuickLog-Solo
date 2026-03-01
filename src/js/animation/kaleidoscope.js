import { AnimationBase } from '../animations.js';

export default class Kaleidoscope extends AnimationBase {
    static metadata = {
        name: { en: "Kaleidoscope", ja: "万華鏡" },
        description: { en: "Hypnotic, symmetrical geometric patterns that shift and rotate.", ja: "変化しながら回転する、催眠的で対称的な幾何学模様です。" },
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
