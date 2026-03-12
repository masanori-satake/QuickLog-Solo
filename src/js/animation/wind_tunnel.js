import { AnimationBase } from '../animation_base.js';

/**
 * Wind Tunnel Simulation Animation (DevOnly)
 * A visual simulation of air flow around obstacles (UI elements).
 * 障害物（UI要素）の周りの空気の流れを視覚的にシミュレートします。
 *
 * Technical Concepts for Junior Engineers:
 * 1. Vector Fields: Each particle's movement is influenced by a "force" at its position.
 * 2. Collision Avoidance: Particles detect 'exclusionAreas' and steer away.
 * 3. Karman Vortex: Simulating the oscillating wake that forms behind an object in a flow.
 *
 * ジュニアエンジニア向けのポイント:
 * 1. ベクトル場: 各粒子の動きは、その場所にある「力」の影響を受けます。
 * 2. 衝突回避: 粒子は 'exclusionAreas'（排他領域）を検知し、避けるように動きます。
 * 3. カルマン渦: 流れの中にある物体の背後にできる、交互に揺れる渦の列をシミュレートしています。
 */
export default class WindTunnel extends AnimationBase {
    static metadata = {
        specVersion: '1.1',
        name: {
            en: "Wind Tunnel",
            ja: "風洞実験"
        },
        description: {
            en: "Simulates air flow around UI elements. Demonstrates vector fields and collision avoidance.",
            ja: "UI要素の周りの空気の流れをシミュレートします。ベクトル場と衝突回避のデモンストレーションです。"
        },
        author: "QuickLog-Solo",
        devOnly: true, // This is a sample/development module
        rewindable: true
    };

    // Configuration for the Animation Engine
    // アニメーションエンジン用の設定
    config = {
        mode: 'sprite',            // Returns a list of dots {x, y, size}
        exclusionStrategy: 'freedom' // We want to know where FG is to interact with it
    };

    // --- Simulation Constants (Avoiding "Magic Numbers") ---
    // --- シミュレーション定数（マジックナンバーを避ける） ---

    BASE_WIND_SPEED = 1.5;      // Horizontal speed of the air
    MIN_WIND_SPEED = 0.8;       // Minimum horizontal speed to prevent accumulation
    EMISSION_RATE = 0.15;       // Probability of emitting a particle per frame per injector
    REPULSION_DISTANCE = 30;    // How far away particles start to steer
    REPULSION_FORCE = 0.6;      // Strength of the steering away from obstacles
    VORTEX_INTENSITY = 0.3;     // Strength of the oscillation behind obstacles
    VORTEX_DISTANCE = 120;      // Influence range of the wake
    VORTEX_PHASE_SPEED = 0.008; // Oscillation frequency factor
    VORTEX_SPATIAL_FREQ = 0.1;  // Wavelength factor in the wake

    DRAG_X = 0.99;              // Horizontal friction
    DRAG_Y = 0.98;              // Vertical friction

    MAX_PARTICLES = 400;        // Performance ceiling
    PARTICLE_LIFE_DECAY = 0.002; // How fast particles fade out
    OFFSCREEN_MARGIN = 50;      // Boundary for removing particles

    constructor() {
        super();
        this.particles = [];
        this.injectors = [];
        this.width = 0;
        this.height = 0;
    }

