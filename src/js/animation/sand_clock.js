import { AnimationBase } from '../animations.js';

export default class SandClock extends AnimationBase {
    static metadata = {
        name: { en: "Sand Clock", ja: "砂時計" },
        description: { en: "A digital hourglass where sand gradually flows from the top to the bottom.", ja: "上から下へと砂がさらさらと落ちていく、デジタルな砂時計のアニメーションです。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.size = Math.min(width, height) * 0.4;
    }

    draw(ctx, { progress, exclusionAreas }) {
        ctx.save();
        if (exclusionAreas && exclusionAreas.length > 0) {
            ctx.beginPath();
            ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
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
        ctx.restore();
    }
}
