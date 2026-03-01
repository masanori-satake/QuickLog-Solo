import { AnimationBase } from '../animations.js';

export default class HeroPot extends AnimationBase {
    static metadata = {
        name: { en: "Hero Pot", ja: "勇者と壺" },
        description: { en: "RPG hero lifting and breaking pots against UI elements.", ja: "RPGの勇者が壺を持ち上げて、UI要素にぶつけて壊します。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.hero = { x: 20, y: height - 20, targetX: 0, targetY: 0, state: 'walking', potX: 0, potY: 0, shards: [] };
        this.pots = [];
        this.groundY = height - 20;
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.groundY = height - 20;

        // Pot placement (avoiding exclusionAreas)
        if (this.pots.length < 3 && Math.random() < 0.05) {
            let rx = 20 + Math.random() * (width - 40);
            let ry = this.groundY;

            // Randomly pick a platform from exclusionAreas or ground
            const platforms = [{ x: 0, y: this.groundY, width: width, height: 20 }, ...exclusionAreas];
            const platform = platforms[Math.floor(Math.random() * platforms.length)];
            rx = platform.x + Math.random() * platform.width;
            ry = platform.y - 10;

            // Check if another pot is nearby
            if (!this.pots.some(p => Math.abs(p.x - rx) < 20 && Math.abs(p.y - ry) < 20)) {
                this.pots.push({ x: rx, y: ry, state: 'idle' });
            }
        }

        // Hero state logic
        if (this.hero.state === 'walking') {
            if (this.pots.length > 0) {
                const targetPot = this.pots[0];
                if (this.hero.x < targetPot.x) this.hero.x += 1;
                else this.hero.x -= 1;
                if (this.hero.y < targetPot.y) this.hero.y += 1;
                else this.hero.y -= 1;

                if (Math.abs(this.hero.x - targetPot.x) < 5 && Math.abs(this.hero.y - targetPot.y) < 5) {
                    this.hero.state = 'lifting';
                    targetPot.state = 'held';
                    this.hero.timer = 30;
                }
            } else {
               this.hero.x += (width/2 - this.hero.x) * 0.02;
               this.hero.y += (this.groundY - this.hero.y) * 0.02;
            }
        } else if (this.hero.state === 'lifting') {
            this.hero.timer--;
            if (this.hero.timer <= 0) {
                this.hero.state = 'walking_with_pot';
                this.hero.targetX = Math.random() * width;
                this.hero.targetY = this.groundY;
                // Target an exclusionArea to break against
                if (exclusionAreas.length > 0) {
                    const area = exclusionAreas[Math.floor(Math.random() * exclusionAreas.length)];
                    this.hero.targetX = area.x + area.width / 2;
                    this.hero.targetY = area.y + area.height / 2;
                }
            }
        } else if (this.hero.state === 'walking_with_pot') {
            const dx = this.hero.targetX - this.hero.x;
            const dy = this.hero.targetY - this.hero.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist > 5) {
                this.hero.x += dx / dist * 1.5;
                this.hero.y += dy / dist * 1.5;
            } else {
                this.hero.state = 'throwing';
                this.hero.timer = 10;
            }
        } else if (this.hero.state === 'throwing') {
            this.hero.timer--;
            if (this.hero.timer <= 0) {
                const pot = this.pots.find(p => p.state === 'held');
                if (pot) {
                    pot.state = 'broken';
                    // Create shards
                    for (let i = 0; i < 6; i++) {
                        this.hero.shards.push({
                            x: pot.x, y: pot.y,
                            vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4,
                            life: 60
                        });
                    }
                    this.pots = this.pots.filter(p => p.state !== 'broken');
                }
                this.hero.state = 'walking';
            }
        }

        // Draw Shards
        ctx.fillStyle = '#fff';
        this.hero.shards.forEach(s => {
            s.x += s.vx; s.y += s.vy; s.vy += 0.2; s.life--;
            ctx.fillRect(s.x, s.y, 2, 2);
        });
        this.hero.shards = this.hero.shards.filter(s => s.life > 0);

        // Draw Pots
        this.pots.forEach(p => {
            if (p.state === 'idle') {
                ctx.fillRect(p.x - 5, p.y - 10, 10, 10);
            } else if (p.state === 'held') {
                p.x = this.hero.x;
                p.y = this.hero.y - 15;
                ctx.fillRect(p.x - 5, p.y - 10, 10, 10);
            }
        });

        // Draw Hero (simple stickman)
        ctx.fillStyle = '#fff';
        const hx = this.hero.x;
        const hy = this.hero.y;
        ctx.fillRect(hx - 2, hy - 15, 4, 15); // Body
        ctx.fillRect(hx - 4, hy - 18, 8, 4); // Head
        // Arms
        if (this.hero.state === 'lifting' || this.hero.state === 'walking_with_pot' || this.hero.state === 'throwing') {
            ctx.fillRect(hx - 6, hy - 15, 2, 8);
            ctx.fillRect(hx + 4, hy - 15, 2, 8);
        } else {
            ctx.fillRect(hx - 6, hy - 10, 2, 8);
            ctx.fillRect(hx + 4, hy - 10, 2, 8);
        }
    }
}
