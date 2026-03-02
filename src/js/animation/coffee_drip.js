import { AnimationBase } from '../animation_base.js';

export default class CoffeeDrip extends AnimationBase {
    static metadata = {
        name: {
            en: "Coffee Drip",
            ja: "コーヒードリップ",
            de: "Kaffee-Drip",
            es: "Goteo de café",
            fr: "Goutte à goutte de café",
            pt: "Café coado",
            ko: "커피 드립",
            zh: "咖啡滴漏"
        },
        description: {
            en: "A relaxing coffee brewing animation that fills the pot.",
            ja: "ポットにコーヒーが溜まっていく、リラックスできるドリップアニメーションです。",
            de: "Eine entspannende Kaffeebrüh-Animation, die die Kanne füllt.",
            es: "Una relajante animación de preparación de café que llena la cafetera.",
            fr: "Une animation relaxante de préparation de café qui remplit la verseuse.",
            pt: "Uma animação relaxante de preparo de café que enche a jarra.",
            ko: "포트에 커피가 차오르는 편안한 드립 애니메이션입니다.",
            zh: "一种放松的咖啡冲泡动画，咖啡壶逐渐装满。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', usePseudoSpace: false };

    setup(width) {
        this.width = width;
    }

    draw(ctx, { width, progress, exclusionAreas }) {
        this.width = width;
        let centerX = width * 0.2; // Default to left side

        if (exclusionAreas && exclusionAreas.length > 0) {
            const spots = [width * 0.15, width * 0.85, width * 0.25, width * 0.75];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot + 30 > area.x && spot - 30 < area.x + area.width;
                });
                if (!overlap) {
                    centerX = spot;
                    break;
                }
            }
        }

        ctx.fillStyle = '#fff';

        // Filter/Dripper shape
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(centerX - 30, 20);
        ctx.lineTo(centerX + 30, 20);
        ctx.lineTo(centerX + 5, 50);
        ctx.lineTo(centerX - 5, 50);
        ctx.closePath();
        ctx.fill();

        // Server/Pot shape
        ctx.globalAlpha = 1.0;
        ctx.strokeRect(centerX - 25, 60, 50, 40);

        // Drip droplets
        const dropP = (Date.now() / 1000) % 1;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(centerX, 50 + dropP * 30, 3, 0, Math.PI * 2);
        ctx.fill();

        // Filling coffee
        ctx.globalAlpha = 0.6;
        const fillHeight = 40 * progress;
        ctx.fillRect(centerX - 24, 100 - fillHeight, 48, fillHeight);
        ctx.globalAlpha = 1.0;
    }
}
