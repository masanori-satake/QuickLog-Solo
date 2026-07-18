import { AnimationBase } from '../animation_base.js';

/**
 * Trophy Celebration Static Loop
 * Celebration of getting an item or completing a task in a fantasy RPG.
 * 中央の人物が、チェックボックス（またはチェックマークの入った書類）を
 * 両手で高々と掲げて直立しています。人物は静止していますが、
 * 掲げたアイコンの斜め四隅から、1ピクセル角のキラキラ（瞬き）スパークが
 * 交互に2フレーム周期で発生し、お祝いの活気あるリズムを刻み続けます。
 */
export default class TrophyCelebration extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Trophy Celebration Static Loop",
            ja: "アイテム獲得お祝い",
            de: "Trophäenfeier Statische Schleife",
            es: "Bucle estático de celebración de trofeo",
            fr: "Boucle statique de célébration de trophée",
            pt: "Loop estático de celebração de troféu",
            ko: "트로피 축하 정적 루프",
            zh: "奖杯庆祝静态循环"
        },
        description: {
            en: "A pixel character holds a checkbox icon high. Diagonal 1-pixel sparkles flash alternately to create a celebration rhythm.",
            ja: "チェックボックスを高々と掲げたキャラクターの周囲に、ドットのキラキラが交互に発生してお祝いのリズムを刻みます。",
            de: "Ein Pixel-Held hält ein Häkchen-Symbol hoch. Diagonale 1-Pixel-Funken blinken abwechselnd, um einen Rhythmus zu erzeugen.",
            es: "Un personaje de píxeles sostiene en alto un icono de casilla de verificación. Destellos diagonales de 1 píxel parpadean alternativamente.",
            fr: "Un personnage en pixel tient un icône de case à cocher en l'air. Des étincelles diagonales de 1 pixel clignotent alternativement.",
            pt: "Um personagem de pixel segura um ícone de caixa de seleção no alto. Faíscas diagonais de 1 pixel piscam alternadamente.",
            ko: "픽셀 영웅이 체크박스 아이콘을 높이 들어 올립니다. 대각선 방향으로 1픽셀짜리 불꽃이 번갈아 깜박입니다.",
            zh: "一个像素字符高举复选框图标。对角线方向交替闪烁1像素小火花，渲染庆祝氛围。"
        },
        author: "QuickLog-Solo",
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

        const centerX = width / 2;

        // Toggle sparkles frame every 150ms
        const frameToggle = (Math.floor(elapsedMs / 150) % 2) === 1;

        // Render Ground
        ctx.fillStyle = '#444';
        ctx.fillRect(0, groundY, width, 1);

        // Draw character (static standing, holding arms up)
        const charH = Math.max(12, height * 0.22);
        const headRadius = Math.max(3, charH * 0.2);
        const charY = groundY;

        ctx.save();
        ctx.translate(centerX, charY);

        ctx.fillStyle = '#fff';
        // Head
        ctx.beginPath();
        ctx.arc(0, -charH - headRadius, headRadius, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillRect(-2, -charH, 4, charH - 2);

        // Legs (Standing straight)
        ctx.fillRect(-2, -2, 1, 2);
        ctx.fillRect(1, -2, 1, 2);

        // Arms raised straight up
        ctx.fillRect(-5, -charH - 4, 2, charH * 0.5 + 4);
        ctx.fillRect(3, -charH - 4, 2, charH * 0.5 + 4);

        ctx.restore();

        // Draw Held Checkbox Document Icon (Centered high above head)
        const iconY = groundY - charH - headRadius - 14;
        const iconW = 12;
        const iconH = 12;

        ctx.fillStyle = '#ffeb3b'; // Vibrant gold document border
        ctx.fillRect(centerX - iconW / 2, iconY - iconH / 2, iconW, iconH);

        // Document inner details (white surface with checkmark)
        ctx.fillStyle = '#000';
        ctx.fillRect(centerX - iconW / 2 + 2, iconY - iconH / 2 + 2, iconW - 4, iconH - 4);

        // Green Checkmark inside
        ctx.fillStyle = '#00e676';
        ctx.fillRect(centerX - 2, iconY + 1, 1, 1);
        ctx.fillRect(centerX - 1, iconY + 2, 1, 1);
        ctx.fillRect(centerX, iconY + 1, 1, 1);
        ctx.fillRect(centerX + 1, iconY, 1, 1);
        ctx.fillRect(centerX + 2, iconY - 1, 1, 1);
        ctx.fillRect(centerX + 3, iconY - 2, 1, 1);

        // Alternating sparkles (Diagonal 1-pixel sparkles)
        // Shimmer frame 1: top-left & bottom-right
        // Shimmer frame 2: top-right & bottom-left
        ctx.fillStyle = '#fff';
        if (!frameToggle) {
            // Sparkle set 1
            ctx.fillRect(centerX - iconW / 2 - 4, iconY - iconH / 2 - 4, 2, 2); // Top-left
            ctx.fillRect(centerX + iconW / 2 + 2, iconY + iconH / 2 + 2, 2, 2); // Bottom-right
        } else {
            // Sparkle set 2
            ctx.fillRect(centerX + iconW / 2 + 2, iconY - iconH / 2 - 4, 2, 2); // Top-right
            ctx.fillRect(centerX - iconW / 2 - 4, iconY + iconH / 2 + 2, 2, 2); // Bottom-left
        }
    }
}
