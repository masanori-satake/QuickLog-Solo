import { AnimationBase } from '../animations.js';

export default class SandClock extends AnimationBase {
    static metadata = {
        name: { en: "Sand Clock", ja: "砂時計" },
        description: { en: "An hourglass that fills over time.", ja: "時間とともに砂が落ちる砂時計です。" },
        author: "QuickLog-Solo"
    };
    setup(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.size = Math.min(width, height) * 0.4;
    }
    draw(ctx, { progress }) {
        ctx.fillStyle = '#fff';

        // Top triangle (emptying)
        ctx.beginPath();
        ctx.moveTo(this.centerX - this.size, this.centerY - this.size);
        ctx.lineTo(this.centerX + this.size, this.centerY - this.size);
        ctx.lineTo(this.centerX, this.centerY);
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(this.centerX - this.size, this.centerY - this.size, this.size * 2, this.size * progress);
        ctx.globalCompositeOperation = 'source-over';

        // Bottom triangle (filling)
        ctx.beginPath();
        ctx.moveTo(this.centerX - this.size, this.centerY + this.size);
        ctx.lineTo(this.centerX + this.size, this.centerY + this.size);
        ctx.lineTo(this.centerX, this.centerY);
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillRect(this.centerX - this.size, this.centerY + this.size - this.size * progress, this.size * 2, this.size * progress);
        ctx.globalCompositeOperation = 'source-over';
    }
}
