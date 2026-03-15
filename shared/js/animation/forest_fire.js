import { AnimationBase } from '../animation_base.js';

/**
 * Forest Fire Simulation (Cellular Automata) - DevOnly
 * Simulates fire spreading through a forest, with wind and obstacles.
 * 森林火災が風や障害物の影響を受けながら、木々を焼き尽くしていく様子をシミュレートします。
 *
 * Technical Concepts for Junior Engineers:
 * 1. Cellular Automata: Each grid cell's state depends on its neighbors and fixed rules.
 * 2. TypedArray Optimization: Using Uint8Array to store states efficiently.
 * 3. Directional Influence (Wind): Modifying spreading probabilities based on direction.
 * 4. Loop Optimization: Pre-calculating neighbor offsets and weights outside the main loop to minimize object creation and GC overhead.
 *
 * ジュニアエンジニア向けのポイント:
 * 1. セル・オートマトン: 各グリッドセルの状態は、隣接するセルの状態と決まったルールに従って変化します。
 * 2. TypedArrayによる最適化: 状態を効率的に保存するためにUint8Arrayを使用します。
 * 3. 方向性の影響（風）: 方向によって延焼確率を変化させます。
 * 4. ループの最適化: オブジェクト作成とGC（ガベージコレクション）のオーバーヘッドを最小限に抑えるため、メインループの外で隣接オフセットと重みを事前計算します。
 */
