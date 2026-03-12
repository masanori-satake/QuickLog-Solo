import { AnimationBase } from '../animation_base.js';

/**
 * Plasma Discharge / Diffusion Limited Aggregation (DLA) - DevOnly
 * Simulates growth of fractal structures as random walkers stick to a seed.
 * ランダムに動き回る粒子が中心の「核」に付着し、フラクタル状の構造（稲妻や雪の結晶のような形）を形成する様子をシミュレートします。
 *
 * Technical Concepts for Junior Engineers:
 * 1. Random Walk: Particles moving in a random direction at each step.
 * 2. Diffusion Limited Aggregation (DLA): Growth controlled by the diffusion of particles.
 * 3. Self-Organization: Order (fractal structure) emerging from simple random movement.
 * 4. Loop Optimization: Pre-calculating neighbor offsets outside hot loops to minimize GC pressure.
 *
 * ジュニアエンジニア向けのポイント:
 * 1. ランダムウォーク: 各ステップでランダムな方向に移動する粒子。
 * 2. 拡散限定凝集（DLA）: 粒子の拡散によって制御される成長プロセス。
 * 3. 自己組織化: 単純なランダムな動きから生まれる秩序（フラクタル構造）。
 * 4. ループの最適化: GC（ガベージコレクション）の圧力を最小限に抑えるため、ホットループの外で隣接オフセットを事前計算します。
 */
export default class PlasmaDischarge extends AnimationBase {
    static metadata = {
        specVersion: '1.1',
        name: {
            en: "Plasma Discharge (DLA)",
            ja: "プラズマ・放電（DLA）"
        },
        description: {
            en: "Simulates the growth of electric discharges or coral-like fractal structures through particle aggregation.",
            ja: "粒子の凝集によって、放電の跡やサンゴのようなフラクタル構造が成長していく様子をシミュレートします。"
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
    GRID_SIZE = 4;
    MAX_PARTICLES = 1200;       // Number of random walkers active at once
    STUCK_PROBABILITY = 0.9;    // Chance to stick when touching a neighbor

    // --- Advanced Tuning & Visuals ---
    STEPS_PER_FRAME = 6;        // Number of simulation steps per draw call to accelerate growth
    SHADOW_BLUR_RADIUS = 4;     // Blur radius for the electric glow effect
    WALKER_ALPHA = 0.25;        // Opacity of the background random walkers
    CELL_GAP = 0.5;             // Gap between cells for a sharper look

    constructor() {
        super();
        this.stuck = null;   // Uint8Array: 1 if occupied, 0 if free
        this.particles = []; // Random walkers
        this.cols = 0;
        this.rows = 0;
        this.width = 0;
        this.height = 0;

        // Optimized neighbor offsets to avoid object creation in hot loops
        this.neighborOffsets = [];
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

        this.stuck = new Uint8Array(this.cols * this.rows);

        // Initial Seed in the center of the screen
        const cx = Math.floor(this.cols / 2);
        const cy = Math.floor(this.rows / 2);
        this.stuck[cy * this.cols + cx] = 1;

        // Populate walkers at the screen edges
        this.particles = [];
        for (let i = 0; i < this.MAX_PARTICLES; i++) {
            this.particles.push(this.createParticleAtEdge());
        }

        // Pre-calculate neighbor offsets (8-way connectivity)
        this.neighborOffsets = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: -1 }, { dx: 1, dy: 1 },
            { dx: -1, dy: 1 }, { dx: 1, dy: -1 }
        ];
    }

    createParticleAtEdge() {
        const edge = Math.floor(Math.random() * 4);
        let gx, gy;
        if (edge === 0) { gx = 0; gy = Math.floor(Math.random() * this.rows); } // Left
        else if (edge === 1) { gx = this.cols - 1; gy = Math.floor(Math.random() * this.rows); } // Right
        else if (edge === 2) { gx = Math.floor(Math.random() * this.cols); gy = 0; } // Top
        else { gx = Math.floor(Math.random() * this.cols); gy = this.rows - 1; } // Bottom

        return { gx, gy };
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} params
     */
    draw(ctx, { elapsedMs: _, exclusionAreas = [], speed = 1 } = {}) {
        const dt = speed;
        // Perform multiple steps per frame to increase growth speed
        for (let s = 0; s < this.STEPS_PER_FRAME * dt; s++) {
            this.update(exclusionAreas);
        }

        this.render(ctx);
    }

    update(exclusionAreas) {
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            // Random walk step (-1, 0, or 1 in both directions)
            const dx = Math.floor(Math.random() * 3) - 1;
            const dy = Math.floor(Math.random() * 3) - 1;
            p.gx += dx;
            p.gy += dy;

            // Boundary and exclusion area handling
            const px = p.gx * this.GRID_SIZE;
            const py = p.gy * this.GRID_SIZE;
            const isBlocked = (p.gx < 0 || p.gx >= this.cols || p.gy < 0 || p.gy >= this.rows) ||
                exclusionAreas.some(area =>
                    px >= area.x && px <= area.x + area.width &&
                    py >= area.y && py <= area.y + area.height
                );

            if (isBlocked) {
                this.particles[i] = this.createParticleAtEdge();
                continue;
            }

            // Check neighbors for sticking (touches the growing structure)
            let isSticking = false;
            for (let nIdx = 0; nIdx < this.neighborOffsets.length; nIdx++) {
                const n = this.neighborOffsets[nIdx];
                const nx = p.gx + n.dx;
                const ny = p.gy + n.dy;
                if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                    if (this.stuck[ny * this.cols + nx] === 1) {
                        isSticking = true;
                        break;
                    }
                }
            }

            if (isSticking && Math.random() < this.STUCK_PROBABILITY) {
                this.stuck[p.gy * this.cols + p.gx] = 1;
                // Respawn particle at edge to continue growth
                this.particles[i] = this.createParticleAtEdge();
            }
        }
    }

    render(ctx) {
        ctx.clearRect(0, 0, this.width, this.height);

        // Draw the Fractal Structure (Stuck particles)
        ctx.fillStyle = '#add8e6'; // Light blue/plasma glow
        ctx.shadowBlur = this.SHADOW_BLUR_RADIUS;
        ctx.shadowColor = '#4169e1'; // Royal blue glow

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.stuck[y * this.cols + x]) {
                    ctx.fillRect(x * this.GRID_SIZE, y * this.GRID_SIZE, this.GRID_SIZE - this.CELL_GAP, this.GRID_SIZE - this.CELL_GAP);
                }
            }
        }

        ctx.shadowBlur = 0; // Reset for performance of background particles

        // Draw active random walkers (faint background activity)
        ctx.fillStyle = `rgba(255, 255, 255, ${this.WALKER_ALPHA})`;
        for (const p of this.particles) {
            ctx.fillRect(p.gx * this.GRID_SIZE, p.gy * this.GRID_SIZE, 1, 1);
        }
    }

    onClick(x, y) {
        const gx = Math.floor(x / this.GRID_SIZE);
        const gy = Math.floor(y / this.GRID_SIZE);
        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
            // Seed a new branch from click location
            this.stuck[gy * this.cols + gx] = 1;
        }
    }
}
