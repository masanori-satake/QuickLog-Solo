import { AnimationBase } from '../animation_base.js';

/**
 * Dune Formation (Wind and Accumulation) - DevOnly
 * Simulates sand particles moving with wind and accumulating against obstacles.
 * 砂の粒子が風に乗って移動し、障害物や他の砂にぶつかって堆積する様子をシミュレートします。
 *
 * Technical Concepts for Junior Engineers:
 * 1. Particle Systems: Managing many small objects with individual positions and velocities.
 * 2. Optimized Grid: Using a 1D Float32Array for better memory layout and performance.
 * 3. Saltation & Creep: The process of sand "bouncing" and "rolling" along the surface.
 * 4. Spatial Interaction: Detecting collisions with exclusionAreas (UI elements).
 *
 * ジュニアエンジニア向けのポイント:
 * 1. パーティクルシステム: 多数の小さなオブジェクト（位置と速度を持つ）を管理します。
 * 2. 最適化されたグリッド: メモリレイアウトとパフォーマンス向上のため、1DのFloat32Arrayを使用します。
 * 3. 跳躍と匍行: 風によって砂が表面を「跳ねたり」「転がったり」して移動するプロセス。
 * 4. 空間的相互作用: UI要素（exclusionAreas）との衝突判定。
 */
