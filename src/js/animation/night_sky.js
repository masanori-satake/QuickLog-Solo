import { AnimationBase } from '../animations.js';

export default class NightSky extends AnimationBase {
    static metadata = {
        name: { en: "Night Sky", ja: "夜空" },
        description: { en: "A peaceful night sky where twinkling stars and a moon slowly form a constellation.", ja: "きらめく星々と月がゆっくりと繋がり、星座を描き出す静かな夜空です。" },
        author: "QuickLog-Solo"
    };

    constructor() {
        super();
        this.constellationPoints = [
            {x: 0.2, y: 0.2}, {x: 0.3, y: 0.4}, {x: 0.5, y: 0.3},
            {x: 0.7, y: 0.5}, {x: 0.8, y: 0.2}, {x: 0.6, y: 0.7},
            {x: 0.4, y: 0.8}, {x: 0.2, y: 0.6}, {x: 0.2, y: 0.2}
        ];
        this.backgroundStars = Array(50).fill(0).map(() => ({
            x: Math.random(),
            y: Math.random(),
            size: 1 + Math.random() * 2,
            twinkleOffset: Math.random() * Math.PI * 2
        }));
    }

    setup(width, height) {
        this.w = width;
        this.h = height;
    }

    draw(ctx, { progress }) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#fff';

        // Draw Moon
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(this.w * 0.8, this.h * 0.2, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(this.w * 0.8 - 8, this.h * 0.2 - 5, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        this.backgroundStars.forEach((star, i) => {
            const twinkle = Math.sin(Date.now() / 1000 + star.twinkleOffset) * 0.5 + 0.5;
            ctx.globalAlpha = 0.1 + twinkle * 0.4;
            ctx.beginPath();
            ctx.arc(star.x * this.w, star.y * this.h, star.size, 0, Math.PI * 2);
            ctx.fill();
        });

        this.constellationPoints.forEach((pt, i) => {
            const x = pt.x * this.w;
            const y = pt.y * this.h;
            const twinkle = Math.sin(Date.now() / 500 + i) * 0.5 + 0.5;
            ctx.globalAlpha = 0.5 + twinkle * 0.5;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        const linesToDraw = Math.floor(progress * (this.constellationPoints.length - 1));
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        for (let i = 0; i <= linesToDraw; i++) {
            const x = this.constellationPoints[i].x * this.w;
            const y = this.constellationPoints[i].y * this.h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const shootingP = (Date.now() / 3000) % 5;
        if (shootingP < 1) {
            ctx.globalAlpha = 0.8;
            const sx = this.w * (1.2 - shootingP * 1.5);
            const sy = this.h * (shootingP * 1.2 - 0.2);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + 40, sy - 30);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }
}
