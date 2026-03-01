import { AnimationBase } from '../animations.js';

export default class Clock extends AnimationBase {
    static metadata = {
        name: {
            en: "Clock",
            ja: "時計",
            de: "Uhr",
            es: "Reloj",
            fr: "Horloge",
            pt: "Relógio",
            ko: "시계",
            zh: "时钟"
        },
        description: {
            en: "A simple circular progress indicator using a clock motif.",
            ja: "時計をモチーフにしたシンプルな円形の進捗インジケーターです。",
            de: "Eine einfache kreisförmige Fortschrittsanzeige mit einem Uhrenmotiv.",
            es: "Un simple indicador de progreso circular que utiliza un motivo de reloj.",
            fr: "Un simple indicateur de progression circulaire utilisant un motif d'horloge.",
            pt: "Um simples indicador de progresso circular usando um motivo de relógio.",
            ko: "시계를 모티브로 한 심플한 원형 진행 표시기입니다.",
            zh: "使用时钟图案的简单圆形进度指示器。"
        },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.radius = Math.min(width, height) * 0.4;
    }

    draw(ctx, { width, height, progress, exclusionAreas }) {
        const angle = progress * Math.PI * 2;

        // Dynamic positioning to avoid exclusion areas
        let cx = width / 2;
        let cy = height / 2;

        if (exclusionAreas && exclusionAreas.length > 0) {
            // Find a space that is not covered by exclusion areas
            // For now, let's try top-left, top-right, bottom-left, bottom-right corners
            const margin = this.radius + 10;
            const spots = [
                {x: margin, y: margin},
                {x: width - margin, y: margin},
                {x: margin, y: height - margin},
                {x: width - margin, y: height - margin},
                {x: width / 2, y: height / 2}
            ];

            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot.x + this.radius > area.x && spot.x - this.radius < area.x + area.width &&
                           spot.y + this.radius > area.y && spot.y - this.radius < area.y + area.height;
                });
                if (!overlap) {
                    cx = spot.x;
                    cy = spot.y;
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
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, this.radius, -Math.PI / 2, -Math.PI / 2 + angle);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
