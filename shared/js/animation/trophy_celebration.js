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

        const centerX = width / 2;

        // Toggle sparkles frame every 150ms
        const frameToggle = (Math.floor(elapsedMs / 150) % 2) === 1;

        // Render Ground (brighter grey)
        ctx.fillStyle = '#888888';
        ctx.fillRect(0, groundY, width, 2);

        // Draw character (static standing, holding arms up) - responsive sizing to prevent clipping
        const charH = Math.round(Math.max(12, Math.min(24, height * 0.38)));
        const headRadius = Math.round(Math.max(3, Math.min(5, charH * 0.2)));
        const charY = groundY;
        const roundedCenterX = Math.round(centerX);

        ctx.save();
        ctx.translate(roundedCenterX, Math.round(charY));

        ctx.fillStyle = '#ffffff'; // Pure white (Red: 255)
        // Head
        ctx.beginPath();
        ctx.arc(0, -charH - headRadius, headRadius + 1, 0, Math.PI * 2);
        ctx.fill();

        // Body (Thicker torso, 6px wide)
        ctx.fillRect(-3, -charH, 6, charH - 4);

        // Legs (Standing straight, 3px wide)
        ctx.fillRect(-3, -4, 2, 4);
        ctx.fillRect(1, -4, 2, 4);

        // Arms raised straight up (Thicker arms, 3px wide)
        ctx.fillRect(-7, -charH - 6, 3, charH * 0.5 + 6);
        ctx.fillRect(4, -charH - 6, 3, charH * 0.5 + 6);

        ctx.restore();

        // Draw Held Checkbox Document Icon (Centered high above head) - responsive sizing to prevent clipping
        const iconOffset = height >= 60 ? 18 : 12;
        const iconY = Math.round(groundY - charH - headRadius - iconOffset);
        const iconW = height >= 60 ? 18 : 12;
        const iconH = height >= 60 ? 18 : 12;

        ctx.fillStyle = '#ffeb3b'; // Vibrant gold document border (Red: 255)
        ctx.fillRect(roundedCenterX - iconW / 2, iconY - iconH / 2, iconW, iconH);

        // Document inner details (white surface with checkmark)
        const innerBorder = height >= 60 ? 3 : 2;
        ctx.fillStyle = '#000000';
        ctx.fillRect(roundedCenterX - iconW / 2 + innerBorder, iconY - iconH / 2 + innerBorder, iconW - (innerBorder * 2), iconH - (innerBorder * 2));

        // Lime Green Checkmark inside (High-Red component, thick 2x2 block style, responsive)
        ctx.fillStyle = '#c6ff00'; // Lime Green (Red: 198)
        if (height >= 60) {
            ctx.fillRect(roundedCenterX - 4, iconY + 1, 2, 2);
            ctx.fillRect(roundedCenterX - 2, iconY + 3, 2, 2);
            ctx.fillRect(roundedCenterX, iconY + 1, 2, 2);
            ctx.fillRect(roundedCenterX + 2, iconY - 1, 2, 2);
            ctx.fillRect(roundedCenterX + 4, iconY - 3, 2, 2);
        } else {
            // Smaller checkmark for smaller icon
            ctx.fillRect(roundedCenterX - 2, iconY + 1, 1, 1);
            ctx.fillRect(roundedCenterX - 1, iconY + 2, 1, 1);
            ctx.fillRect(roundedCenterX, iconY + 1, 1, 1);
            ctx.fillRect(roundedCenterX + 1, iconY, 1, 1);
            ctx.fillRect(roundedCenterX + 2, iconY - 1, 1, 1);
            ctx.fillRect(roundedCenterX + 3, iconY - 2, 1, 1);
        }

        // Alternating sparkles (Diagonal sparkles, responsive)
        const sparkleSize = height >= 60 ? 4 : 2;
        const sparkleOffset = height >= 60 ? 6 : 4;
        ctx.fillStyle = '#ffffff';
        if (!frameToggle) {
            // Sparkle set 1
            ctx.fillRect(roundedCenterX - iconW / 2 - sparkleOffset, iconY - iconH / 2 - sparkleOffset, sparkleSize, sparkleSize); // Bottom-left or top-left
            ctx.fillRect(roundedCenterX + iconW / 2 + (sparkleOffset - sparkleSize), iconY + iconH / 2 + (sparkleOffset - sparkleSize), sparkleSize, sparkleSize); // Bottom-right
        } else {
            // Sparkle set 2
            ctx.fillRect(roundedCenterX + iconW / 2 + (sparkleOffset - sparkleSize), iconY - iconH / 2 - sparkleOffset, sparkleSize, sparkleSize); // Top-right
            ctx.fillRect(roundedCenterX - iconW / 2 - sparkleOffset, iconY + iconH / 2 + (sparkleOffset - sparkleSize), sparkleSize, sparkleSize); // Bottom-left
        }
    }
}
