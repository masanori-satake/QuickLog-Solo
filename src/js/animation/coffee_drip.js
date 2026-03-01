import { AnimationBase } from '../animations.js';

export default class CoffeeDrip extends AnimationBase {
    static metadata = {
        name: { en: "Coffee Drip", ja: "コーヒードリップ" },
        description: { en: "A relaxing coffee brewing animation that fills the pot.", ja: "ポットにコーヒーが溜まっていく、リラックスできるドリップアニメーションです。" },
        author: "QuickLog-Solo"
    };
    setup(width) {
        this.centerX = width / 2;
    }

    draw(ctx, { progress }) {
        ctx.fillStyle = '#fff';

        // Filter/Dripper shape
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(this.centerX - 30, 20);
        ctx.lineTo(this.centerX + 30, 20);
        ctx.lineTo(this.centerX + 5, 50);
        ctx.lineTo(this.centerX - 5, 50);
        ctx.closePath();
        ctx.fill();

        // Server/Pot shape
        ctx.beginPath();
        ctx.rect(this.centerX - 25, 60, 50, 40);
        ctx.stroke();

        // Drip droplets
        const dropP = (Date.now() / 1000) % 1;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(this.centerX, 50 + dropP * 30, 3, 0, Math.PI * 2);
        ctx.fill();

        // Filling coffee
        ctx.globalAlpha = 0.6;
        const fillHeight = 40 * progress;
        ctx.fillRect(this.centerX - 24, 100 - fillHeight, 48, fillHeight);
    }
}