    /**
     * Initial setup and resizing.
     * @param {number} width - Viewport width
     * @param {number} height - Viewport height
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
        this.particles = [];

        // Define "Smoke Injectors" on the left edge at regular intervals.
        // 左端に「スモーク・インジェクター」を等間隔に配置します。
        const spacing = 14;
        const count = Math.floor(height / spacing);
        this.injectors = Array(count).fill(0).map((_, i) => ({
            x: -10,
            y: (i + 0.5) * (height / count)
        }));
    }

    /**
     * Create a new particle representing a "parcel" of smoke.
     * @param {number} x - Starting X
     * @param {number} y - Starting Y
     */
    createParticle(x, y) {
        return {
            x,
            y,
            vx: this.BASE_WIND_SPEED + (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.1,
            life: 1.0 + Math.random() * 0.5,
            size: 1 + Math.floor(Math.random() * 2) // Dot size 1 or 2
        };
    }

    /**
     * Main simulation and drawing loop.
     * @param {CanvasRenderingContext2D} ctx - Unused in sprite mode
     * @param {Object} params - Engine parameters
     */
    draw(ctx, { elapsedMs, exclusionAreas = [], speed = 1 } = {}) {
        const sprites = [];
        const dt = speed; // Adjust simulation speed based on engine speed

        // 1. Particle Emission
        // 粒子の放出
        if (this.particles.length < this.MAX_PARTICLES) {
            this.injectors.forEach(injector => {
                if (Math.random() < this.EMISSION_RATE) {
                    this.particles.push(this.createParticle(injector.x, injector.y));
                }
            });
        }

        // 2. Physics Update and Interaction
        // 物理更新と相互作用
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Base acceleration
            let ax = 0;
            // Slight natural swaying (ambient turbulence)
            const turbulencePhase = elapsedMs * 0.004 + p.x * 0.02;
            let ay = Math.sin(turbulencePhase) * 0.01;

            // Obstacle Interaction Logic
            // 障害物（排他領域）との相互作用ロジック
            exclusionAreas.forEach(area => {
                // Determine if particle is in the influence zone of this area
                const isNearX = p.x > area.x - this.REPULSION_DISTANCE && p.x < area.x + area.width + this.VORTEX_DISTANCE;
                const isNearY = p.y > area.y - this.REPULSION_DISTANCE && p.y < area.y + area.height + this.REPULSION_DISTANCE;

                if (isNearX && isNearY) {
                    // 1. Repulsion (Front and sides)
                    // 反発（前面と側面）
                    if (p.x < area.x + area.width) {
                        const centerY = area.y + area.height / 2;
                        const distToCenterY = p.y - centerY;

                        // Push particle towards the nearest horizontal edge (top or bottom of the area)
                        const pushDir = distToCenterY > 0 ? 1 : -1;

                        // Increase push force as it gets closer to the front/sides
                        const proximity = 1.0 - Math.min(Math.abs(distToCenterY) / (area.height / 2 + this.REPULSION_DISTANCE), 1.0);
                        ay += pushDir * this.REPULSION_FORCE * proximity;
                    }

                    // 2. Karman Vortex (Oscillation in the wake behind the obstacle)
                    // カルマン渦（障害物の背後の航跡での振動）
                    if (p.x > area.x + area.width) {
                        const distFromBack = p.x - (area.x + area.width);
                        if (distFromBack < this.VORTEX_DISTANCE) {
                            // Alternating vortex phase based on time and vertical position
                            const phase = (elapsedMs * this.VORTEX_PHASE_SPEED) + (area.y * 0.5);
                            // The oscillation dampens as it moves further away
                            const dampen = Math.max(0, 1.0 - distFromBack / this.VORTEX_DISTANCE);
                            const oscillation = Math.sin(phase - distFromBack * this.VORTEX_SPATIAL_FREQ);
                            ay += oscillation * this.VORTEX_INTENSITY * dampen;
                        }
                    }
                }
            });

            // Integrate forces (Euler integration)
            p.vx += ax * dt;
            p.vy += ay * dt;

            // Apply friction/drag to keep things stable
            p.vx *= this.DRAG_X;
            p.vy *= this.DRAG_Y;

            // Prevent stalling: ensure a minimum rightward velocity
            if (p.vx < this.MIN_WIND_SPEED) {
                p.vx = this.MIN_WIND_SPEED;
            }

            // Update position
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Life management
            p.life -= this.PARTICLE_LIFE_DECAY * dt;

            // Removal conditions
            const isOffScreen = p.x > this.width + this.OFFSCREEN_MARGIN ||
                               p.y < -this.OFFSCREEN_MARGIN ||
                               p.y > this.height + this.OFFSCREEN_MARGIN;
            if (isOffScreen || p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // Draw: Only if not physically "inside" an obstacle (masking effect)
            const isInside = exclusionAreas.some(area =>
                p.x >= area.x && p.x <= area.x + area.width &&
                p.y >= area.y && p.y <= area.y + area.height
            );

            if (!isInside) {
                sprites.push({ x: p.x, y: p.y, size: p.size });
            }
        }

        return sprites;
    }
}
