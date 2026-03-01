import { AnimationBase } from '../animations.js';

export default class NewtonsCradle extends AnimationBase {
    static metadata = {
        name: { en: "Newton's Cradle", ja: "ニュートンのゆりかご" },
        description: { en: "A simulation of the classic physical office toy.", ja: "古典的な物理玩具である「ニュートンのゆりかご」のシミュレーションです。" },
        author: "QuickLog-Solo"
    };
    setup(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 3;
        this.ballCount = 5;
        this.ballRadius = 10;
        this.stringLength = height / 2;
    }

    draw(ctx, { width, height, progress }) {
        ctx.strokeStyle = '#fff';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 1;

        // Amplitude varies with 2 min cycle
        const amplitude = Math.PI / 6 * (1 + 0.2 * Math.sin(progress * Math.PI * 10));
        const time = Date.now() / 300;
        const angle = Math.sin(time);

        for (let i = 0; i < this.ballCount; i++) {
            let currentAngle = 0;
            if (i === 0 && angle < 0) currentAngle = angle * amplitude;
            if (i === this.ballCount - 1 && angle > 0) currentAngle = angle * amplitude;

            const x = this.centerX + (i - (this.ballCount - 1) / 2) * this.ballRadius * 2;
            const bx = x + Math.sin(currentAngle) * this.stringLength;
            const by = this.centerY + Math.cos(currentAngle) * this.stringLength;

            ctx.beginPath();
            ctx.moveTo(x, this.centerY);
            ctx.lineTo(bx, by);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(bx, by, this.ballRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 360 degree spin at the end
        if (progress > 0.95) {
            const spinAngle = (progress - 0.95) * 20 * Math.PI * 2;
            ctx.save();
            ctx.translate(this.centerX, this.centerY + this.stringLength / 2);
            ctx.rotate(spinAngle);
            ctx.globalAlpha = 0.2;
            ctx.fillRect(-width, -height, width * 2, height * 2);
            ctx.restore();
        }
    }
}
