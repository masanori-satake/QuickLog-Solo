import { AnimationBase } from '../animation_base.js';

/**
 * Target Reticle & Shadow Silhouette
 * Detective anime parody: crosshair reticle hovering with black culprit shadow.
 * 円形のピクセルレティクル（照準）が、無限記号（8の字）を描きながらスムーズに浮遊します。
 * 背後には不気味な黒い人物シルエット（犯人）が現れ、2秒ごとに鋭い目が光り、
 * すぐに細い白線（目を細める）になってフェードアウトします。
 */
export default class TargetReticle extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Target Reticle & Shadow Silhouette",
            ja: "ターゲット照準と黒い影",
            de: "Zielabsehen & Schattensilhouette",
            es: "Retícula de objetivo y silueta de sombra",
            fr: "Réticule de cible et silhouette d'ombre",
            pt: "Retículo do alvo e silhueta de sombra",
            ko: "표적 조준경과 검은 그림자",
            zh: "目标十字线与影子剪影"
        },
        description: {
            en: "A circular pixel crosshair drifts smoothly in a figure-8 loop, while a dark shadow silhouette's sharp eyes blink in the background.",
            ja: "円形のドット照準器が8の字の軌道を描いて浮遊し、背後に現れた黒い人物の鋭い目が2秒周期で明滅します。",
            de: "Ein kreisförmiges Pixel-Fadenkreuz driftet sanft in einer Acht-Schleife, während die scharfen Augen einer dunklen Schattensilhouette im Hintergrund blinken.",
            es: "Una retícula de píxeles circular se desplaza suavemente en un bucle en forma de 8, mientras los ojos afilados de una silueta de sombra parpadean en el fondo.",
            fr: "Un réticule circulaire en pixel dérive doucement en forme de 8, tandis que les yeux aiguisés d'une silhouette d'ombre clignotent en arrière-plan.",
            pt: "Um retículo circular de pixel flutua suavemente em uma trajetória de 8, enquanto os olhos afiados de uma silhueta de sombra piscam ao fundo.",
            ko: "원형 픽셀 조준경이 8자 궤도를 그리며 떠돌고, 배경 속 검은 실루엣의 날카로운 눈빛이 2초마다 깜박입니다.",
            zh: "一个圆形的像素十字准星在8字形循环中平滑漂移，而背景中黑影剪影的敏锐眼睛每2秒闪烁一次。"
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
        const centerY = height / 2;

        // --- Layer 1: Background shadow silhouette ---
        // Change body color to lighter grey (#616161, Red: 97) for dot matrix representation
        ctx.fillStyle = '#616161';
        const shadowW = Math.max(50, width * 0.3);
        const shadowH = Math.max(60, height * 0.7);

        // Draw static body shadow centered in background
        ctx.save();
        ctx.translate(centerX, centerY + shadowH * 0.3);

        // Head
        ctx.beginPath();
        const headRadius = shadowW * 0.35;
        ctx.arc(0, -shadowH * 0.7, headRadius, 0, Math.PI * 2);
        ctx.fill();

        // Shoulders / Torso
        ctx.beginPath();
        ctx.moveTo(-shadowW * 0.5, 0);
        ctx.lineTo(-shadowW * 0.3, -shadowH * 0.6);
        ctx.lineTo(shadowW * 0.3, -shadowH * 0.6);
        ctx.lineTo(shadowW * 0.5, 0);
        ctx.closePath();
        ctx.fill();

        // Eye Blink sequence in the shadow head every 2 seconds
        const blinkCycle = 2000;
        const blinkTime = elapsedMs % blinkCycle;

        // Eyes: two sharp white pixels that narrow down
        let eyeHeight = 3;
        let showEyes = true;

        if (blinkTime >= 0 && blinkTime < 250) {
            // Blink opening: sharp pixels
            eyeHeight = 3;
        } else if (blinkTime >= 250 && blinkTime < 500) {
            // Narrowing down
            eyeHeight = 1;
        } else if (blinkTime >= 500 && blinkTime < 700) {
            // Completely closed
            showEyes = false;
        } else {
            // Wide open eyes
            eyeHeight = 3;
        }

        if (showEyes) {
            ctx.fillStyle = '#ffffff'; // Sharp white eyes (Red: 255)
            const eyeY = Math.round(-shadowH * 0.73);
            // Bold, larger eyes
            const eyeW = Math.round(Math.max(5, shadowW * 0.08));
            // Left eye
            ctx.fillRect(Math.round(-headRadius * 0.45 - (eyeW / 2)), eyeY, eyeW, Math.round(Math.max(2, eyeHeight * 1.5)));
            // Right eye
            ctx.fillRect(Math.round(headRadius * 0.45 - (eyeW / 2)), eyeY, eyeW, Math.round(Math.max(2, eyeHeight * 1.5)));
        }

        ctx.restore();

        // --- Layer 2: Crosshair / Target Reticle drifting in Figure-8 path ---
        // Figure-8 infinity math: x = sin(t), y = sin(2t)
        const pathPeriod = 4500; // 4.5 seconds loop period
        const t = (elapsedMs % pathPeriod) / pathPeriod * Math.PI * 2;
        const scaleX = width * 0.35;
        const scaleY = height * 0.25;

        const reticleX = centerX + Math.sin(t) * scaleX;
        const reticleY = centerY + Math.sin(2 * t) * scaleY;

        const rSize = Math.max(12, height * 0.15);

        // Draw reticle with thicker strokes for crisp dot representation
        ctx.strokeStyle = '#ef5350'; // Warning red reticle (Red: 239)
        ctx.lineWidth = 3; // Thicker lines for visibility

        ctx.save();
        ctx.translate(reticleX, reticleY);

        // Target circle
        ctx.beginPath();
        ctx.arc(0, 0, rSize, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = '#ef5350';
        ctx.fillRect(-1, -1, 3, 3); // Thicker center dot

        // Crosshairs tick marks (top, bottom, left, right)
        ctx.beginPath();
        // Top
        ctx.moveTo(0, -rSize); ctx.lineTo(0, -rSize - 6);
        // Bottom
        ctx.moveTo(0, rSize); ctx.lineTo(0, rSize + 6);
        // Left
        ctx.moveTo(-rSize, 0); ctx.lineTo(-rSize - 6, 0);
        // Right
        ctx.moveTo(rSize, 0); ctx.lineTo(rSize + 6, 0);
        ctx.stroke();

        ctx.restore();
    }
}
