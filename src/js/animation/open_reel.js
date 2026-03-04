import { AnimationBase } from '../animation_base.js';

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
            ko: "회전하는 릴과 움직이는 VU 미터가 있는 빈티지 테이프 레코더입니다.",
            zh: "带有旋转带盘和移动 VU 表的复古磁带录音机。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', usePseudoSpace: false };

    draw(ctx, { width, height, _progress, exclusionAreas }) {
        const time = Date.now() / 1000;

        // Reels on the left
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

        const rotation = time * 2;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        // Draw two reels
        [ -25, 25 ].forEach(offset => {
            const rx = reelCenterX + offset;
            const ry = reelCenterY;

            ctx.beginPath();
            ctx.arc(rx, ry, 20, 0, Math.PI * 2);
            ctx.stroke();

            // Reel spokes
            for(let i=0; i<3; i++) {
                const angle = rotation + (i * Math.PI * 2 / 3);
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.lineTo(rx + Math.cos(angle) * 18, ry + Math.sin(angle) * 18);
                ctx.stroke();
            }
        });

        // VU Meters on the right
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

        [ -25, 25 ].forEach(offset => {
            const vx = vuCenterX + offset;
            const vy = vuCenterY;

            // Gauge outline
            ctx.strokeRect(vx - 20, vy - 15, 40, 30);

            // Needle
            const noise = Math.sin(time * 10 + offset) * 0.3 + Math.sin(time * 23) * 0.1;
            const angle = -Math.PI / 2 + noise;

            ctx.beginPath();
            ctx.moveTo(vx, vy + 10);
            ctx.lineTo(vx + Math.sin(angle) * 20, vy + 10 - Math.cos(angle) * 20);
            ctx.stroke();
        });
    }
}
