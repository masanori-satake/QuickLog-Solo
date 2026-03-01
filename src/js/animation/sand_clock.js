import { AnimationBase } from '../animations.js';

export default class SandClock extends AnimationBase {
    static metadata = {
        name: { en: "Sand Clock", ja: "砂時計" },
        description: { en: "A digital hourglass where sand gradually flows from the top to the bottom.", ja: "上から下へと砂がさらさらと落ちていく、デジタルな砂時計のアニメーションです。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.size = Math.min(width, height) * 0.4;
    }

    draw(ctx, { width, height, progress, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.size = Math.min(width, height) * 0.4;

        let centerX = width / 2;
        let centerY = height / 2;

        if (exclusionAreas && exclusionAreas.length > 0) {
            const margin = this.size + 10;
            const spots = [
                {x: margin, y: margin},
                {x: width - margin, y: margin},
                {x: margin, y: height - margin},
                {x: width - margin, y: height - margin},
                {x: width / 2, y: height / 2}
            ];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot.x + this.size > area.x && spot.x - this.size < area.x + area.width &&
                           spot.y + this.size > area.y && spot.y - this.size < area.y + area.height;
                });
                if (!overlap) {
                    centerX = spot.x;
                    centerY = spot.y;
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

        ctx.fillStyle = '#fff';

        ctx.beginPath();
        ctx.moveTo(centerX - this.size, centerY - this.size);
        ctx.lineTo(centerX + this.size, centerY - this.size);
        ctx.lineTo(centerX, centerY);
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(centerX - this.size, centerY - this.size, this.size * 2, this.size * progress);
        ctx.globalCompositeOperation = 'source-over';

        ctx.beginPath();
        ctx.moveTo(centerX - this.size, centerY + this.size);
        ctx.lineTo(centerX + this.size, centerY + this.size);
        ctx.lineTo(centerX, centerY);
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillRect(centerX - this.size, centerY + this.size - this.size * progress, this.size * 2, this.size * progress);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}
