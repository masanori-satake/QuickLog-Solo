import { AnimationBase } from '../animations.js';

export default class PlantGrowth extends AnimationBase {
    static metadata = {
        name: { en: "Plant Growth", ja: "植物の成長" },
        description: { en: "A plant that grows and blooms.", ja: "植物が成長し、花を咲かせます。" },
        author: "QuickLog-Solo"
    };
    setup(width, height) {
        this.centerX = width / 2;
        this.bottomY = height - 20;
        this.maxHeight = height * 0.6;
    }

    draw(ctx, { progress }) {
        ctx.strokeStyle = '#fff';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 2;

        // Stem
        const currentHeight = this.maxHeight * Math.min(progress * 1.5, 1);
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.bottomY);
        ctx.lineTo(this.centerX, this.bottomY - currentHeight);
        ctx.stroke();

        // Leaves
        if (progress > 0.3) {
            const leafP = Math.min((progress - 0.3) * 2, 1);
            ctx.beginPath();
            ctx.ellipse(this.centerX - 10, this.bottomY - this.maxHeight * 0.3, 10 * leafP, 5 * leafP, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        }
        if (progress > 0.5) {
            const leafP = Math.min((progress - 0.5) * 2, 1);
            ctx.beginPath();
            ctx.ellipse(this.centerX + 10, this.bottomY - this.maxHeight * 0.5, 10 * leafP, 5 * leafP, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Flower
        if (progress > 0.8) {
            const flowerP = Math.min((progress - 0.8) * 5, 1);
            ctx.globalAlpha = 0.6;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                const angle = (i * Math.PI * 2) / 5;
                ctx.ellipse(this.centerX + Math.cos(angle) * 10 * flowerP,
                            this.bottomY - currentHeight + Math.sin(angle) * 10 * flowerP,
                            8 * flowerP, 4 * flowerP, angle, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        }
    }
}
