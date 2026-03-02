import { AnimationBase } from '../animations.js';

export default class Ripple extends AnimationBase {
    static metadata = {
        name: {
            en: "Ripple",
            ja: "波紋",
            de: "Wellen",
            es: "Ondas",
            fr: "Ondulations",
            pt: "Ondulações",
            ko: "파문",
            zh: "涟漪"
        },
        description: {
            en: "Dynamic concentric ripples that expand and fade across the background.",
            ja: "画面いっぱいに広がり、消えていくダイナミックな同心円状の波紋です。",
            de: "Dynamische konzentrische Wellen, die sich über den Hintergrund ausbreiten und verblassen.",
            es: "Ondas concéntricas dinámicas que se expanden y se desvanecen por el fondo.",
            fr: "Ondulations concentriques dynamiques qui s'étendent et s'estompent sur l'arrière-plan.",
            pt: "Ondulações concêntricas dinâmicas que se expandem e desaparecem pelo fundo.",
            ko: "배경을 가로질러 확장되고 사라지는 다이내믹한 동심원 파문입니다.",
            zh: "动态同心涟漪在背景中扩散并淡出。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', usePseudoSpace: true };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.ripples = [];
        this.maxRadius = Math.sqrt(width * width + height * height) / 2;
    }

    onClick(x, y) {
        this.ripples.push({
            x, y,
            radius: 0,
            life: 1.0,
            speed: 2
        });
    }

    draw(ctx, { width, height, progress }) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;

        // Randomly add new ripple sources
        if (Math.random() < 0.03 + progress * 0.07) {
            this.ripples.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: 0,
                life: 1.0,
                speed: 1 + Math.random() * 1.5
            });
        }

        // Animate Ripples
        this.ripples.forEach((r) => {
            r.radius += r.speed;
            r.life -= 0.01;

            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.globalAlpha = r.life * 0.5;
            ctx.stroke();

            // Inner circle
            if (r.radius > 10) {
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.radius - 10, 0, Math.PI * 2);
                ctx.globalAlpha = r.life * 0.3;
                ctx.stroke();
            }
        });

        // Remove dead ripples
        this.ripples = this.ripples.filter(r => r.life > 0 && r.radius < this.maxRadius);
        ctx.globalAlpha = 1.0;
    }
}
