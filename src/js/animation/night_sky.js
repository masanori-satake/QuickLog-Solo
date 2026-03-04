import { AnimationBase } from '../animation_base.js';

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
            ko: "반짝이는 별들과 달이 천천히 별자리를 형성하는 평화로운 밤하늘입니다.",
            zh: "宁静的夜空，闪烁的星星和月亮慢慢形成一个星座。"
        },
        author: "QuickLog-Solo"
    };

    constructor() {
        super();
        this.constellationPoints = [
            {x: 0.2, y: 0.2}, {x: 0.3, y: 0.4}, {x: 0.5, y: 0.3},
            {x: 0.7, y: 0.5}, {x: 0.8, y: 0.2}, {x: 0.6, y: 0.7},
            {x: 0.4, y: 0.8}, {x: 0.2, y: 0.6}, {x: 0.2, y: 0.2}
        ];
        this.backgroundStars = Array(50).fill(0).map(() => ({
            x: Math.random(),
            y: Math.random(),
            size: 1 + Math.random() * 2,
            twinkleOffset: Math.random() * Math.PI * 2
        }));
    }

    config = { mode: 'sprite', usePseudoSpace: true };

    setup(width, height) {
        this.w = width;
        this.h = height;
    }

    draw(ctx, { progress }) {
        const sprites = [];

        // Stars
        this.backgroundStars.forEach((star) => {
            const twinkle = Math.sin(Date.now() / 1000 + star.twinkleOffset) > 0;
            if (twinkle) {
                sprites.push({ x: star.x * this.w, y: star.y * this.h, size: star.size > 1.5 ? 2 : 1 });
            }
        });

        // Constellation
        const linesToDraw = Math.floor(progress * (this.constellationPoints.length - 1));
        for (let i = 0; i <= linesToDraw; i++) {
            const pt1 = this.constellationPoints[i];
            sprites.push({ x: pt1.x * this.w, y: pt1.y * this.h, size: 2 });

            if (i < linesToDraw) {
                const pt2 = this.constellationPoints[i+1];
                // Draw dotted line between points
                const dx = (pt2.x - pt1.x) * this.w;
                const dy = (pt2.y - pt1.y) * this.h;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const steps = Math.floor(dist / 8);
                for (let s = 1; s < steps; s++) {
                    sprites.push({
                        x: pt1.x * this.w + dx * (s / steps),
                        y: pt1.y * this.h + dy * (s / steps),
                        size: 1
                    });
                }
            }
        }

        // UFO & Cattle Mutilation
        // Cycle: 0-0.3: Fly In, 0.3-0.7: Abduct (Stop), 0.7-1.0: Fly Out
        const ufoCycle = (Date.now() / 15000) % 3; // 45 sec total, 15 sec active
        if (ufoCycle < 1) {
            const p = ufoCycle;
            let ufoX;
            const ufoY = this.h * 0.15;

            if (p < 0.3) {
                // Fly In
                ufoX = this.w * (p / 0.3 * 0.7 - 0.2);
            } else if (p < 0.7) {
                // Stop and Abduct
                ufoX = this.w * 0.5;
            } else {
                // Fly Out
                ufoX = this.w * (0.5 + (p - 0.7) / 0.3 * 0.7);
            }

            // UFO Body
            for (let i = -5; i <= 5; i++) sprites.push({ x: ufoX + i * 4, y: ufoY, size: 2 });
            for (let i = -2; i <= 2; i++) sprites.push({ x: ufoX + i * 4, y: ufoY - 4, size: 2 });

            // Abduction Beam & Cow
            if (p >= 0.3 && p <= 0.7) {
                const beamP = (p - 0.3) / 0.4;
                // Beam
                for (let y = ufoY + 4; y < this.h; y += 8) {
                    for (let x = -2; x <= 2; x++) {
                        if (Math.random() > 0.4) sprites.push({ x: ufoX + x * 6, y: y, size: 1 });
                    }
                }
                // Cow (being sucked up)
                const cowY = this.h - (this.h - ufoY) * beamP;
                if (cowY > ufoY) {
                    // Cow shape (pixel art)
                    sprites.push({ x: ufoX - 4, y: cowY, size: 2 });
                    sprites.push({ x: ufoX, y: cowY, size: 2 });
                    sprites.push({ x: ufoX + 4, y: cowY, size: 2 });
                    sprites.push({ x: ufoX + 4, y: cowY - 4, size: 2 });
                }
            }
        }

        return sprites;
    }
}
