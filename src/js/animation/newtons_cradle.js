import { AnimationBase } from '../animation_base.js';

export default class NewtonsCradle extends AnimationBase {
    static metadata = {
        name: {
            en: "Newton's Cradle",
            ja: "ニュートンのゆりかご",
            de: "Newton-Pendel",
            es: "Cuna de Newton",
            fr: "Pendule de Newton",
            pt: "Berço de Newton",
            ko: "뉴턴의 요람",
            zh: "牛顿摆"
        },
        description: {
            en: "A simulation of the classic physical office toy.",
            ja: "古典的な物理玩具である「ニュートンのゆりかご」のシミュレーションです。",
            de: "Eine Simulation des klassischen physikalischen Bürospielzeugs.",
            es: "Una simulación del clásico juguete físico de oficina.",
            fr: "Une simulation du jouet de bureau physique classique.",
            pt: "Uma simulação do clássico brinquedo físico de escritório.",
            ko: "고전적인 물리 사무용 장난감인 '뉴턴의 요람' 시뮬레이션입니다.",
            zh: "经典办公物理玩具的模拟。"
        },
        author: "QuickLog-Solo"
    };
    config = { mode: 'canvas', usePseudoSpace: false };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.ballCount = 5;
        this.ballRadius = 10;
        this.stringLength = height / 2;
    }

    draw(ctx, { width, height, progress, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.stringLength = height / 2;

        let centerX = width / 2;
        let centerY = height / 3;

        if (exclusionAreas && exclusionAreas.length > 0) {
            const w = this.ballRadius * 2 * this.ballCount;
            const h = this.stringLength + this.ballRadius;
            const spots = [
                {x: w/2 + 10, y: height/3},
                {x: width - w/2 - 10, y: height/3},
                {x: width / 2, y: height / 3}
            ];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot.x + w/2 > area.x && spot.x - w/2 < area.x + area.width &&
                           spot.y + h > area.y && spot.y < area.y + area.height;
                });
                if (!overlap) {
                    centerX = spot.x;
                    centerY = spot.y;
                    break;
                }
            }
        }

        ctx.strokeStyle = '#fff';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 1;

        const amplitude = Math.PI / 6 * (1 + 0.2 * Math.sin(progress * Math.PI * 10));
        const time = Date.now() / 300;
        const angle = Math.sin(time);

        for (let i = 0; i < this.ballCount; i++) {
            let currentAngle = 0;
            if (i === 0 && angle < 0) currentAngle = angle * amplitude;
            if (i === this.ballCount - 1 && angle > 0) currentAngle = angle * amplitude;

            const x = centerX + (i - (this.ballCount - 1) / 2) * this.ballRadius * 2;
            const bx = x + Math.sin(currentAngle) * this.stringLength;
            const by = centerY + Math.cos(currentAngle) * this.stringLength;

            ctx.beginPath();
            ctx.moveTo(x, centerY);
            ctx.lineTo(bx, by);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(bx, by, this.ballRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
