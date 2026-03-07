import { AnimationBase } from '../animation_base.js';

/**
 * Smoke Animation
 * Gentle swaying smoke from an incense stick.
 * お線香から立ち上る、ゆったりと揺らめく煙のアニメーションです。
 */
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
            ko: "향불에서 피어오르는 부드럽게 일렁이는 연기입니다。",
            zh: "线香散发出的轻轻摇曳的烟雾。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', usePseudoSpace: false };

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        // Initial particles
        // 粒子の初期化
        this.particles = [];
        for (let i = 0; i < 20; i++) {
            this.particles.push(this.createParticle(Math.random() * width, Math.random() * height, Math.random()));
        }
    }

    /**
     * Create a new smoke particle
     * 新しい煙の粒子を作成
     */
    createParticle(x, y, life = 1.0) {
        return {
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 0.2,
            vy: -Math.random() * 0.4 - 0.2,
            life: life
        };
    }

    /**
     * Main drawing and update loop
     * 描画および更新ループ
     */
    draw(ctx, { exclusionAreas = [] } = {}) {
        const width = this.width;
        const height = this.height;
        const time = Date.now() / 1000;

        // 1. Incense stick placement (Avoid UI)
        // 1. お線香の配置（UIを避ける）
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

        // 2. Draw the incense stick
        // 2. お線香の描画
        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(stickX, stickY);
        ctx.lineTo(stickX, stickY + 5);
        ctx.stroke();

        // 3. Emit new particles
        // 3. 新しい粒子の生成
        if (this.particles.length < 30 && Math.random() < 0.1) {
            this.particles.push(this.createParticle(stickX, stickY));
        }

        // 4. Update and Draw Particles
        // 4. 粒子の更新と描画
        ctx.fillStyle = '#fff';
        this.particles = this.particles.filter(p => {
            p.life -= 0.005;
            // Add horizontal swaying effect using sine wave
            // サイン波を使って左右に揺らす
            p.x += p.vx + Math.sin(time + p.y * 0.05) * 0.3;
            p.y += p.vy;

            // Remove if dead or off-screen
            // 寿命が尽きるか画面外に出たら消去
            if (p.life <= 0 || p.y < 0) return false;

            // Transparency and size change over lifetime
            // 寿命に合わせて透明度と大きさを変える
            ctx.globalAlpha = p.life * 0.3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, (1 - p.life) * 10 + 2, 0, Math.PI * 2);
            ctx.fill();
            return true;
        });

        ctx.globalAlpha = 1.0;
    }
}
