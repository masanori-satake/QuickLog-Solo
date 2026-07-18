import { AnimationBase } from '../animation_base.js';

/**
 * Hexagonal HUD Sync & Pulse
 * Concentric sharp hexagons expanding outward with a central flashing status.
 * 同心のシャープな六角形（ヘキサゴン）が、中央から画面外に向けて一定のリズムで拡大しながら広がります。
 * 外側の六角形が消えていくのと同期して、中央のコアエリアに「ACTIVE」または「RUNNING」という
 * ネオングリーンやオレンジのドット文字が300ms間点滅します。
 */
export default class HexagonalHud extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Hexagonal HUD Sync & Pulse",
            ja: "ヘキサゴンHUD",
            de: "Hexagonales HUD-Sync & Puls",
            es: "Sincronización y pulso de HUD hexagonal",
            fr: "Synchronisation et pulsation de HUD hexagonal",
            pt: "Sincronização e pulsação de HUD hexagonal",
            ko: "육각형 HUD 싱크 & 펄스",
            zh: "六角形HUD同步与脉冲"
        },
        description: {
            en: "Concentric sharp hexagons expand outward in a low-framerate rhythm while 'ACTIVE' flashes in the core.",
            ja: "一定のリズムで同心円状の六角形が中央から外側へ拡大し、中央部に「ACTIVE」の文字がネオンカラーで明滅します。",
            de: "Konzentrische scharfe Sechsecke dehnen sich in einem rhythmischen Puls mit niedriger Bildrate nach außen aus, während 'ACTIVE' im Kern blinkt.",
            es: "Hexágonos concéntricos nítidos se expanden hacia afuera en un pulso rítmico de baja velocidad de fotogramas, mientras 'ACTIVE' parpadea en el núcleo.",
            fr: "Des hexagones concentriques nets s'étendent vers l'extérieur dans une pulsation rythmique à faible taux de rafraîchissement, tandis que 'ACTIVE' clignote au cœur.",
            pt: "Hexágonos concêntricos nítidos se expandem para fora em uma pulsação rítmica de baixa taxa de quadros, enquanto 'ACTIVE' pisca no núcleo.",
            ko: "동심원의 선명한 육각형이 낮은 프레임 레이트로 리드미컬하게 바깥쪽으로 확장하며, 중앙에 'ACTIVE' 텍스트가 깜박입니다.",
            zh: "同心清晰的六角形以低帧率节奏脉冲向外扩张，同时'ACTIVE'在核心处闪烁。"
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

        // Low-framerate rhythmic pulse (simulating retro CRT or tactical hud, e.g. 5fps update for pulse math)
        const lowFpsTime = Math.floor(elapsedMs / 120) * 120; // Step updates every 120ms
        const pulseCycle = 1600; // 1.6 seconds loop
        const progress = (lowFpsTime % pulseCycle) / pulseCycle;

        // Flash "ACTIVE" during progress 0.0 - 0.25 (first 400ms)
        const isFlashOn = progress < 0.25;

        // Rhythmic hexagons: 3 nested hexagons expanding
        const maxRadius = Math.max(width, height) * 0.8;

        ctx.strokeStyle = '#4caf50'; // Neon green
        ctx.lineWidth = 1;

        // Draw expanding hexagons
        for (let i = 0; i < 3; i++) {
            // Staggered size phase
            const phase = (progress + i * 0.33) % 1.0;
            const radius = phase * maxRadius;

            // Fade out at margins
            const opacity = Math.max(0, 1.0 - phase);
            ctx.strokeStyle = `rgba(76, 175, 80, ${opacity})`;

            this.drawHexagon(ctx, centerX, centerY, radius);
        }

        // Draw "ACTIVE" text pixelated style at the core
        if (isFlashOn) {
            ctx.fillStyle = '#ff9800'; // Neon orange flashing at center

            // Text grid for 'ACTIVE'
            ctx.save();
            ctx.translate(centerX - 18, centerY - 3);
            const pSize = 1;

            const drawActiveText = () => {
                // A, C, T, I, V, E in pixel block style
                // Rather than canvas text fill which might blur, we can construct the blocks manually
                const drawPixel = (x, y) => {
                    ctx.fillRect(x * pSize, y * pSize, pSize, pSize);
                };

                // 'A'
                for (let y = 1; y <= 5; y++) { drawPixel(0, y); drawPixel(4, y); }
                for (let x = 1; x <= 3; x++) { drawPixel(x, 0); drawPixel(x, 2); }

                // 'C' (shifted X by 6)
                for (let y = 1; y <= 4; y++) drawPixel(6, y);
                for (let x = 7; x <= 9; x++) { drawPixel(x, 0); drawPixel(x, 5); }

                // 'T' (shifted X by 11)
                for (let x = 11; x <= 15; x++) drawPixel(x, 0);
                for (let y = 1; y <= 5; y++) drawPixel(13, y);

                // 'I' (shifted X by 17)
                for (let x = 17; x <= 19; x++) { drawPixel(x, 0); drawPixel(x, 5); }
                for (let y = 1; y <= 4; y++) drawPixel(18, y);

                // 'V' (shifted X by 21)
                for (let y = 0; y <= 3; y++) { drawPixel(21, y); drawPixel(25, y); }
                drawPixel(22, 4); drawPixel(24, 4); drawPixel(23, 5);

                // 'E' (shifted X by 27)
                for (let y = 0; y <= 5; y++) drawPixel(27, y);
                for (let x = 28; x <= 30; x++) { drawPixel(x, 0); drawPixel(x, 2); drawPixel(x, 5); }
            };

            drawActiveText();
            ctx.restore();
        }
    }

    drawHexagon(ctx, x, y, r) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const hX = x + Math.cos(angle) * r;
            const hY = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(hX, hY);
            else ctx.lineTo(hX, hY);
        }
        ctx.closePath();
        ctx.stroke();
    }
}
