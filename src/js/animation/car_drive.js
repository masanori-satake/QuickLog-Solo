import { AnimationBase } from '../animations.js';

export default class CarDrive extends AnimationBase {
    static metadata = {
        name: { en: "Car Drive", ja: "カー・ドライブ" },
        description: { en: "90s style pseudo-3D driving game. UI text appears as roadside billboards.", ja: "90年代風の疑似3Dドライブゲーム。UIのテキストが道路脇の看板として登場します。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.horizonY = height * 0.45;
        this.mountains = Array(5).fill(0).map((_, i) => ({
            x: (i / 5) * width,
            width: width * (0.3 + Math.random() * 0.4),
            height: height * (0.1 + Math.random() * 0.2)
        }));
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.horizonY = height * 0.45;
        const time = Date.now() / 1000;
        const speed = 5;

        // Draw Sky
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, this.horizonY);

        // Stars in the sky
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 20; i++) {
            const sx = (Math.sin(i * 123.45) * 0.5 + 0.5) * width;
            const sy = (Math.cos(i * 678.9) * 0.5 + 0.5) * this.horizonY;
            ctx.fillRect(sx, sy, 1, 1);
        }
        ctx.globalAlpha = 1.0;

        // Draw Mountains (scrolling)
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.2;
        const scrollX = (time * 10) % width;
        this.mountains.forEach(m => {
            let mx = (m.x - scrollX + width) % width;
            ctx.beginPath();
            ctx.moveTo(mx, this.horizonY);
            ctx.lineTo(mx + m.width / 2, this.horizonY - m.height);
            ctx.lineTo(mx + m.width, this.horizonY);
            ctx.fill();

            // Draw duplicate for wrap-around
            if (mx + m.width > width) {
                let mx2 = mx - width;
                ctx.beginPath();
                ctx.moveTo(mx2, this.horizonY);
                ctx.lineTo(mx2 + m.width / 2, this.horizonY - m.height);
                ctx.lineTo(mx2 + m.width, this.horizonY);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1.0;

        // Draw Road (perspective)
        ctx.fillStyle = '#fff';
        const roadBottomWidth = width * 0.8;
        const roadTopWidth = 20;
        ctx.beginPath();
        ctx.moveTo(width / 2 - roadTopWidth / 2, this.horizonY);
        ctx.lineTo(width / 2 + roadTopWidth / 2, this.horizonY);
        ctx.lineTo(width / 2 + roadBottomWidth / 2, height);
        ctx.lineTo(width / 2 - roadBottomWidth / 2, height);
        ctx.closePath();
        ctx.fill();

        // Road markings (scrolling)
        const roadTime = (time * speed) % 1;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const p = (i / 5 + roadTime / 5) % 1;
            // Perspective mapping: y = horizon + p^2 * (height - horizon)
            const y = this.horizonY + (p * p) * (height - this.horizonY);
            const w = roadTopWidth + p * (roadBottomWidth - roadTopWidth);
            const markingLen = 10 * p;

            ctx.beginPath();
            ctx.moveTo(width / 2, y);
            ctx.lineTo(width / 2, y + markingLen);
            ctx.stroke();
        }

        // Exclusion Areas as Billboards with perspective
        exclusionAreas.forEach((area) => {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;

            // Billboard frame
            ctx.strokeRect(area.x - 2, area.y - 2, area.width + 4, area.height + 4);

            // Billboard stand (to the side of the road)
            ctx.beginPath();
            // Side depends on where the area is
            const sideX = (area.x + area.width / 2 < width / 2) ? area.x : area.x + area.width;
            ctx.moveTo(sideX, area.y + area.height);
            ctx.lineTo(sideX, height);
            ctx.stroke();
        });

        // The Car (player)
        const carWidth = 40;
        const carHeight = 20;
        const drift = Math.sin(time * 2) * 20;
        const cx = width / 2 + drift;
        const cy = height - 30;

        // Car Body
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - carWidth / 2, cy, carWidth, carHeight);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - carWidth / 2 + 2, cy + 2, carWidth - 4, carHeight - 4);

        // Windshield
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - carWidth / 2 + 6, cy + 4, carWidth - 12, carHeight / 2);

        // Taillights
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - carWidth / 2 + 4, cy + carHeight - 6, 6, 3);
        ctx.fillRect(cx + carWidth / 2 - 10, cy + carHeight - 6, 6, 3);
    }
}
