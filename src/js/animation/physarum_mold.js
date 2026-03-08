import { AnimationBase } from '../animation_base.js';

/**
 * Physarum Slime Mold Simulation (最短経路探索) - DevOnly
 * Simulates a large number of agents (particles) moving towards "food" and leaving pheromone trails.
 * 多数のエージェント（点）が「餌」に向かって進みながら、「フェロモン（色の薄い跡）」を残し、効率的なネットワークを形成する様子をシミュレートします。
 *
 * Technical Concepts for Junior Engineers:
 * 1. Multi-agent System: Many independent entities following local rules.
 * 2. Sensory Perception: Agents "smell" the environment (pheromones/food) to decide direction.
 * 3. Performance Tuning: Using TypedArrays for the pheromone grid and optimizing agent loops.
 * 4. Emergent Behavior: Complex network structures appearing from simple agent rules.
 *
 * ジュニアエンジニア向けのポイント:
 * 1. マルチエージェント・システム: 独立した多数のエンティティが局所的なルールに従って動きます。
 * 2. 感覚知覚: エージェントは環境（フェロモンや餌）を「嗅いで」移動方向を決定します。
 * 3. パフォーマンス・チューニング: フェロモングリッドにTypedArrayを使用し、エージェントループを最適化。
 * 4. 創発的行動: 単純なエージェントのルールから複雑なネットワーク構造が現れます。
 */
