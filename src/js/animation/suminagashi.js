import { AnimationBase } from '../animation_base.js';

/**
 * Suminagashi / Marbling (Fluid Diffusion) - DevOnly
 * Simulates ink floating on water, distorted by mouse movements.
 * 水面に浮かぶ墨が、マウスの動きによって引きずられ、複雑な模様を作る様子をシミュレートします。
 *
 * Technical Concepts for Junior Engineers:
 * 1. Vector Fields: Using a grid of velocities to represent fluid flow.
 * 2. Particle Advection: Moving points based on the velocity field at their position.
 * 3. Performance with TypedArrays: Using Float32Array for high-performance numerical grids.
 * 4. Boundary Conditions: Handling particles and flow at the edges of the simulation.
 *
 * ジュニアエンジニア向けのポイント:
 * 1. ベクトル場: 流体の流れを表現するために、各地点の速度（ベクトル）のグリッドを使用します。
 * 2. 粒子の移流: その場所の速度ベクトルに基づいて点を移動させます。
 * 3. TypedArrayによるパフォーマンス: 高速な数値計算のためにFloat32Arrayを使用します。
 * 4. 境界条件: シミュレーションの端における粒子と流れの制御。
 */
export default class Suminagashi extends AnimationBase {
    static metadata = {
        specVersion: '1.1',
        name: {
            en: "Suminagashi (Marbling)",
            ja: "墨流し（マーブリング）"
        },
        description: {
            en: "A fluid simulation where you can stir 'ink' dots with your mouse to create beautiful swirls.",
            ja: "水面のインクをマウスでかき混ぜて、美しい渦巻き模様を作る流体シミュレーションです。"
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
    GRID_SIZE = 12;             // Resolution of the vector field
    VISCOSITY = 0.97;           // How much velocity is retained (0-1)
    DIFFUSION = 0.15;           // How much velocity spreads to neighbors
    MAX_PARTICLES = 2500;       // Total number of ink dots
    MOUSE_FORCE = 2.0;          // Strength of mouse stirring

    // --- Advanced Behavior Tuning ---
    OBSTACLE_JITTER = 6.0;      // Random push when a particle hits an obstacle
    INK_SPLASH_COUNT = 150;     // Number of particles added on click
    INK_SPLASH_RADIUS = 30;     // Maximum radius of a splash
    ABSOLUTE_MAX_PARTICLES = 5000; // Hard limit for memory safety
    INITIAL_CIRCLE_SCALE = 0.35; // Size of the initial ink distribution

    constructor() {
        super();
        this.particles = [];
        this.fieldU = null;     // Horizontal velocity component
        this.fieldV = null;     // Vertical velocity component
        this.bufferU = null;    // Buffer for velocity diffusion
        this.bufferV = null;    // Buffer for velocity diffusion
        this.cols = 0;
        this.rows = 0;
        this.width = 0;
        this.height = 0;
        this.lastMouseX = -1;
        this.lastMouseY = -1;
    }

    /**
     * @param {number} width
     * @param {number} height
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
        this.cols = Math.ceil(width / this.GRID_SIZE) + 1;
        this.rows = Math.ceil(height / this.GRID_SIZE) + 1;

        const size = this.cols * this.rows;
        this.fieldU = new Float32Array(size);
        this.fieldV = new Float32Array(size);
        this.bufferU = new Float32Array(size);
        this.bufferV = new Float32Array(size);

        // Initialize particles in a circular formation
        this.particles = [];
        const centerX = width / 2;
        const centerY = height / 2;
        for (let i = 0; i < this.MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * Math.min(width, height) * this.INITIAL_CIRCLE_SCALE;
            this.particles.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                color: Math.random() > 0.6 ? '#222' : '#555'
            });
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} params
     */
    draw(ctx, { elapsedMs: _, exclusionAreas = [], speed = 1 } = {}) {
        const dt = speed;

        this.updateVelocityField(dt, exclusionAreas);

        ctx.clearRect(0, 0, this.width, this.height);

        for (const p of this.particles) {
            const gx = Math.floor(p.x / this.GRID_SIZE);
            const gy = Math.floor(p.y / this.GRID_SIZE);

            if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
                const idx = gy * this.cols + gx;
                p.x += this.fieldU[idx] * dt;
                p.y += this.fieldV[idx] * dt;
            }

            // Boundary wrap-around and interaction with exclusion areas
            const isInside = exclusionAreas.some(area =>
                p.x >= area.x && p.x <= area.x + area.width &&
                p.y >= area.y && p.y <= area.y + area.height
            );

            if (isInside || p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) {
                // Keep particles inside the water surface
                if (p.x < 0) p.x += this.width;
                if (p.x > this.width) p.x -= this.width;
                if (p.y < 0) p.y += this.height;
                if (p.y > this.height) p.y -= this.height;

                // If still inside obstacle, jitter out
                if (isInside) {
                    p.x += (Math.random() - 0.5) * this.OBSTACLE_JITTER;
                    p.y += (Math.random() - 0.5) * this.OBSTACLE_JITTER;
                }
            }

            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 1.2, 1.2);
        }
    }

