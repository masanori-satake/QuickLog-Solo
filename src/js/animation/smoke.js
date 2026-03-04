import { AnimationBase } from '../animation_base.js';

export default class Smoke extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Smoke",
            ja: "けむり",
            de: "Rauch",
            es: "Humo",
            fr: "Fumée",
            pt: "Fumaça",
            ko: "연기",
            zh: "烟雾"
        },
        description: {
            en: "Gentle swaying smoke from an incense stick.",
            ja: "お線香から立ち上る、ゆったりと揺らめく煙のアニメーションです。",
            de: "Sanft schwankender Rauch von einem Räucherstäbchen.",
            es: "Humo suave que se balancea desde una varita de incienso.",
            fr: "Douce fumée oscillante provenant d'un bâton d'encens.",
            pt: "Fumaça suave oscilando de um incenso.",
            ko: "향불에서 피어오르는 부드럽게 일렁이는 연기입니다.",
            zh: "线香散发出的轻轻摇曳的烟雾。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', usePseudoSpace: false };

    setup(width, height) {
        this.particles = [];
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -Math.random() * 0.5 - 0.2,
                life: Math.random()
            });
        }
    }

    draw(ctx, { width, height, exclusionAreas }) {
        const time = Date.now() / 1000;

        // Base position (incense stick)
        let stickX = width / 2;
        let stickY = height - 10;

        if (exclusionAreas && exclusionAreas.length > 0) {
            const spots = [width * 0.2, width * 0.8, width * 0.5];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot + 20 > area.x && spot - 20 < area.x + area.width;
                });
                if (!overlap) {
                    stickX = spot;
                    break;
                }
            }
        }

        // Draw stick
        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(stickX, stickY);
        ctx.lineTo(stickX, stickY + 5);
        ctx.stroke();

        // Update and draw particles
        if (this.particles.length < 30 && Math.random() < 0.1) {
            this.particles.push({
                x: stickX,
                y: stickY,
                vx: (Math.random() - 0.5) * 0.2,
                vy: -Math.random() * 0.4 - 0.2,
                life: 1.0
            });
        }

        ctx.fillStyle = '#fff';
        this.particles = this.particles.filter(p => {
            p.life -= 0.005;
            p.x += p.vx + Math.sin(time + p.y * 0.05) * 0.3;
            p.y += p.vy;

            if (p.life <= 0 || p.y < 0) return false;

            ctx.globalAlpha = p.life * 0.3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, (1 - p.life) * 10 + 2, 0, Math.PI * 2);
            ctx.fill();
            return true;
        });
        ctx.globalAlpha = 1.0;
    }
}