export default class DuneFormation extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Dune Formation",
            ja: "砂丘の形成"
        },
        description: {
            en: "Simulates sand grains forming ripples and dunes as they blow across the screen and hit obstacles.",
            ja: "風に吹かれた砂粒が画面内を移動し、障害物にぶつかって砂紋や砂丘を形成する様子をシミュレートします。"
        },
        author: "QuickLog-Solo",
        devOnly: true,
        rewindable: true
    };

    config = {
        mode: 'canvas',
        exclusionStrategy: 'freedom'
    };

    // --- Simulation Constants ---
    GRID_SIZE = 4;              // Size of each accumulation cell (pixels)
    MAX_PARTICLES = 1500;       // Number of active sand grains
    WIND_STRENGTH = 1.2;        // Horizontal force
    SETTLE_PROBABILITY = 0.4;   // Chance to stay when hitting ground
    ROLL_PROBABILITY = 0.3;     // Chance to roll forward instead of stopping
    MAX_HEIGHT = 15;            // Maximum sand height per cell

    // --- Visual & Behavior Tuning ---
    SAND_TRAP_THRESHOLD = 8;    // Height threshold where sand starts trapping other grains
    CREEP_VELOCITY_REDUCTION = 0.4; // How much velocity is lost when rolling/creeping
    CREEP_VERTICAL_JITTER = 2.0;    // Random vertical force when rolling
    EMISSION_OFFSET = -10;      // Start X position for new grains
    OUT_OF_BOUNDS_PADDING = 10; // Extra space around edges before cleanup
    MIN_SAND_ALPHA = 0.2;       // Starting opacity for the first layer of sand

    constructor() {
        super();
        this.particles = [];
        this.grid = null; // 1D Float32Array
        this.cols = 0;
        this.rows = 0;
        this.width = 0;
        this.height = 0;
    }

    /**
     * @param {number} width
     * @param {number} height
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
        this.cols = Math.ceil(width / this.GRID_SIZE);
        this.rows = Math.ceil(height / this.GRID_SIZE);

        // Use 1D array for performance (better cache locality)
        this.grid = new Float32Array(this.cols * this.rows);
        this.particles = [];

        // Start with some random particles
        for (let i = 0; i < this.MAX_PARTICLES; i++) {
            this.particles.push(this.createParticle(Math.random() * width, Math.random() * height));
        }
    }

    createParticle(x, y) {
        return {
            x: x,
            y: y,
            vx: this.WIND_STRENGTH * (0.8 + Math.random() * 0.4),
            vy: (Math.random() - 0.5) * 0.2
        };
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} params
     */
    draw(ctx, { elapsedMs: _, exclusionAreas = [], speed = 1 } = {}) {
        const dt = speed;

        // Emission: Keep particle count up
        while (this.particles.length < this.MAX_PARTICLES) {
            this.particles.push(this.createParticle(this.EMISSION_OFFSET, Math.random() * this.height));
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Out of bounds cleanup
            if (p.x > this.width + this.OUT_OF_BOUNDS_PADDING ||
                p.y < -this.OUT_OF_BOUNDS_PADDING ||
                p.y > this.height + this.OUT_OF_BOUNDS_PADDING) {
                this.particles.splice(i, 1);
                continue;
            }

            const gx = Math.floor(p.x / this.GRID_SIZE);
            const gy = Math.floor(p.y / this.GRID_SIZE);

            if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
                const idx = gy * this.cols + gx;
                const currentHeight = this.grid[idx];

                // Collision with UI obstacles (Exclusion Areas)
                const isHitObstacle = exclusionAreas.some(area =>
                    p.x >= area.x && p.x <= area.x + area.width &&
                    p.y >= area.y && p.y <= area.y + area.height
                );

                // Probability of settling increases with existing height (sand traps sand)
                const isHitSand = currentHeight > (Math.random() * this.SAND_TRAP_THRESHOLD);

                if (isHitObstacle || isHitSand) {
                    const r = Math.random();
                    if (r < this.SETTLE_PROBABILITY) {
                        this.grid[idx] = Math.min(this.MAX_HEIGHT, this.grid[idx] + 1);
                        this.particles.splice(i, 1);
                        continue;
                    } else if (r < this.SETTLE_PROBABILITY + this.ROLL_PROBABILITY) {
                        // Creep/Roll: redirect velocity
                        p.vx *= this.CREEP_VELOCITY_REDUCTION;
                        p.vy += (Math.random() - 0.5) * this.CREEP_VERTICAL_JITTER;
                        // Avoid getting stuck deep in a height/obstacle
                        p.x += p.vx;
                        p.y += p.vy;
                    }
                }
            }
        }

        // Rendering
        ctx.clearRect(0, 0, this.width, this.height);

        // Draw Sand Accumulation (Grid)
        ctx.fillStyle = 'rgba(194, 178, 128, 0.7)'; // Sand color
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const h = this.grid[y * this.cols + x];
                if (h > 0) {
                    const alpha = Math.min(1.0, this.MIN_SAND_ALPHA + h / this.MAX_HEIGHT);
                    ctx.globalAlpha = alpha;
                    ctx.fillRect(x * this.GRID_SIZE, y * this.GRID_SIZE, this.GRID_SIZE - 1, this.GRID_SIZE - 1);
                }
            }
        }
        ctx.globalAlpha = 1.0;

        // Draw Individual Grains
        ctx.fillStyle = '#EEDC82'; // Light sand
        for (const p of this.particles) {
            ctx.fillRect(p.x, p.y, 1, 1);
        }
    }

    onClick(x, y) {
        const gx = Math.floor(x / this.GRID_SIZE);
        const gy = Math.floor(y / this.GRID_SIZE);
        const radius = 6;

        for (let i = -radius; i <= radius; i++) {
            for (let j = -radius; j <= radius; j++) {
                const nx = gx + i;
                const ny = gy + j;
                if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                    const dist = Math.sqrt(i * i + j * j);
                    const idx = ny * this.cols + nx;
                    if (dist < radius && this.grid[idx] > 0) {
                        const count = Math.floor(this.grid[idx]);
                        this.grid[idx] = 0;
                        for (let k = 0; k < count; k++) {
                            const p = this.createParticle(nx * this.GRID_SIZE, ny * this.GRID_SIZE);
                            p.vx = (Math.random() - 0.3) * 5;
                            p.vy = (Math.random() - 0.5) * 5;
                            this.particles.push(p);
                        }
                    }
                }
            }
        }
    }
}
