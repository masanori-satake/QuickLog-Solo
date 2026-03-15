import { AnimationBase } from '../animation_base.js';

/**
 * Liesegang Rings (Precipitation Patterns) - DevOnly
 * Simulates the formation of concentric bands of precipitate in a gel.
 * ゲル内での化学物質の拡散と沈殿によって生じる、同心円状の縞模様をシミュレートします。
 *
 * Technical Concepts for Junior Engineers:
 * 1. Reaction-Diffusion System: Two or more chemicals reacting and moving through a medium.
 * 2. Threshold-based Deposition: Precipitate forms only when concentration exceeds a certain level.
 * 3. Spatial Patterns: How simple rules can create complex, organic structures.
 * 4. Concentric Growth: Waves of reaction moving outwards from a central point.
 *
 * ジュニアエンジニア向けのポイント:
 * 1. 反応拡散系: 2つ以上の化学物質が反応し、媒体の中を移動するシステム。
 * 2. 閾値ベースの沈殿: 濃度が一定レベルを超えたときのみ、沈殿物が発生します。
 * 3. 空間パターン: 単純なルールから複雑で有機的な構造がどのように生まれるか。
 * 4. 同心円状の成長: 中心から外側に向かって反応の波が移動します。
 */
export default class LiesegangRings extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Liesegang Rings",
            ja: "リーゼガング環"
        },
        description: {
            en: "A chemical simulation forming periodic patterns, similar to tree rings or geological layers.",
            ja: "年輪や地層のような、周期的なパターンを形成する化学シミュレーションです。"
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
    DIFFUSION_RATE_A = 0.2;     // Diffusion speed of chemical A
    DIFFUSION_RATE_B = 0.1;     // Diffusion speed of chemical B
    REACTION_RATE = 0.05;       // Speed of precipitation reaction
    PRECIPITATION_THRESHOLD = 0.6; // Minimum concentration to form a "ring"

    // --- Advanced Tuning Constants (Junior Engineer reference) ---
    AMBIENT_B_INFLUX = 0.006;   // Natural chemical B added to the gel each step
    MIN_REACTION_STRENGTH = 0.01; // Minimum reaction result to trigger changes
    CONSUMPTION_RATIO = 0.1;    // Percentage of concentration remaining after precipitate forms
    MAX_CONCENTRATION = 2.0;    // Cap for concentration levels
    VISIBLE_THRESHOLD = 0.05;   // Concentration level to start drawing background color
    MAX_BG_ALPHA = 0.2;         // Maximum opacity for the background concentration view

    constructor() {
        super();
        this.gridA = null;       // Concentration of chemical A
        this.gridB = null;       // Concentration of chemical B
        this.bufferA = null;     // Buffer for diffusion
        this.bufferB = null;     // Buffer for diffusion
        this.precipitate = null; // 1 if precipitate exists, 0 otherwise
        this.cols = 0;
        this.rows = 0;
        this.width = 0;
        this.height = 0;
        this.lastUpdateMs = 0;
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

        const size = this.cols * this.rows;
        this.gridA = new Float32Array(size);
        this.gridB = new Float32Array(size);
        this.bufferA = new Float32Array(size);
        this.bufferB = new Float32Array(size);
        this.precipitate = new Uint8Array(size);

        // Inject initial concentrations in the center
        const centerX = Math.floor(this.cols / 2);
        const centerY = Math.floor(this.rows / 2);
        this.injectConcentration(centerX, centerY, 5, 1.0, 0);
    }

    injectConcentration(gx, gy, radius, amountA, amountB) {
        for (let j = -radius; j <= radius; j++) {
            for (let i = -radius; i <= radius; i++) {
                const nx = gx + i;
                const ny = gy + j;
                if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                    const distSq = i * i + j * j;
                    if (distSq < radius * radius) {
                        const idx = ny * this.cols + nx;
                        this.gridA[idx] += amountA;
                        this.gridB[idx] += amountB;
                    }
                }
            }
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} params
     */
    draw(ctx, { elapsedMs, exclusionAreas = [], speed = 1 } = {}) {
        const dt = speed;
        // Run update logic at a fixed interval (approx 10 FPS simulation rate)
        const updateThreshold = 100 / dt;
        if (elapsedMs - this.lastUpdateMs > updateThreshold) {
            this.update(exclusionAreas);
            this.lastUpdateMs = elapsedMs;
        }

        this.render(ctx);
    }

    update(exclusionAreas) {
        // 1. Diffuse and update buffers
        for (let y = 1; y < this.rows - 1; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                const idx = y * this.cols + x;

                // Average of 4 neighbors
                const avgA = (this.gridA[idx - this.cols] + this.gridA[idx + this.cols] +
                              this.gridA[idx - 1] + this.gridA[idx + 1]) * 0.25;
                const avgB = (this.gridB[idx - this.cols] + this.gridB[idx + this.cols] +
                              this.gridB[idx - 1] + this.gridB[idx + 1]) * 0.25;

                this.bufferA[idx] = this.gridA[idx] + (avgA - this.gridA[idx]) * this.DIFFUSION_RATE_A;
                this.bufferB[idx] = this.gridB[idx] + (avgB - this.gridB[idx]) * this.DIFFUSION_RATE_B;
            }
        }

        // 2. Reaction and state transfer
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;

                // Handle UI obstacles in exclusion areas
                const px = x * this.GRID_SIZE;
                const py = y * this.GRID_SIZE;
                const isBlocked = exclusionAreas.some(area =>
                    px >= area.x && px <= area.x + area.width &&
                    py >= area.y && py <= area.y + area.height
                );

                if (isBlocked) {
                    this.gridA[idx] = 0;
                    this.gridB[idx] = 0;
                    continue;
                }

                let a = this.bufferA[idx];
                let b = this.bufferB[idx];

                // Reaction and Precipitation Logic
                const reaction = a * b * this.REACTION_RATE;
                if (reaction > this.MIN_REACTION_STRENGTH) {
                    a -= reaction;
                    b -= reaction;
                    // If combined concentration is high enough, it forms a ring (precipitate)
                    if (a + b > this.PRECIPITATION_THRESHOLD) {
                        this.precipitate[idx] = 1;
                        a *= this.CONSUMPTION_RATIO; // Consumed in the reaction
                        b *= this.CONSUMPTION_RATIO;
                    }
                }

                // Natural ambient chemical B present in the gel
                b += this.AMBIENT_B_INFLUX;

                this.gridA[idx] = Math.min(this.MAX_CONCENTRATION, a);
                this.gridB[idx] = Math.min(this.MAX_CONCENTRATION, b);
            }
        }
    }

    render(ctx) {
        ctx.clearRect(0, 0, this.width, this.height);

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                if (this.precipitate[idx]) {
                    ctx.fillStyle = '#f5deb3'; // Wheat/Light Tan
                    ctx.fillRect(x * this.GRID_SIZE, y * this.GRID_SIZE, this.GRID_SIZE, this.GRID_SIZE);
                } else {
                    const concentration = this.gridA[idx];
                    if (concentration > this.VISIBLE_THRESHOLD) {
                        ctx.fillStyle = `rgba(139, 69, 19, ${Math.min(this.MAX_BG_ALPHA, concentration)})`; // Soft brown
                        ctx.fillRect(x * this.GRID_SIZE, y * this.GRID_SIZE, this.GRID_SIZE, this.GRID_SIZE);
                    }
                }
            }
        }
    }

    onClick(x, y) {
        const gx = Math.floor(x / this.GRID_SIZE);
        const gy = Math.floor(y / this.GRID_SIZE);
        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
            // Drop more of chemical A to trigger a new pattern
            this.injectConcentration(gx, gy, 3, 2.0, 0);
        }
    }
}
