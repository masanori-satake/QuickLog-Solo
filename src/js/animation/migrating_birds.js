import { AnimationBase } from '../animations.js';

export default class MigratingBirds extends AnimationBase {
    static metadata = {
        name: { en: "Migrating Birds", ja: "渡り鳥" },
        description: { en: "Birds flying across the screen in a classic V-formation.", ja: "画面を横切ってV字型に飛んでいく渡り鳥の群れです。" },
        author: "QuickLog-Solo"
    };
    setup(width, height) {
        this.w = width;
        this.h = height;
        this.yBase = height / 2;
        this.birdCount = 7;
        this.birdSize = 10;
        this.spacing = 30;
    }

    draw(ctx, { progress }) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;

        const xBase = -100 + (this.w + 200) * progress;

        for (let i = 0; i < this.birdCount; i++) {
            const offset = i - Math.floor(this.birdCount / 2);
            const bx = xBase - Math.abs(offset) * this.spacing;
            const by = this.yBase + offset * this.spacing * 0.5;

            const flap = Math.sin(Date.now() / 100 + i) * 5;

            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - this.birdSize, by - flap);
            ctx.lineTo(bx - this.birdSize * 0.5, by);
            ctx.lineTo(bx - this.birdSize, by + flap);
            ctx.fill();
        }

        // Surprise bird (flying opposite)
        if (progress > 0.4 && progress < 0.6) {
            const sx = this.w + 100 - (this.w + 200) * (progress - 0.4) * 5;
            const sy = this.h * 0.2;
            const flap = Math.sin(Date.now() / 80) * 4;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + this.birdSize, sy - flap);
            ctx.lineTo(sx + this.birdSize * 0.5, sy);
            ctx.lineTo(sx + this.birdSize, sy + flap);
            ctx.fill();
        }
    }
}
