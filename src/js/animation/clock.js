import { AnimationBase } from '../animations.js';

export default class Clock extends AnimationBase {
    static metadata = {
        name: { en: "Clock", ja: "時計" },
        description: { en: "A circular progress indicator.", ja: "円形の進捗インジケーターです。" },
        author: "QuickLog-Solo"
    };
    setup(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.radius = Math.min(width, height) * 0.4;
    }
    draw(ctx, { progress }) {
        const angle = progress * Math.PI * 2;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY);
        ctx.arc(this.centerX, this.centerY, this.radius, -Math.PI / 2, -Math.PI / 2 + angle);
        ctx.closePath();
        ctx.fill();
    }
}
