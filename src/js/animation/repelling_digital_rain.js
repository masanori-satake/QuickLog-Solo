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

    // Constants to avoid "Magic Numbers" - Good practice for junior developers
    // クラスのプロパティとして定数を定義します（マジックナンバーを避ける良い習慣です）
    spacing = 6;
    gravity = 0.2;
    lifeDecay = 0.04;
    resetY = -100;

    constructor() {
        super();
        this.columns = [];
        this.particles = [];
    }

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        const colCount = Math.floor(width / this.spacing);

        // Initialize or update columns based on width
        // 幅に合わせて列を初期化または更新します
        if (this.columns.length !== colCount) {
            this.columns = Array(colCount).fill(0).map(() => this.createColumn(height));
        }
        // Clear particles on setup/resize
        this.particles = [];
    }

    /**
     * Create a single vertical rain column
     * 1つの垂直なレイン列を作成します
     * @param {number} height - Canvas height
     * @returns {Object} Column state
     */
    createColumn(height) {
        return {
            y: Math.random() * (height + 200) - 100,
            speed: 1 + Math.random() * 3,
            maxDots: 10 + Math.random() * 20,
            dots: []
        };
    }

    /**
     * Create a repelled particle
     * はじけ飛ぶパーティクルを作成します
     * @param {number} x - Current x position
     * @param {number} y - Current y position
     * @param {number} vx - Initial horizontal velocity
     * @returns {Object} Particle state
     */
    createParticle(x, y, vx) {
        return {
            x,
            y,
            // If vx is not provided, use a random horizontal spread
            vx: vx || (Math.random() - 0.5) * 4,
            // Upward initial velocity for the bounce
            vy: -1 - Math.random() * 2,
            life: 1.0,
            size: 2 + Math.floor(Math.random() * 2) // Larger dots (2 or 3) for visibility
        };
    }

    /**
     * Check if a point (x, y) is inside any exclusion area
     * 指定した座標が排他領域内にあるかチェックします
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Array} exclusionAreas - List of areas to avoid
     * @returns {Object|null} The area hit, or null
     */
    getHitExclusion(x, y, exclusionAreas) {
        if (!exclusionAreas || exclusionAreas.length === 0) return null;
        return exclusionAreas.find(area =>
            x >= area.x && x <= area.x + area.width &&
            y >= area.y && y <= area.y + area.height
        );
    }

    /**
     * Main drawing loop
     * メインの描画ルーチンです
     * @param {CanvasRenderingContext2D} ctx - Context (unused in sprite mode)
     * @param {Object} params - Animation parameters
     * @returns {Array} List of sprites to draw
     */
    draw(ctx, { exclusionAreas, speed = 1 } = {}) {
        const sprites = [];
        const height = this.height;

        // 1. Update and Draw Rain Columns
        this.columns.forEach((col, i) => {
            const x = i * this.spacing;
            const nextY = col.y + col.speed * speed;

            // Collision detection: check if the lead drop hits an exclusion area
            // 衝突判定：先頭のドットが排他領域に当たったか
            const hitArea = this.getHitExclusion(x, nextY, exclusionAreas);
            if (hitArea) {
                // Determine bounce direction relative to the center of the hit area
                // 領域の中心からの相対位置で跳ね返る方向（左か右か）を決めます
                const centerX = hitArea.x + hitArea.width / 2;
                const dir = x < centerX ? -1 : 1;
                const baseVx = dir * (1 + Math.random() * 3);

                // Spawn multiple particles for visual emphasis
                // 視覚的な強調のため、複数のパーティクルを生成します
                for (let p = 0; p < 4; p++) {
                    const vx = baseVx + (Math.random() - 0.5) * 2;
                    this.particles.push(this.createParticle(x, nextY, vx));
                }

                // Reset the column to the top to simulate it being "blocked"
                // 列を上端にリセットし、遮られたように見せます
                col.y = this.resetY;
                col.speed = 1 + Math.random() * 3;
            } else {
                col.y = nextY;
            }

            // Wrap around if it leaves the bottom
            if (col.y > height + 100) {
                col.y = this.resetY;
                col.speed = 1 + Math.random() * 3;
            }

            // Record trail position for the digital rain effect
            // デジタル・レインの軌跡を記録します
            col.dots.push({ y: col.y });
            if (col.dots.length > col.maxDots) {
                col.dots.shift();
            }

            // Add trail dots to the sprite list
            col.dots.forEach((dot, idx) => {
                if (dot.y < 0 || dot.y > height) return;

                // Do not draw inside exclusion areas (Treating them as solid walls)
                // 排他領域の中には描画しません（壁として扱います）
                if (this.getHitExclusion(x, dot.y, exclusionAreas)) return;

                const isLead = idx === col.dots.length - 1;
                // Head is larger (3), middle is medium (2), tail is small (1)
                const size = isLead ? 3 : (idx > col.dots.length - 6 ? 2 : 1);
                sprites.push({ x, y: dot.y, size });
            });
        });

        // 2. Update and Draw Particles (The "Repelled" Drops)
        // はじけ飛んだドット（パーティクル）の更新と描画
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Physics simulation: Apply velocity and gravity
            // 物理シミュレーション：速度と重力を適用します
            p.x += p.vx * speed;
            p.y += p.vy * speed;
            p.vy += this.gravity * speed;
            p.life -= this.lifeDecay * speed;

            // Remove dead or off-screen particles
            if (p.life <= 0 || p.y > height) {
                this.particles.splice(i, 1);
            } else {
                // Particles are allowed to pass through exclusion areas to show the parabolic path
                // パーティクル自体は放物線を見せるため、排他領域内でも描画を許可します
                sprites.push({ x: p.x, y: p.y, size: p.size });
            }
        }

        return sprites;
    }
}
