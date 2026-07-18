import { AnimationBase } from '../animation_base.js';

/**
 * Rotational BBQ Spit & Color Grading
 * A rotating spit bar with meat that changes color in a 5-second loop.
 * 串に刺さったお肉が縦方向の伸縮(transform: scaleY)によって3D回転しているように見えます。
 * 5秒かけて「赤色（生肉）」→「茶色（調理中）」→「黄金色（上手に焼けました！）」へと段階的に変化し、
 * 最後に一度ピカッと光って元の赤色にリセットされます。
 */
export default class RotationalBbq extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Rotational BBQ Spit & Color Grading",
            ja: "お肉焼き",
            de: "Rotierender BBQ-Spieß & Farbverlauf",
            es: "Espetón de barbacoa giratorio y gradación de color",
            fr: "Broche de barbecue rotative et dégradé de couleurs",
            pt: "Espeto de churrasco rotativo e gradação de cores",
            ko: "회전하는 바베큐 꼬치와 색상 보정",
            zh: "旋转烧烤串和色彩渐变"
        },
        description: {
            en: "A horizontal skewer bar with an oval lump rotates and slowly transitions from raw red to cooked golden over 5 seconds.",
            ja: "串に刺さったお肉が3D回転し、5秒かけて生肉の赤から黄金色の「上手に焼けました！」状態へ変化した後にフラッシュします。",
            de: "Ein horizontaler Spieß mit einem ovalen Stück dreht sich und geht über 5 Sekunden langsam von rohem Rot zu gekochtem Gold über.",
            es: "Un espetón horizontal con un trozo ovalado gira y pasa lentamente de rojo crudo a dorado cocinado en 5 segundos.",
            fr: "Une broche horizontale avec un morceau ovale tourne et passe lentement du rouge cru au doré cuit en 5 secondes.",
            pt: "Um espeto horizontal com um pedaço oval gira e muda lentamente de vermelho cru para dourado cozido em 5 segundos.",
            ko: "타원형 고기가 꽂힌 수평 꼬치가 회전하며 5초 동안 날것의 빨간색에서 잘 익은 황금빛으로 서서히 변합니다.",
            zh: "一个带有椭圆形肉块的水平烤串不断旋转，并在5秒内慢慢从生红过渡到熟金。"
        },
        author: "QuickLog-Solo",
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

        // 5-second loop
        const loopMs = 5000;
        const progress = (elapsedMs % loopMs) / loopMs;

        // Rotates every 800ms
        const rotationAngle = (elapsedMs / 800) * Math.PI * 2;
        // Squash/stretch to simulate 3D spin: scaleY behaves as cos(angle)
        const scaleY = Math.abs(Math.cos(rotationAngle));

        // Step-wise color state
        // 0.0 - 0.35: Raw Red
        // 0.35 - 0.70: Cooking Brown
        // 0.70 - 0.90: Golden Perfect
        // 0.90 - 1.00: Perfect State + Flash trigger
        let meatColor = '#ef5350'; // Raw Red
        let isFlash = false;

        if (progress >= 0.35 && progress < 0.70) {
            meatColor = '#8d6e63'; // Cooking Brown
        } else if (progress >= 0.70 && progress < 0.90) {
            meatColor = '#ffb300'; // Glistening Golden Amber
        } else if (progress >= 0.90) {
            meatColor = '#ffd54f'; // Bright Golden
            // Flash on the final 10% of the loop
            if (progress >= 0.92 && progress <= 0.98) {
                isFlash = true;
            }
        }

        // Draw Skewer Spit Bar
        ctx.fillStyle = '#757575';
        const barWidth = Math.max(100, width * 0.7);
        const barHeight = 4;
        ctx.fillRect(centerX - barWidth / 2, centerY - barHeight / 2, barWidth, barHeight);

        // Draw Spit Stand Ends
        ctx.fillRect(centerX - barWidth / 2 - 4, centerY - 15, 4, 30);
        ctx.fillRect(centerX + barWidth / 2, centerY - 15, 4, 30);

        // Draw Oval Lump (Meat) in the center
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(1.0, Math.max(0.08, scaleY)); // Avoid absolute zero height scale

        const ovalW = Math.max(40, width * 0.22);
        const ovalH = Math.max(25, height * 0.35);

        // Flash Effect
        if (isFlash) {
            ctx.fillStyle = '#fff';
        } else {
            ctx.fillStyle = meatColor;
        }

        // Draw pixelated oval using rounded corners or custom rect layers
        ctx.fillRect(-ovalW / 2, -ovalH / 2, ovalW, ovalH);

        // Bone or Bone Handle Ends sticking out slightly
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(-ovalW / 2 - 8, -4, 8, 8);
        ctx.fillRect(ovalW / 2, -4, 8, 8);

        ctx.restore();

        // Screen flash ring / sparkle when cooked successfully
        if (isFlash) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, ovalW * 0.7, 0, Math.PI * 2);
            ctx.stroke();

            // Sparkle stars
            ctx.fillStyle = '#ffd54f';
            ctx.fillRect(centerX - ovalW, centerY - ovalH, 4, 4);
            ctx.fillRect(centerX + ovalW, centerY - ovalH, 4, 4);
            ctx.fillRect(centerX - ovalW, centerY + ovalH, 4, 4);
            ctx.fillRect(centerX + ovalW, centerY + ovalH, 4, 4);
        }
    }
}