export default class PhysarumMold extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Slime Mold (Physarum)",
            ja: "粘菌の探索アルゴリズム"
        },
        description: {
            en: "A biological simulation of slime mold searching for food and forming optimized network paths.",
            ja: "餌を探して最適なネットワーク経路を形成する、粘菌の生物学的シミュレーションです。"
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
    MAX_AGENTS = 1800;          // Number of slime mold agents
    SENSOR_ANGLE = Math.PI / 4; // Angle to look for pheromones (45 degrees)
    SENSOR_DIST = 10;           // Distance to sense ahead
    TURN_SPEED = 0.45;          // How fast agents can turn (radians)
    MOVE_SPEED = 1.0;           // How fast agents move (pixels per frame)
    EVAPORATION_RATE = 0.94;    // Pheromone decay rate
    DIFFUSION_RATE = 0.12;      // Pheromone spread rate
    GRID_SIZE = 4;              // Resolution of the pheromone map

    // --- Advanced Behavior & Visual Tuning ---
    PHEROMONE_DEPOSIT_RATE = 0.4; // Amount of pheromone dropped by an agent per frame
    MAX_PHEROMONE_LEVEL = 2.5;    // Cap for pheromone concentration in a cell
    FOOD_ATTRACTION_FORCE = 6.0;  // Multiplier for food intensity during sensing
    FOOD_DECAY_RATE = 0.999;      // Speed at which placed food disappears
    TRAIL_VISIBILITY_THRESHOLD = 0.05; // Pheromone level to start drawing
    FOOD_VISIBILITY_THRESHOLD = 0.1;   // Food level to start drawing
    MAX_TRAIL_ALPHA = 0.7;        // Maximum opacity for the slime network

    constructor() {
        super();
        this.agents = [];
        this.trailMap = null;       // Pheromone levels (Float32Array)
        this.trailMapBuffer = null; // Buffer for diffusion
        this.foodMap = null;        // Food availability (Float32Array)
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

        const size = this.cols * this.rows;
        this.trailMap = new Float32Array(size);
        this.trailMapBuffer = new Float32Array(size);
        this.foodMap = new Float32Array(size);

        // Initialize agents at random positions
        this.agents = [];
        for (let i = 0; i < this.MAX_AGENTS; i++) {
            this.agents.push({
                x: Math.random() * width,
                y: Math.random() * height,
                angle: Math.random() * Math.PI * 2
            });
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} params
     */
    draw(ctx, { elapsedMs, exclusionAreas = [], speed = 1 } = {}) {
        const dt = speed;

        // 1. Update Agent Movement and Pheromone Deposition
        for (const a of this.agents) {
            // Sense 3 directions: Left, Front, Right
            const v1 = this.sense(a, -this.SENSOR_ANGLE);
            const v2 = this.sense(a, 0);
            const v3 = this.sense(a, this.SENSOR_ANGLE);

            // Turn towards highest pheromone/food
            if (v2 > v1 && v2 > v3) {
                // Front is best
            } else if (v2 < v1 && v2 < v3) {
                // Jitter turn
                a.angle += (Math.random() - 0.5) * 2 * this.TURN_SPEED * dt;
            } else if (v1 > v3) {
                a.angle -= this.TURN_SPEED * dt;
            } else if (v3 > v1) {
                a.angle += this.TURN_SPEED * dt;
            }

            // Move
            a.x += Math.cos(a.angle) * this.MOVE_SPEED * dt;
            a.y += Math.sin(a.angle) * this.MOVE_SPEED * dt;

            // Handle Boundaries and UI Obstacles
            const isHitObstacle = (a.x < 0 || a.x > this.width || a.y < 0 || a.y > this.height) ||
                exclusionAreas.some(area =>
                    a.x >= area.x && a.x <= area.x + area.width &&
                    a.y >= area.y && a.y <= area.y + area.height
                );

            if (isHitObstacle) {
                a.x = Math.max(0, Math.min(this.width, a.x));
                a.y = Math.max(0, Math.min(this.height, a.y));
                a.angle = Math.random() * Math.PI * 2;
            }

            // Deposit Pheromone on grid
            const gx = Math.floor(a.x / this.GRID_SIZE);
            const gy = Math.floor(a.y / this.GRID_SIZE);
            if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
                const idx = gy * this.cols + gx;
                this.trailMap[idx] = Math.min(this.MAX_PHEROMONE_LEVEL, this.trailMap[idx] + this.PHEROMONE_DEPOSIT_RATE * dt);
            }
        }

        // 2. Trail Map Processing (Diffuse and Evaporate)
        this.processPheromones(dt);

        // 3. Draw Results
        this.render(ctx);
    }

    sense(agent, sensorAngleOffset) {
        const sensorAngle = agent.angle + sensorAngleOffset;
        const sx = agent.x + Math.cos(sensorAngle) * this.SENSOR_DIST;
        const sy = agent.y + Math.sin(sensorAngle) * this.SENSOR_DIST;
        const gx = Math.floor(sx / this.GRID_SIZE);
        const gy = Math.floor(sy / this.GRID_SIZE);

        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
            const idx = gy * this.cols + gx;
            // Food is a very strong attraction factor
            return this.trailMap[idx] + this.foodMap[idx] * this.FOOD_ATTRACTION_FORCE;
        }
        return -1;
    }

    processPheromones(dt) {
        // A. Diffusion pass
        for (let y = 1; y < this.rows - 1; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                const idx = y * this.cols + x;
                const sum = this.trailMap[idx - this.cols] + this.trailMap[idx + this.cols] +
                            this.trailMap[idx - 1] + this.trailMap[idx + 1];
                const avg = sum * 0.25;
                this.trailMapBuffer[idx] = this.trailMap[idx] + (avg - this.trailMap[idx]) * this.DIFFUSION_RATE;
            }
        }

        // B. Evaporation and Transfer
        const evap = Math.pow(this.EVAPORATION_RATE, dt);
        for (let i = 0; i < this.trailMap.length; i++) {
            this.trailMap[i] = this.trailMapBuffer[i] * evap;

            // Gradually decay placed food
            if (this.foodMap[i] > 0) this.foodMap[i] *= this.FOOD_DECAY_RATE;
        }
    }

    render(ctx) {
        ctx.clearRect(0, 0, this.width, this.height);

        // Draw Pheromone Trails and Food
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                const trail = this.trailMap[idx];
                const food = this.foodMap[idx];

                if (food > this.FOOD_VISIBILITY_THRESHOLD) {
                    ctx.fillStyle = `rgba(255, 255, 180, ${food})`;
                    ctx.fillRect(x * this.GRID_SIZE, y * this.GRID_SIZE, this.GRID_SIZE, this.GRID_SIZE);
                }

                if (trail > this.TRAIL_VISIBILITY_THRESHOLD) {
                    // Slime mold network: greenish/yellow glow
                    ctx.fillStyle = `rgba(180, 255, 80, ${Math.min(this.MAX_TRAIL_ALPHA, trail)})`;
                    ctx.fillRect(x * this.GRID_SIZE, y * this.GRID_SIZE, this.GRID_SIZE, this.GRID_SIZE);
                }
            }
        }

        // Draw individual slime agents (very small white dots)
        ctx.fillStyle = '#fff';
        for (const a of this.agents) {
            ctx.fillRect(a.x, a.y, 1, 1);
        }
    }

    onClick(x, y) {
        const gx = Math.floor(x / this.GRID_SIZE);
        const gy = Math.floor(y / this.GRID_SIZE);
        const radius = 5;

        for (let j = -radius; j <= radius; j++) {
            for (let i = -radius; i <= radius; i++) {
                const nx = gx + i;
                const ny = gy + j;
                if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                    if (Math.sqrt(i*i + j*j) < radius) {
                        this.foodMap[ny * this.cols + nx] = 1.0;
                    }
                }
            }
        }
    }
}
