import { AnimationBase } from '../animation_base.js';

/**
 * Horizontal Spotlight Evasion
 * A searchlight sways horizontally back and forth across the floor.
 * A small pixel human silhouette crouches down when overlapping with the spotlight.
 * 白い半透明のサーチライトが地面をなめらかに左右へ往復します。
 * 中央に立つ小さなドット絵の人物は、サーチライトの光が重なる瞬間だけ、身をかがめて(crouch)やり過ごします。
 */
export default class SpotlightEvasion extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Horizontal Spotlight Evasion",
            ja: "サーチライト回避",
            de: "Horizontale Scheinwerfer-Flucht",
            es: "Evasión de foco horizontal",
            fr: "Évasion de projecteur horizontale",
            pt: "Evasão de holofote horizontal",
            ko: "수평 서치라이트 회피",
            zh: "水平探照灯规避"
        },
        description: {
            en: "A translucent white spotlight sways back and forth. The center silhouette crouches whenever the light passes over.",
            ja: "半透明のサーチライトが左右に往復し、中央のシルエットが光を避けるために素早くしゃがみ込みます。",
            de: "Ein durchscheinendes weißes Spotlight schwankt hin und her. Die mittlere Silhouette duckt sich, wann immer das Licht vorbeizieht.",
            es: "Un foco blanco translúcido se balancea de un lado a otro. La silueta central se agacha cuando pasa la luz.",
            fr: "Un projecteur blanc translucide balance d'avant en arrière. La silhouette centrale s'accroupit dès que la lumière passe.",
            pt: "Um holofote branco translúcido balança de um lado para o outro. A silhueta central se agacha sempre que a luz passa.",
            ko: "반투명한 흰색 서치라이트가 좌우로 흔들립니다. 빛이 지나갈 때마다 중앙의 실루엣이 몸을 숙입니다.",
            zh: "一个半透明的白色探照灯左右摇摆。每当光线经过时，中央的剪影就会蹲下。"
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
        this.groundY = 0;
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.groundY = height - Math.max(10, height * 0.15);
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;
        const groundY = this.groundY;

        // Spotlight sway period: 4000ms (smooth sine wave)
        const period = 4000;
        const t = (elapsedMs % period) / period;
        const xOffset = Math.sin(t * Math.PI * 2);

        // Calculate spotlight center position
        const maxOffset = width * 0.4;
        const lightX = (width / 2) + xOffset * maxOffset;

        const lightRadius = Math.max(30, width * 0.15);

        // Center human coordinates
        const humanX = width / 2;
        const humanY = groundY;

        // Check overlap (horizontal distance between lightX and humanX)
        const isOverlap = Math.abs(lightX - humanX) < lightRadius;

        // Human vertical size (Significantly larger for crisp dot representation, but responsive)
        const humanHeight = Math.max(12, Math.min(24, height * 0.45));
        const currentHeight = isOverlap ? (humanHeight * 0.55) : humanHeight;

        // Render Ground Line (bolder and brighter)
        ctx.fillStyle = '#888888';
        ctx.fillRect(0, groundY, width, 2);

        // Draw Translucent Spotlight Cone (Higher opacity so the dots register clearly)
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; // High-visibility opacity
        ctx.beginPath();
        ctx.moveTo(lightX, 0); // Top origin
        ctx.lineTo(lightX - lightRadius, groundY);
        ctx.lineTo(lightX + lightRadius, groundY);
        ctx.closePath();
        ctx.fill();

        // Draw Spotlight beam ellipse on the ground
        ctx.beginPath();
        ctx.ellipse(lightX, groundY, lightRadius, Math.max(6, height * 0.08), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw Human Silhouette (White, Red: 255)
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.translate(humanX, humanY);

        // Drawing a pixel-style figure
        const neckY = -currentHeight;
        const headRadius = Math.max(4, currentHeight * 0.2);

        // Head (larger and bolder)
        ctx.beginPath();
        ctx.arc(0, neckY - headRadius, headRadius + 1, 0, Math.PI * 2);
        ctx.fill();

        // Body / Legs (Much thicker, 3px lines / bold boxes)
        if (isOverlap) {
            // Crouching stance: wider body, squashed height
            ctx.fillRect(-6, -currentHeight, 12, currentHeight);
            // Arms defensively on ground
            ctx.fillRect(-9, -currentHeight + 3, 3, currentHeight - 3);
            ctx.fillRect(6, -currentHeight + 3, 3, currentHeight - 3);
        } else {
            // Standing stance (thicker torso)
            ctx.fillRect(-3, -currentHeight, 6, currentHeight - 5);
            // Legs (Thicker)
            ctx.fillRect(-4, -5, 3, 5);
            ctx.fillRect(1, -5, 3, 5);
            // Arms (Thicker)
            ctx.fillRect(-6, -currentHeight + 3, 3, currentHeight * 0.45);
            ctx.fillRect(3, -currentHeight + 3, 3, currentHeight * 0.45);
        }

        ctx.restore();
    }
}
