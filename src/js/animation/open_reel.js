import { AnimationBase } from '../animation_base.js';

/**
 * OpenReel Animation
 * Vintage tape recorder with spinning reels and moving VU meters.
 * 回転するリールと動くVUメーターを備えた、ヴィンテージなテープレコーダーのアニメーションです。
 */
export default class OpenReel extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Open Reel",
            ja: "オープン・リール",
            de: "Tonbandmaschine",
            es: "Carrete abierto",
            fr: "Bande libre",
            pt: "Rolo aberto",
            ko: "오픈 릴",
            zh: "开盘式录音机"
        },
        description: {
            en: "Vintage tape recorder with spinning reels and moving VU meters.",
            ja: "回転するリールと動くVUメーターを備えた、ヴィンテージなテープレコーダーのアニメーションです。",
            de: "Vintage-Tonbandgerät mit drehenden Spulen und beweglichen VU-Metern.",
            es: "Grabadora de cinta antigua con carretes giratorios y medidores VU móviles.",
            fr: "Magnétophone vintage avec bobines rotatives et VU-mètres mobiles.",
            pt: "Gravador de rolo vintage com carretéis giratórios e medidores VU móveis.",
            ko: "회전하는 릴과 움직이는 VU 미터가 있는 빈티지 테이프 レコーダーです。",
            zh: "带有旋转带盘和移动 VU 表的复古磁带录音机。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', usePseudoSpace: false, rewindable: true };

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
    draw(ctx, { elapsedMs = 0, exclusionAreas = [] } = {}) {
        const width = this.width;
        const height = this.height;
        const time = elapsedMs / 1000;

        // 1. Reel placement (Avoid UI)
        // 1. リールの配置（UIを避ける）
        let reelCenterX = 60;
        let reelCenterY = height / 2;

        if (exclusionAreas && exclusionAreas.length > 0) {
            const spots = [60, width - 60];
             for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot + 50 > area.x && spot - 50 < area.x + area.width;
                });
                if (!overlap) {
                    reelCenterX = spot;
                    break;
                }
            }
        }

        // 2. VU Meter placement (Avoid UI and Reel)
        // 2. VUメーターの配置（UIとリールを避ける）
        let vuCenterX = width - 60;
        let vuCenterY = height / 2;

        if (exclusionAreas && exclusionAreas.length > 0) {
            const spots = [width - 60, 60];
             for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot + 50 > area.x && spot - 50 < area.x + area.width;
                });
                if (!overlap && Math.abs(spot - reelCenterX) > 100) {
                    vuCenterX = spot;
                    break;
                }
            }
        }

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        // 3. Draw Reels
        // 3. リールの描画
        const rotation = time * 2;
        [ -25, 25 ].forEach(offset => {
            this.drawReel(ctx, reelCenterX + offset, reelCenterY, rotation);
        });

        // 4. Draw VU Meters
        // 4. VUメーターの描画
        [ -25, 25 ].forEach(offset => {
            this.drawVUMeter(ctx, vuCenterX + offset, vuCenterY, time, offset);
        });
    }

    /**
     * Helper to draw a spinning reel
     * 回転するリールの描画ヘルパー
     */
    drawReel(ctx, rx, ry, rotation) {
        ctx.beginPath();
        ctx.arc(rx, ry, 20, 0, Math.PI * 2);
        ctx.stroke();

        // Spokes / スポーク
        for(let i=0; i<3; i++) {
            const angle = rotation + (i * Math.PI * 2 / 3);
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + Math.cos(angle) * 18, ry + Math.sin(angle) * 18);
            ctx.stroke();
        }
    }

    /**
     * Helper to draw a moving VU meter
     * 動くVUメーターの描画ヘルパー
     */
    drawVUMeter(ctx, vx, vy, time, offset) {
        // Gauge outline / 外枠
        ctx.strokeRect(vx - 20, vy - 15, 40, 30);

        // Needle movement / 針の動き
        const freq1 = 8 + (offset > 0 ? 3 : 0);
        const freq2 = 15 + (offset < 0 ? 7 : 0);
        const noise = Math.sin(time * freq1 + offset) * 0.5 + Math.sin(time * freq2) * 0.2;
        const angle = noise * 0.8; // Scale to keep within gauge / 枠内に収まるよう調整

        ctx.beginPath();
        ctx.moveTo(vx, vy + 10);
        ctx.lineTo(vx + Math.sin(angle) * 20, vy + 10 - Math.cos(angle) * 20);
        ctx.stroke();
    }
}
