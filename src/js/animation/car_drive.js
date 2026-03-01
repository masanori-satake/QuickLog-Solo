import { AnimationBase } from '../animations.js';

export default class CarDrive extends AnimationBase {
    static metadata = {
        name: { en: "Car Drive", ja: "カー・ドライブ" },
        description: { en: "90s style pseudo-3D driving game. UI text as billboards.", ja: "90年代風疑似3Dドライブゲーム。UIテキストが看板になります。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.roadWidth = width * 0.8;
        this.horizonY = height * 0.4;
        this.carX = width / 2;
        this.carY = height - 20;
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.horizonY = height * 0.4;

        // Draw Sky (simple lines)
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < this.horizonY; i += 10) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;

        // Draw Road (perspective)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(width / 2 - 10, this.horizonY);
        ctx.lineTo(width / 2 + 10, this.horizonY);
        ctx.lineTo(width - 20, height);
        ctx.lineTo(20, height);
        ctx.closePath();
        ctx.fill();

        // Road markings
        const time = (Date.now() / 100) % 10;
        ctx.strokeStyle = '#000';
        ctx.setLineDash([10, 20]);
        ctx.beginPath();
        ctx.moveTo(width / 2, this.horizonY);
        ctx.lineTo(width / 2, height);
        ctx.lineDashOffset = -time * 5;
        ctx.stroke();
        ctx.setLineDash([]);

        // Exclusion Areas as Billboards
        exclusionAreas.forEach((area) => {
            // Calculate a pseudo-depth based on the exclusion area position
            // But they are fixed, so we just add visual cues around them
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;

            // Billboard stand
            ctx.beginPath();
            ctx.moveTo(area.x, area.y + area.height);
            ctx.lineTo(area.x, height);
            ctx.moveTo(area.x + area.width, area.y + area.height);
            ctx.lineTo(area.x + area.width, height);
            ctx.stroke();

            // Billboard frame
            ctx.strokeRect(area.x - 2, area.y - 2, area.width + 4, area.height + 4);
        });

        // The Car
        const carWidth = 30;
        const carHeight = 15;
        const drift = Math.sin(Date.now() / 500) * 10;
        const cx = width / 2 + drift;
        const cy = height - 25;

        ctx.fillStyle = '#000';
        ctx.fillRect(cx - carWidth / 2, cy, carWidth, carHeight);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - carWidth / 2 + 2, cy + 2, carWidth - 4, carHeight - 4);

        // Taillights
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - carWidth / 2 + 2, cy + carHeight - 4, 4, 2);
        ctx.fillRect(cx + carWidth / 2 - 6, cy + carHeight - 4, 4, 2);
    }
}
