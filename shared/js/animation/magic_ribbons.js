import { AnimationBase } from '../animation_base.js';

/**
 * Twin Magical Spiral Ribbons
 * Transformation effect of magical ribbons winding around a central silhouette.
 * 中央の静止した人影を、2本の対照的な色の光のリボンがサイン波を描きながら上昇して包み込みます。
 * 描画の前後レイヤー関係（z-index風）を切り替えることで、立体的に前後に巻き付いているように表現します。
 * 上端に到達した際に、小さな火花の粒子を放ち、ループします。
 */
export default class MagicRibbons extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Twin Magical Spiral Ribbons",
            ja: "変身エフェクト",
            de: "Magische Spiralbänder",
            es: "Cintas espirales mágicas dobles",
            fr: "Rubans spiraux magiques jumeaux",
            pt: "Fitas espirais mágicas duplas",
            ko: "트윈 매지컬 나선 리본",
            zh: "双魔法螺旋丝带"
        },
        description: {
            en: "Colored pixel ribbons spiral stereoscopically around a central static silhouette, culminating in a particle burst at the top.",
            ja: "中央のシルエットに沿って、2色のピクセルリボンがサイン波を描き、前後に立体交差しながら上昇して上端で弾けます。",
            de: "Farbige Pixelbänder spiralen sich stereoskopisch um eine zentrale statische Silhouette und gipfeln in einem Partikelausbruch oben.",
            es: "Cintas de píxeles de colores giran estereoscópicamente alrededor de una silueta estática central, culminando en un estallido de partículas en la parte superior.",
            fr: "Des rubans de pixels colorés spiralent de manière stéréoscopique autour d'une silhouette statique centrale, culminant par une explosion de particules au sommet.",
            pt: "Fitas de pixels coloridos espiralam estereoscopicamente em torno de uma silhueta estática central, culminando em uma explosão de partículas no topo.",
            ko: "색상 픽셀 리본이 중앙의 실루エット을 따라 입체적으로 회전하며 상승하고, 맨 위에서 스파크 입자를 발산합니다.",
            zh: "彩色像素带围绕中央静态剪影呈立体螺旋状上升，在顶部达到粒子爆发的高潮。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        this.particles = [];
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.particles = [];
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;
        const centerX = width / 2;

        // Central Silhouette drawing
        const charH = Math.max(30, height * 0.45);
        const headRadius = Math.max(3, charH * 0.16);
        const charY = (height / 2) + (charH / 2);

        // Draw Central Silhouette (behind ribbons)
        ctx.fillStyle = '#263238'; // Very dark slate grey
        ctx.save();
        ctx.translate(centerX, charY);

        // Head
        ctx.beginPath();
        ctx.arc(0, -charH - headRadius, headRadius, 0, Math.PI * 2);
        ctx.fill();

        // Elegant standing posture
        ctx.fillRect(-3, -charH, 6, charH - 12);
        // Legs
        ctx.fillRect(-3, -12, 2, 12);
        ctx.fillRect(1, -12, 2, 12);
        // Arms slightly outward
        ctx.fillRect(-6, -charH + 2, 3, charH * 0.4);
        ctx.fillRect(3, -charH + 2, 3, charH * 0.4);

        ctx.restore();

        // Spiral ribbons math parameters
        // Rising speed
        const speed = 0.15; // pixels/ms
        const ribbonLength = height;

        // Ribbon 1 (Pink/Rose) and Ribbon 2 (Cyan)
        const ribbon1Color = '#f06292';
        const ribbon2Color = '#26c6da';

        // We plot multiple points along the ribbon height
        // To make it look "behind" or "in front" of the silhouette, we check the sine wave phase.
        // If sin > 0, it is IN FRONT (rendered after).
        // If sin < 0, it is BEHIND (rendered before).

        const drawRibbonPoint = (y, color, isFrontPass) => {
            // Spiral horizontal offset
            // Sine wave based on Y coordinate + time
            // frequency: 1 full cycle every 50 pixels
            const phase = (elapsedMs * 0.005) - (y * 0.05);
            const xOffset = Math.sin(phase);
            const swingRadius = Math.max(12, width * 0.08);

            // Phase checking for front/back layering
            const isFront = xOffset >= 0;

            if (isFront === isFrontPass) {
                ctx.fillStyle = color;
                ctx.fillRect(centerX + xOffset * swingRadius - 2, y - 2, 4, 4);
            }
        };

        // Draw BEHIND layers first
        for (let y = height; y >= 0; y -= 4) {
            drawRibbonPoint(y, ribbon1Color, false);
            // Ribbon 2 is shifted by half cycle
            drawRibbonPoint(y, ribbon2Color, true); // Ribbon 2 phase is inverted
        }

        // Draw the central character silhouette again (already drawn behind, so we only redraw to sandwich correctly)
        // Wait, sandwich is done by:
        // 1. Draw Behind Ribbon points (sin < 0)
        // 2. Draw Central Silhouette
        // 3. Draw Front Ribbon points (sin >= 0)
        // This is perfectly stereoscopic! Let's implement it exactly:
        ctx.clearRect(0, 0, width, height); // Clear first to allow clean sandwich layers

        // 1. Draw BEHIND points
        for (let y = height; y >= 0; y -= 4) {
            // phase shift Ribbon 2
            const phase1 = (elapsedMs * 0.005) - (y * 0.05);
            const phase2 = phase1 + Math.PI;

            const xOff1 = Math.sin(phase1);
            const xOff2 = Math.sin(phase2);
            const swingRadius = Math.max(12, width * 0.08);

            if (xOff1 < 0) {
                ctx.fillStyle = ribbon1Color;
                ctx.fillRect(centerX + xOff1 * swingRadius - 2, y - 2, 4, 4);
            }
            if (xOff2 < 0) {
                ctx.fillStyle = ribbon2Color;
                ctx.fillRect(centerX + xOff2 * swingRadius - 2, y - 2, 4, 4);
            }
        }

        // 2. Draw Central Silhouette
        ctx.fillStyle = '#263238';
        ctx.save();
        ctx.translate(centerX, charY);
        ctx.beginPath();
        ctx.arc(0, -charH - headRadius, headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-3, -charH, 6, charH - 12);
        ctx.fillRect(-3, -12, 2, 12);
        ctx.fillRect(1, -12, 2, 12);
        ctx.fillRect(-6, -charH + 2, 3, charH * 0.4);
        ctx.fillRect(3, -charH + 2, 3, charH * 0.4);
        ctx.restore();

        // 3. Draw FRONT points
        for (let y = height; y >= 0; y -= 4) {
            const phase1 = (elapsedMs * 0.005) - (y * 0.05);
            const phase2 = phase1 + Math.PI;

            const xOff1 = Math.sin(phase1);
            const xOff2 = Math.sin(phase2);
            const swingRadius = Math.max(12, width * 0.08);

            if (xOff1 >= 0) {
                ctx.fillStyle = ribbon1Color;
                ctx.fillRect(centerX + xOff1 * swingRadius - 2, y - 2, 4, 4);
            }
            if (xOff2 >= 0) {
                ctx.fillStyle = ribbon2Color;
                ctx.fillRect(centerX + xOff2 * swingRadius - 2, y - 2, 4, 4);
            }
        }

        // Particle blast at the top
        // Triggered periodically every 2 seconds
        const blastPeriod = 2000;
        const blastTime = elapsedMs % blastPeriod;
        if (blastTime < 30 && this.particles.length === 0) {
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                this.particles.push({
                    x: centerX,
                    y: 15,
                    vx: Math.cos(angle) * 1.5,
                    vy: Math.sin(angle) * 1.5,
                    life: 400
                });
            }
        }

        // Update and draw particles
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 16.67;
        });
        this.particles = this.particles.filter(p => p.life > 0);

        ctx.fillStyle = '#fff9c4'; // Spark yellow-white
        this.particles.forEach(p => {
            ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        });
    }
}