export default class ForestFire extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Forest Fire Simulation",
            ja: "森林火災のシミュレーション"
        },
        description: {
            en: "A simulation of a forest fire. Click to start a fire, and watch it spread with the wind.",
            ja: "森林火災のシミュレーションです。クリックで火をつけ、風に乗って広がる様子を観察しましょう。"
        },
        author: "QuickLog-Solo",
        devOnly: true,
        rewindable: true
    };

    config = {
        mode: 'canvas',
        exclusionStrategy: 'freedom'
    };

    // --- State Constants ---
    EMPTY = 0;
    TREE = 1;
    BURNING = 2;
    BURNT = 3;

    // --- Simulation Constants ---
    GRID_SIZE = 5;              // Resolution of the simulation
    SPREAD_PROBABILITY = 0.08;  // Base chance to spread to a neighbor
    WIND_X = 0.15;              // Extra probability in horizontal direction (rightward)
    WIND_Y = 0.05;              // Extra probability in vertical direction (downward)
    BURN_TIME = 12;             // How many frames a cell stays burning

    // --- Advanced Behavior Tuning ---
    INITIAL_TREE_COVERAGE = 0.8; // Initial percentage of the grid filled with trees
    SIMULATION_FPS = 15;        // Approximate updates per second
    REPLANT_RADIUS = 4;         // Radius of the area replanted on click
    CELL_GAP = 0.5;             // Gap between grid cells when rendering
    FLICKER_THRESHOLD = 0.5;    // Probability threshold for fire color flickering

    constructor() {
        super();
        this.grid = null;        // Current state
        this.gridBuffer = null;  // Next state
        this.timers = null;      // Time remaining for burning cells
        this.cols = 0;
        this.rows = 0;
        this.width = 0;
        this.height = 0;
        this.lastUpdateMs = 0;

        // Optimized neighbor structure to avoid object creation in hot loops
        this.neighbors = [];
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
        this.grid = new Uint8Array(size);
        this.gridBuffer = new Uint8Array(size);
        this.timers = new Uint8Array(size);

        for (let i = 0; i < size; i++) {
            // Populate with trees (approx 80% coverage)
            this.grid[i] = Math.random() < this.INITIAL_TREE_COVERAGE ? this.TREE : this.EMPTY;
        }
        this.gridBuffer.set(this.grid);

        // Pre-calculate neighbor info
        this.neighbors = [
            { dx: -1, dy: 0, w: 1.0 - this.WIND_X }, // West
            { dx: 1, dy: 0, w: 1.0 + this.WIND_X },  // East
            { dx: 0, dy: -1, w: 1.0 - this.WIND_Y }, // North
            { dx: 0, dy: 1, w: 1.0 + this.WIND_Y }   // South
        ];
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} params
     */
    draw(ctx, { elapsedMs, exclusionAreas = [], speed = 1 } = {}) {
        // Run update logic at a fixed interval
        const updateThreshold = (1000 / this.SIMULATION_FPS) / speed;
        if (elapsedMs - this.lastUpdateMs > updateThreshold) {
            this.update(exclusionAreas);
            this.lastUpdateMs = elapsedMs;
        }

        this.render(ctx);
    }

    update(exclusionAreas) {
        // Sync buffer with current state
        this.gridBuffer.set(this.grid);

        // Clear trees in exclusion areas (firebreaks)
        exclusionAreas.forEach(area => {
            const gx1 = Math.floor(area.x / this.GRID_SIZE);
            const gy1 = Math.floor(area.y / this.GRID_SIZE);
            const gx2 = Math.ceil((area.x + area.width) / this.GRID_SIZE);
            const gy2 = Math.ceil((area.y + area.height) / this.GRID_SIZE);

            for (let y = Math.max(0, gy1); y < Math.min(this.rows, gy2); y++) {
                for (let x = Math.max(0, gx1); x < Math.min(this.cols, gx2); x++) {
                    const idx = y * this.cols + x;
                    this.grid[idx] = this.EMPTY;
                    this.gridBuffer[idx] = this.EMPTY;
                }
            }
        });

        // Simulation Step
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                const state = this.grid[idx];

                if (state === this.BURNING) {
                    // Update burn timer
                    if (this.timers[idx] > 0) {
                        this.timers[idx]--;
                    } else {
                        this.gridBuffer[idx] = this.BURNT;
                    }

                    // Spread fire to 4-way neighbors
                    // Use pre-calculated neighbor structure for performance
                    for (let nIdx = 0; nIdx < this.neighbors.length; nIdx++) {
                        const n = this.neighbors[nIdx];
                        const nx = x + n.dx;
                        const ny = y + n.dy;
                        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                            const targetIdx = ny * this.cols + nx;
                            if (this.grid[targetIdx] === this.TREE) {
                                if (Math.random() < (this.SPREAD_PROBABILITY * n.w)) {
                                    this.gridBuffer[targetIdx] = this.BURNING;
                                    this.timers[targetIdx] = this.BURN_TIME;
                                }
                            }
                        }
                    }
                }
            }
        }
        this.grid.set(this.gridBuffer);
    }

    render(ctx) {
        ctx.clearRect(0, 0, this.width, this.height);
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                const state = this.grid[idx];
                if (state === this.EMPTY) continue;

                switch (state) {
                    case this.TREE:
                        ctx.fillStyle = '#2d5a27'; // Dark forest green
                        break;
                    case this.BURNING:
                        // Visual flicker
                        ctx.fillStyle = Math.random() > this.FLICKER_THRESHOLD ? '#ff4500' : '#ffa500';
                        break;
                    case this.BURNT:
                        ctx.fillStyle = '#3a3a3a'; // Charcoal
                        break;
                }
                ctx.fillRect(x * this.GRID_SIZE, y * this.GRID_SIZE, this.GRID_SIZE - this.CELL_GAP, this.GRID_SIZE - this.CELL_GAP);
            }
        }
    }

    onClick(x, y) {
        const gx = Math.floor(x / this.GRID_SIZE);
        const gy = Math.floor(y / this.GRID_SIZE);

        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
            const idx = gy * this.cols + gx;
            if (this.grid[idx] === this.TREE) {
                // Ignite
                this.grid[idx] = this.BURNING;
                this.timers[idx] = this.BURN_TIME;
            } else {
                // Plant area
                const r = this.REPLANT_RADIUS;
                for (let j = -r; j <= r; j++) {
                    for (let i = -r; i <= r; i++) {
                        const nx = gx + i;
                        const ny = gy + j;
                        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                            const nidx = ny * this.cols + nx;
                            if (this.grid[nidx] !== this.BURNING && Math.sqrt(i*i + j*j) < r) {
                                this.grid[nidx] = this.TREE;
                                this.timers[nidx] = 0;
                            }
                        }
                    }
                }
            }
        }
    }
}
