import { AnimationBase } from '../animation_base.js';

/**
 * NightSky Animation
 * A peaceful night sky with twinkling stars, a moon, and a forming constellation.
 * きらめく星々と月、星座が形作られていく静かな夜空のアニメーションです。
 */
export default class NightSky extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Night Sky",
            ja: "夜空",
            de: "Nachthimmel",
            es: "Cielo nocturno",
            fr: "Ciel nocturne",
            pt: "Céu noturno",
            ko: "밤하늘",
            zh: "星空"
        },
        description: {
            en: "A peaceful night sky where twinkling stars and a moon slowly form a constellation.",
            ja: "きらめく星々と月がゆっくりと繋がり、星座を描き出す静かな夜空です。",
            de: "Ein friedlicher Nachthimmel, an dem funkelnde Sterne und ein Mond langsam ein Sternbild bilden.",
            es: "Un cielo nocturno tranquilo donde las estrellas centelleantes y la luna forman lentamente una constelación.",
            fr: "Un ciel nocturne paisible où les étoiles scintillantes et la lune forment lentement une constellation.",
            pt: "Um céu noturno tranquilo onde estrelas cintilantes e a lua formam lentamente uma constelação.",
            ko: "반짝이는 별들과 달이 천천히 별자리를 형성하는 평화로운 밤하늘입니다。",
            zh: "宁静的夜空，闪烁的星星和月亮慢慢形成一个星座。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    constructor() {
        super();

        // Coordinates for the constellation (percentage of width/height)
        // 星座の各点の座標（幅・高さに対する割合）
        this.constellationPoints = [
            {x: 0.2, y: 0.2}, {x: 0.3, y: 0.4}, {x: 0.5, y: 0.3},
            {x: 0.7, y: 0.5}, {x: 0.8, y: 0.2}, {x: 0.6, y: 0.7},
            {x: 0.4, y: 0.8}, {x: 0.2, y: 0.6}, {x: 0.2, y: 0.2}
        ];

        // Random background stars
        // 背景のランダムな星々
        this.backgroundStars = Array(50).fill(0).map(() => ({
            x: Math.random(),
            y: Math.random(),
            size: 1 + Math.random() * 2,
            twinkleOffset: Math.random() * Math.PI * 2
        }));
    }

    config = { mode: 'sprite', exclusionStrategy: 'pseudo' };

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
    draw(ctx, { elapsedMs = 0, progress = 0 } = {}) {
        const sprites = [];
        const width = this.width;
        const height = this.height;

        // 1. Background Stars (twinkling)
        // 1. 背景の星（きらめき）
        this.backgroundStars.forEach((star) => {
            const twinkle = Math.sin(elapsedMs / 1000 + star.twinkleOffset) > 0;
            if (twinkle) {
                sprites.push({ x: star.x * width, y: star.y * height, size: star.size > 1.5 ? 2 : 1 });
            }
        });

        // 2. Constellation (forms over progress)
        // 2. 星座（進捗に合わせて形作られる）
        const linesToDraw = Math.floor(progress * (this.constellationPoints.length - 1));
        for (let i = 0; i <= linesToDraw; i++) {
            const pt1 = this.constellationPoints[i];
            sprites.push({ x: pt1.x * width, y: pt1.y * height, size: 2 });

            if (i < linesToDraw) {
                const pt2 = this.constellationPoints[i+1];
                // Draw dotted line between constellation points
                // 星座の点と点の間に点線を描画
                const dx = (pt2.x - pt1.x) * width;
                const dy = (pt2.y - pt1.y) * height;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const steps = Math.floor(dist / 8);
                for (let s = 1; s < steps; s++) {
                    sprites.push({
                        x: pt1.x * width + dx * (s / steps),
                        y: pt1.y * height + dy * (s / steps),
                        size: 1
                    });
                }
            }
        }

        // 3. UFO & Abduction Event (Surprise element)
        // 3. UFOと連れ去りイベント（おまけ要素）
        this.drawUFO(sprites, width, height, elapsedMs);

        return sprites;
    }

    /**
     * UFO drawing logic
     * UFOの描画ロジック
     */
    drawUFO(sprites, width, height, elapsedMs) {
        const ufoCycle = (elapsedMs / 15000) % 3; // 45 sec total / 計45秒サイクル
        if (ufoCycle < 1) {
            const p = ufoCycle;
            let ufoX;
            const ufoY = height * 0.15;

            // Movement logic: In -> Stop -> Out
            if (p < 0.3) {
                ufoX = width * (p / 0.3 * 0.95 - 0.2); // Fly In / 飛来
            } else if (p < 0.7) {
                ufoX = width * 0.75; // Stop / 停止
            } else {
                ufoX = width * (0.75 + (p - 0.7) / 0.3 * 0.45); // Fly Out / 退去
            }

            // UFO Body / UFO本体
            for (let i = -5; i <= 5; i++) sprites.push({ x: ufoX + i * 4, y: ufoY, size: 2 });
            for (let i = -2; i <= 2; i++) sprites.push({ x: ufoX + i * 4, y: ufoY - 4, size: 2 });

            // Abduction Beam & Cow / 光線と牛
            if (p >= 0.3 && p <= 0.7) {
                const beamProgress = (p - 0.3) / 0.4;
                // Beam / 光線
                for (let y = ufoY + 4; y < height; y += 8) {
                    for (let x = -2; x <= 2; x++) {
                        if (Math.random() > 0.4) sprites.push({ x: ufoX + x * 6, y: y, size: 1 });
                    }
                }
                // Cow shape being sucked up / 吸い上げられる牛の形状
                const cowY = height - (height - ufoY) * beamProgress;
                if (cowY > ufoY) {
                    sprites.push({ x: ufoX - 4, y: cowY, size: 2 });
                    sprites.push({ x: ufoX, y: cowY, size: 2 });
                    sprites.push({ x: ufoX + 4, y: cowY, size: 2 });
                    sprites.push({ x: ufoX + 4, y: cowY - 4, size: 2 });
                }
            }
        }
    }
}
