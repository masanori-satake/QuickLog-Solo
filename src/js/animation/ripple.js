import { AnimationBase } from '../animations.js';

export default class Ripple extends AnimationBase {
    static metadata = {
        name: { en: "Ripple", ja: "波紋" },
        description: { en: "Expanding concentric circles.", ja: "同心円状に広がる波紋です。" },
        author: "QuickLog-Solo"
    };
    setup(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.maxRadius = Math.sqrt(width * width + height * height) / 2;
    }

    draw(ctx, { width, height, progress }) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        const rippleCount = 5 + Math.floor(progress * 20);
        const time = Date.now() / 1000;

        for (let i = 0; i < rippleCount; i++) {
            const offset = (i / rippleCount + time / 2) % 1;
            const radius = offset * this.maxRadius;
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
            ctx.globalAlpha = (1 - offset) * 0.5;
            ctx.stroke();
        }

        // Screen fill at the end
        if (progress > 0.9) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = (progress - 0.9) * 10;
            ctx.fillRect(0, 0, width, height);
        }
        ctx.globalAlpha = 1.0;
    }
}
