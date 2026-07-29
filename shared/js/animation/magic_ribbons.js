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
            ko: "색상 픽셀 리본이 중앙의 실루엣을 따라 입체적으로 회전하며 상승하고, 맨 위에서 스파크 입자를 발산합니다.",
            zh: "彩色像素带围绕中央静态剪影呈立体螺旋状上升，在顶部达到粒子爆发的高潮。"
        },
        author: "QuickLog-Solo",
        devOnly: true,
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;
        const centerX = width / 2;

        // Central Silhouette drawing
        const charH = Math.max(30, height * 0.45);
        const headRadius = Math.max(3, charH * 0.16);
        const charY = (height / 2) + (charH / 2);

        // Ribbon 1 (Pink/Rose) and Ribbon 2 (Golden Yellow) (Both have Red: 255)
        const ribbon1Color = '#ff4081';
        const ribbon2Color = '#ffd600';

        // Draw the central character silhouette again (already drawn behind, so we only redraw to sandwich correctly)
        // Sandwich is done by:
        // 1. Draw Behind Ribbon points (sin < 0)
        // 2. Draw Central Silhouette
        // 3. Draw Front Ribbon points (sin >= 0)
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
                ctx.fillRect(centerX + xOff1 * swingRadius - 3, y - 3, 6, 6); // Thicker 6x6 points
            }
            if (xOff2 < 0) {
                ctx.fillStyle = ribbon2Color;
                ctx.fillRect(centerX + xOff2 * swingRadius - 3, y - 3, 6, 6);
            }
        }

        // 2. Draw Central Silhouette (White for maximum contrast under dot matrix)
        ctx.fillStyle = '#ffffff';
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
                ctx.fillRect(centerX + xOff1 * swingRadius - 3, y - 3, 6, 6); // Thicker 6x6 points
            }
            if (xOff2 >= 0) {
                ctx.fillStyle = ribbon2Color;
                ctx.fillRect(centerX + xOff2 * swingRadius - 3, y - 3, 6, 6);
            }
        }

        // Particle blast at the top (Stateless & deterministic)
        // Triggered periodically every 2 seconds, lasting for 400ms
        const blastPeriod = 2000;
        const blastTime = elapsedMs % blastPeriod;
        if (blastTime < 400) {
            const pProgress = blastTime / 400;
            const distance = 36 * pProgress;
            ctx.fillStyle = '#fff9c4'; // Spark yellow-white
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const px = centerX + Math.cos(angle) * distance;
                const py = 15 + Math.sin(angle) * distance;
                ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3); // Thicker sparks
            }
        }
    }
}