    updateVelocityField(dt, exclusionAreas) {
        // Simple velocity diffusion (Jacobi iteration style)
        for (let y = 1; y < this.rows - 1; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                const idx = y * this.cols + x;

                // Average neighbors
                const avgU = (this.fieldU[idx - this.cols] + this.fieldU[idx + this.cols] +
                              this.fieldU[idx - 1] + this.fieldU[idx + 1]) * 0.25;
                const avgV = (this.fieldV[idx - this.cols] + this.fieldV[idx + this.cols] +
                              this.fieldV[idx - 1] + this.fieldV[idx + 1]) * 0.25;

                this.bufferU[idx] = this.fieldU[idx] + (avgU - this.fieldU[idx]) * this.DIFFUSION * dt;
                this.bufferV[idx] = this.fieldV[idx] + (avgV - this.fieldV[idx]) * this.DIFFUSION * dt;
            }
        }

        const viscosity = Math.pow(this.VISCOSITY, dt);
        for (let i = 0; i < this.fieldU.length; i++) {
            this.fieldU[i] = this.bufferU[i] * viscosity;
            this.fieldV[i] = this.bufferV[i] * viscosity;
        }

        // Apply exclusion areas as obstacles in the field
        exclusionAreas.forEach(area => {
            const gx1 = Math.floor(area.x / this.GRID_SIZE);
            const gy1 = Math.floor(area.y / this.GRID_SIZE);
            const gx2 = Math.ceil((area.x + area.width) / this.GRID_SIZE);
            const gy2 = Math.ceil((area.y + area.height) / this.GRID_SIZE);

            for (let y = Math.max(0, gy1); y < Math.min(this.rows, gy2); y++) {
                for (let x = Math.max(0, gx1); x < Math.min(this.cols, gx2); x++) {
                    const idx = y * this.cols + x;
                    this.fieldU[idx] = 0;
                    this.fieldV[idx] = 0;
                }
            }
        });
    }

    onMouseMove(x, y) {
        if (this.lastMouseX !== -1) {
            const dx = x - this.lastMouseX;
            const dy = y - this.lastMouseY;

            const gx = Math.floor(x / this.GRID_SIZE);
            const gy = Math.floor(y / this.GRID_SIZE);
            const radius = 3;

            for (let j = -radius; j <= radius; j++) {
                for (let i = -radius; i <= radius; i++) {
                    const nx = gx + i;
                    const ny = gy + j;
                    if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                        const distSq = i * i + j * j;
                        if (distSq < radius * radius) {
                            const weight = 1 - Math.sqrt(distSq) / radius;
                            const idx = ny * this.cols + nx;
                            this.fieldU[idx] += dx * weight * this.MOUSE_FORCE;
                            this.fieldV[idx] += dy * weight * this.MOUSE_FORCE;
                        }
                    }
                }
            }
        }
        this.lastMouseX = x;
        this.lastMouseY = y;
    }

    onClick(x, y) {
        // Splash more ink
        for (let i = 0; i < this.INK_SPLASH_COUNT; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.INK_SPLASH_RADIUS;
            this.particles.push({
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                color: '#000'
            });
        }
        if (this.particles.length > this.ABSOLUTE_MAX_PARTICLES) {
            this.particles.splice(0, this.INK_SPLASH_COUNT);
        }
    }
}
