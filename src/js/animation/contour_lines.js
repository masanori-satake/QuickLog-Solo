import { AnimationBase } from '../animations.js';

export default class ContourLines extends AnimationBase {
    static metadata = {
        name: {
            en: "Contour Lines",
            ja: "等高線",
            de: "Höhenlinien",
            es: "Curvas de nivel",
            fr: "Courbes de niveau",
            pt: "Curvas de nível",
            ko: "등고선",
            zh: "等高线"
        },
        description: {
            en: "Abstract, organic topographic-style lines that flow smoothly.",
            ja: "抽象的で有機的な、流れるような等高線スタイルの曲線です。",
            de: "Abstrakte, organische Linien im topografischen Stil, die sanft fließen.",
            es: "Líneas abstractas y orgánicas de estilo topográfico que fluyen suavemente.",
            fr: "Lignes abstraites et organiques de style topographique qui coulent doucement.",
            pt: "Linhas abstratas e orgânicas de estilo topográfico que fluem suavemente.",
            ko: "부드럽게 흐르는 추상적이고 유기적인 지형 스타일의 선입니다.",
            zh: "抽象、有机的地形风格线条，流动平滑。"
        },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.lineCount = 10;
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

        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;

        const time = Date.now() / 3000;

        for (let i = 0; i < this.lineCount; i++) {
            const radius = 20 + i * 15 + Math.sin(time + i) * 10;
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 2; a += 0.2) {
                const noise = Math.sin(a * 3 + time + i) * 10 * progress;
                const r = radius + noise;
                const x = this.width / 2 + Math.cos(a) * r;
                const y = this.height / 2 + Math.sin(a) * r;
                if (a === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }
        ctx.restore();
    }
}
