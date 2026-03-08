import { AnimationBase } from '../animation_base.js';

/**
 * Repelling Digital Rain Animation (DevOnly)
 * Extension of Digital Rain that interacts with exclusion areas.
 * 排他領域に反応してはじけ飛ぶデジタル・レインの拡張版です。
 */
export default class RepellingDigitalRain extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Repelling Digital Rain",
            ja: "Repelling digital rain"
        },
        description: {
            en: "Digital rain that bounces off exclusion areas. Demonstrates 'freedom' strategy and collision detection.",
            ja: "排他領域ではじけ飛ぶデジタル・レインです。'freedom' 戦略と衝突判定のデモンストレーション用サンプルです。"
        },
        author: "QuickLog-Solo",
        devOnly: true,
        rewindable: true
    };

    config = { mode: 'sprite', exclusionStrategy: 'freedom' };

    constructor() {
        super();
        this.columns = [];
        this.particles = [];
    }

    /**
     * Initial setup and resizing
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        const spacing = 6;
        const colCount = Math.floor(width / spacing);

        if (this.columns.length !== colCount) {
            this.columns = Array(colCount).fill(0).map(() => this.createColumn(height));
        }
        this.particles = [];
    }

    createColumn(height) {
        return {
            y: Math.random() * (height + 200) - 100,
            speed: 1 + Math.random() * 3,
            maxDots: 10 + Math.random() * 20,
            dots: []
        };
    }

    createParticle(x, y) {
        return {
            x,
            y,
            vx: (Math.random() - 0.5) * 4,
            vy: -1 - Math.random() * 2,
            life: 1.0,
            size: 1 + Math.floor(Math.random() * 2)
        };
    }

    /**
     * Simple collision detection
     */
    isInExclusion(x, y, exclusionAreas) {
        if (!exclusionAreas || exclusionAreas.length === 0) return false;
        return exclusionAreas.some(area =>
            x >= area.x && x <= area.x + area.width &&
            y >= area.y && y <= area.y + area.height
        );
    }

    /**
     * Main drawing loop
     */
    draw(ctx, { exclusionAreas, speed = 1 } = {}) {
        const sprites = [];
        const spacing = 6;
        const height = this.height;
        const gravity = 0.2;

        this.columns.forEach((col, i) => {
            const x = i * spacing;
            const nextY = col.y + col.speed * speed;

            // 衝突判定：頭が排他領域に入ったか
            if (this.isInExclusion(x, nextY, exclusionAreas)) {
                // はじけ飛ぶパーティクルを生成
                for (let p = 0; p < 2; p++) {
                    this.particles.push(this.createParticle(x, nextY));
                }
                // 頭をリセット
                col.y = -100;
                col.speed = 1 + Math.random() * 3;
            } else {
                col.y = nextY;
            }

            if (col.y > height + 100) {
                col.y = -100;
                col.speed = 1 + Math.random() * 3;
            }

            // 軌跡を記録
            col.dots.push({ y: col.y });
            if (col.dots.length > col.maxDots) {
                col.dots.shift();
            }

            // 軌跡の描画
            col.dots.forEach((dot, idx) => {
                if (dot.y < 0 || dot.y > height) return;

                // 排他領域の中には描画しない（壁として扱う）
                if (this.isInExclusion(x, dot.y, exclusionAreas)) return;

                const isLead = idx === col.dots.length - 1;
                const size = isLead ? 3 : (idx > col.dots.length - 6 ? 2 : 1);
                sprites.push({ x, y: dot.y, size });
            });
        });

        // パーティクルの更新と描画
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * speed;
            p.y += p.vy * speed;
            p.vy += gravity * speed;
            p.life -= 0.05 * speed;

            if (p.life <= 0 || p.y > height) {
                this.particles.splice(i, 1);
            } else {
                if (!this.isInExclusion(p.x, p.y, exclusionAreas)) {
                    sprites.push({ x: p.x, y: p.y, size: p.size });
                }
            }
        }

        return sprites;
    }
}
