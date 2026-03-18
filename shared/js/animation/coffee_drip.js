import { AnimationBase } from '../animation_base.js';

/**
 * CoffeeDrip Animation
 * A relaxing coffee brewing animation that fills the pot.
 * ポットにコーヒーが溜まっていく、リラックスできるドリップアニメーションです。
 */
export default class CoffeeDrip extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Coffee Drip",
            ja: "コーヒードリップ",
            de: "Kaffee-Drip",
            es: "Goteo de café",
            fr: "Goutte à goutte de café",
            pt: "Café coado",
            ko: "커피 드립",
            zh: "咖啡滴漏"
        },
        description: {
            en: "A relaxing coffee brewing animation that fills the pot.",
            ja: "ポットにコーヒーが溜まっていく、リラックスできるドリップアニメーションです。",
            de: "Eine entspannende Kaffeebrüh-Animation, die die Kanne füllt.",
            es: "Una relajante animación de preparación de café que llena la cafetera.",
            fr: "Une animation relaxante de préparation de café qui remplit la verseuse.",
            pt: "Uma animação relaxante de preparo de café que enche a jarra.",
            ko: "포트에 커피가 차오르는 편안한 드립 애니메이션입니다.",
            zh: "一种放松的咖啡冲泡动画，咖啡壶逐渐装满。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'mask' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
    }

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { elapsedMs = 0, progress = 0, exclusionAreas = [] } = {}) {
        const width = this.width;

        // Find a horizontal center that doesn't overlap with UI text
        // UIテキストと重ならない中央位置を探す
        let centerX = width * 0.2; // Default to left side / デフォルトは左側

        if (exclusionAreas && exclusionAreas.length > 0) {
            // Test several spots to find one with no overlap
            // いくつかの候補点を確認し、重なりのない場所を選ぶ
            const spots = [width * 0.15, width * 0.85, width * 0.25, width * 0.75];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot + 30 > area.x && spot - 30 < area.x + area.width;
                });
                if (!overlap) {
                    centerX = spot;
                    break;
                }
            }
        }

        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#fff';

        // 1. Filter/Dripper shape
        // 1. ドリッパーの形状
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(centerX - 30, 20);
        ctx.lineTo(centerX + 30, 20);
        ctx.lineTo(centerX + 5, 50);
        ctx.lineTo(centerX - 5, 50);
        ctx.closePath();
        ctx.fill();

        // 2. Server/Cup shape
        // 2. サーバー/カップの形状
        const cupY = 60;
        const cupWidth = 40;
        const cupHeight = 30;

        ctx.globalAlpha = 1.0;
        // Cup Body / 本体
        ctx.beginPath();
        ctx.moveTo(centerX - cupWidth / 2, cupY);
        ctx.lineTo(centerX + cupWidth / 2, cupY);
        ctx.lineTo(centerX + cupWidth / 2 - 5, cupY + cupHeight);
        ctx.lineTo(centerX - cupWidth / 2 + 5, cupY + cupHeight);
        ctx.closePath();
        ctx.stroke();

        // Handle / 持ち手
        ctx.beginPath();
        ctx.arc(centerX + cupWidth / 2 - 2, cupY + cupHeight / 2, 8, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        // 3. Drip droplets
        // 3. 滴下するしずく
        const dropP = (elapsedMs / 1000) % 1;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(centerX, 50 + dropP * 15, 2, 0, Math.PI * 2);
        ctx.fill();

        // 4. Filling coffee
        // 4. 溜まっていくコーヒー
        ctx.globalAlpha = 0.6;
        const fillMaxHeight = cupHeight - 4;
        const fillHeight = fillMaxHeight * progress;
        ctx.beginPath();
        ctx.moveTo(centerX - cupWidth / 2 + 2, cupY + cupHeight - 2);
        ctx.lineTo(centerX + cupWidth / 2 - 2, cupY + cupHeight - 2);
        ctx.lineTo(centerX + cupWidth / 2 - 2, cupY + cupHeight - 2 - fillHeight);
        ctx.lineTo(centerX - cupWidth / 2 + 2, cupY + cupHeight - 2 - fillHeight);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 1.0;
    }
}
