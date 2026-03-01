import { AnimationBase } from '../animations.js';

export default class PlantGrowth extends AnimationBase {
    static metadata = {
        name: { en: "Plant Growth", ja: "植物の成長" },
        description: { en: "A minimalist animation of a plant growing leaves and blooming over time.", ja: "茎が伸び、葉が茂り、やがて花を咲かせる植物の成長アニメーションです。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.bottomY = height - 20;
        this.maxHeight = height * 0.6;
    }

    draw(ctx, { width, height, progress, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.bottomY = height - 20;
        this.maxHeight = height * 0.6;

        let centerX = width / 2;
        if (exclusionAreas && exclusionAreas.length > 0) {
            const spots = [width * 0.2, width * 0.8, width * 0.5];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot + 20 > area.x && spot - 20 < area.x + area.width &&
                           this.bottomY - this.maxHeight < area.y + area.height && this.bottomY > area.y;
                });
                if (!overlap) {
                    centerX = spot;
                    break;
                }
            }
        }

        ctx.save();
        if (exclusionAreas && exclusionAreas.length > 0) {
            ctx.beginPath();
            ctx.rect(0, 0, width, height);
            exclusionAreas.forEach(area => {
                ctx.moveTo(area.x, area.y);
                ctx.lineTo(area.x, area.y + area.height);
                ctx.lineTo(area.x + area.width, area.y + area.height);
                ctx.lineTo(area.x + area.width, area.y);
                ctx.closePath();
            });
            ctx.clip("evenodd");
        }

        ctx.strokeStyle = '#fff';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 2;

        const currentHeight = this.maxHeight * Math.min(progress * 1.5, 1);
        ctx.beginPath();
        ctx.moveTo(centerX, this.bottomY);
        ctx.lineTo(centerX, this.bottomY - currentHeight);
        ctx.stroke();

        if (progress > 0.3) {
            const leafP = Math.min((progress - 0.3) * 2, 1);
            ctx.beginPath();
            ctx.ellipse(centerX - 10, this.bottomY - this.maxHeight * 0.3, 10 * leafP, 5 * leafP, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        }
        if (progress > 0.5) {
            const leafP = Math.min((progress - 0.5) * 2, 1);
            ctx.beginPath();
            ctx.ellipse(centerX + 10, this.bottomY - this.maxHeight * 0.5, 10 * leafP, 5 * leafP, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        }

        if (progress > 0.8) {
            const flowerP = Math.min((progress - 0.8) * 5, 1);
            ctx.globalAlpha = 0.6;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                const angle = (i * Math.PI * 2) / 5;
                ctx.ellipse(centerX + Math.cos(angle) * 10 * flowerP,
                            this.bottomY - currentHeight + Math.sin(angle) * 10 * flowerP,
                            8 * flowerP, 4 * flowerP, angle, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        }
        ctx.restore();
    }
}
