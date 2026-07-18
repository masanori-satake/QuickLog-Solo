import { AnimationBase } from '../animation_base.js';

/**
 * Aura Charge & Particle Spark
 * A powering-up dark silhouette with a pulsing core and emitting sparks.
 * 中央にかがんだ姿勢の暗い人のシルエットがあり、手元で青いエネルギー弾が拡大縮小（パルス）します。
 * 100msごとに、エネルギーの核から四角いスパーク粒子が斜め方向にランダムに飛び散り、フェードアウトします。
 */
export default class AuraCharge extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Aura Charge & Particle Spark",
            ja: "オーラチャージ",
            de: "Aura-Aufladung & Partikelfunken",
            es: "Carga de aura y chispas de partículas",
            fr: "Charge d'aura et étincelles de particules",
            pt: "Carga de aura e faíscas de partículas",
            ko: "아우라 차지 & 파티클 스파크",
            zh: "气场充电与粒子火花"
        },
        description: {
            en: "A dark silhouette powers up in the center. A cyan pixel orb pulses while sparks emit diagonally and fade out.",
            ja: "暗い人影がエネルギーを充填。手元の青い光が脈動し、四角いスパーク粒子が斜め外側へ飛び散ります。",
            de: "Eine dunkle Silhouette lädt sich im Zentrum auf. Eine cyanfarbene Pixel-Kugel pulsiert, während Funken diagonal emittiert werden und verblassen.",
            es: "Una silueta oscura se carga de energía en el centro. Una orbe de píxeles cian pulsa mientras las chispas se emiten diagonalmente y se desvanecen.",
            fr: "Une silhouette sombre se charge en énergie au centre. Un orbe de pixels cyan pulse tandis que des étincelles sont émises en diagonale et s'estompent.",
            pt: "Uma silhueta escura se carrega de energia no centro. Uma órbita de pixels ciano pulsa enquanto faíscas são emitidas diagonalmente e desaparecem.",
            ko: "어두운 실루엣이 중앙에서 기를 모읍니다. 시안색 픽셀 구체가 진동하며 대각선으로 스파크가 튀고 사라집니다.",
            zh: "一个黑暗的剪影在中心充电。一个青色的像素球体脉动，同时火花向对角线发射并淡出。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        this.sparks = [];
        this.lastSparkTime = 0;
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.sparks = [];
        this.lastSparkTime = 0;
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;
        const centerX = width / 2;
        const centerY = height / 2;

        // 100ms interval for spawning new sparks
        if (elapsedMs - this.lastSparkTime > 100) {
            this.lastSparkTime = elapsedMs;
            // Generate 1-2 sparks diagonally outward
            const angles = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
            const randAngle = angles[Math.floor(Math.random() * angles.length)] + (Math.random() - 0.5) * 0.3;
            const speed = 2.0 + Math.random() * 2.0;

            this.sparks.push({
                x: centerX,
                y: centerY + 5, // Close to character hands
                vx: Math.cos(randAngle) * speed,
                vy: Math.sin(randAngle) * speed,
                life: 300 // ms
            });
        }

        // Update sparks
        this.sparks = this.sparks.filter(s => s.life > 0);
        this.sparks.forEach(s => {
            s.x += s.vx;
            s.y += s.vy;
            s.life -= 16.67; // approx frame time
        });

        // Draw Sparks (cyan/blue pixels)
        ctx.fillStyle = '#4fc3f7';
        this.sparks.forEach(s => {
            const opacity = Math.max(0, s.life / 300);
            ctx.fillStyle = `rgba(79, 195, 247, ${opacity})`;
            ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
        });

        // Pulsing orb in character's hands
        const pulse = 1.0 + 0.25 * Math.sin((elapsedMs / 150) * Math.PI * 2);
        const orbRadius = Math.max(4, height * 0.05) * pulse;

        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(centerX, centerY + 5, orbRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw Powering-up Crouching Silhouette
        ctx.fillStyle = '#37474f'; // Dark steel grey

        const charH = Math.max(20, height * 0.3);
        const headRadius = Math.max(3, charH * 0.2);

        ctx.save();
        ctx.translate(centerX, centerY + 15);

        // Head (crouched forward slightly)
        ctx.beginPath();
        ctx.arc(-2, -charH - headRadius, headRadius, 0, Math.PI * 2);
        ctx.fill();

        // Crouched Torso
        ctx.fillRect(-5, -charH, 8, charH - 6);

        // Knees bent (legs)
        ctx.fillRect(-9, -6, 4, 6);
        ctx.fillRect(5, -6, 4, 6);

        // Arms clutching toward center hands (core)
        ctx.fillRect(-8, -charH + 4, 3, 5);
        ctx.fillRect(5, -charH + 4, 3, 5);

        ctx.restore();
    }
}
