import { AnimationBase } from '../animations.js';

export default class NightSky extends AnimationBase {
    static metadata = {
        name: { en: "Night Sky", ja: "夜空" },
        description: { en: "Twinkling stars forming a constellation.", ja: "星座を作る、きらめく星々です。" },
        author: "QuickLog-Solo"
    };
    constructor() {
        super();
        this.points = [
            {x: 0.2, y: 0.2}, {x: 0.3, y: 0.4}, {x: 0.5, y: 0.3},
            {x: 0.7, y: 0.5}, {x: 0.8, y: 0.2}, {x: 0.6, y: 0.7},
            {x: 0.4, y: 0.8}, {x: 0.2, y: 0.6}
        ];
    }
    setup(width, height) {
        this.w = width;
        this.h = height;
    }
    draw(ctx, { progress }) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#fff';

        // Draw stars
        this.points.forEach((pt, i) => {
            const x = pt.x * this.w;
            const y = pt.y * this.h;
            const twinkle = Math.sin(Date.now() / 500 + i) * 0.5 + 0.5;
            ctx.globalAlpha = 0.3 + twinkle * 0.7;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw lines
        const linesToDraw = Math.floor(progress * this.points.length);
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        for (let i = 0; i <= linesToDraw && i < this.points.length; i++) {
            const x = this.points[i].x * this.w;
            const y = this.points[i].y * this.h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Reveal motif at the end
        if (progress > 0.9) {
            ctx.globalAlpha = (progress - 0.9) * 5;
            ctx.font = "40px serif";
            ctx.textAlign = "center";
            ctx.fillText("✨", this.w / 2, this.h / 2);
        }
    }
}
