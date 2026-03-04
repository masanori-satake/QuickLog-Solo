import { AnimationBase } from '../animation_base.js';

export default class HeroPot extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Hero Pot",
            ja: "勇者と壺",
            de: "Helden-Topf",
            es: "Héroe y vasija",
            fr: "Le héros et le pot",
            pt: "Herói e o vaso",
            ko: "용사와 항아리",
            zh: "勇者与壶"
        },
        description: {
            en: "An RPG hero lifts pots and throws them to break them, avoiding UI elements.",
            ja: "RPGの勇者が壺を持ち上げて、UIを避けながら投げ壊します。",
            de: "Ein RPG-Held hebt Töpfe hoch und wirft sie, um sie zu zerbrechen, wobei er UI-Elemente vermeidet.",
            es: "Un héroe de RPG levanta vasijas y las lanza para romperlas, evitando los elementos de la interfaz.",
            fr: "Un héros de RPG soulève des pots et les lance pour les briser, en évitant les éléments de l'interface.",
            pt: "Um herói de RPG levanta vasos e os joga para quebrá-los, evitando os elementos da interface.",
            ko: "RPG 용사가 항아리를 들어 올려 UI 요소를 피하면서 던져서 깨뜨립니다.",
            zh: "一位RPG英雄举起壶并扔向它们以打破它们，同时避开UI元素。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', usePseudoSpace: false };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.hero = { x: 20, y: height - 20, targetX: 0, targetY: 0, state: 'walking', potX: 0, potY: 0, shards: [] };
        // Pre-populate with one pot to ensure immediate target for evaluation
        this.pots = [{ x: width / 2, y: height - 20, state: 'idle' }];
        this.groundY = height - 20;
    }

    onClick(x, y) {
        // If clicking on ground, place a pot there
        if (Math.abs(y - this.groundY) < 20) {
            this.pots.push({ x, y: this.groundY, state: 'idle' });
        }
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.groundY = height - 20;

        if (this.pots.length < 3 && Math.random() < 0.05) {
            let rx = 20 + Math.random() * (width - 40);
            let ry = this.groundY;

            // Reduce strictness of overlap check for pots to ensure they keep spawning
            const isOverlap = exclusionAreas.some(area => {
                return rx > area.x + 10 && rx < area.x + area.width - 10 &&
                       ry > area.y + 5 && ry < area.y + area.height - 5;
            });

            if (!isOverlap && !this.pots.some(p => Math.abs(p.x - rx) < 20)) {
                this.pots.push({ x: rx, y: ry, state: 'idle' });
            }
        }

        if (this.hero.state === 'walking') {
            const targetPot = this.pots.find(p => p.state === 'idle');
            if (targetPot) {
                const speed = 2.0;

                // Move X first, then Y (no diagonal)
                if (Math.abs(this.hero.x - targetPot.x) > speed) {
                    this.hero.x += (this.hero.x < targetPot.x ? speed : -speed);
                } else if (Math.abs(this.hero.y - targetPot.y) > speed) {
                    this.hero.y += (this.hero.y < targetPot.y ? speed : -speed);
                } else {
                    // Close enough to lift
                    this.hero.state = 'lifting';
                    targetPot.state = 'held';
                    this.hero.timer = 30;
                }
            } else {
                const tx = width / 2;
                const ty = this.groundY;
                const speed = 1.0;
                if (Math.abs(this.hero.x - tx) > speed) {
                    this.hero.x += (this.hero.x < tx ? speed : -speed);
                } else if (Math.abs(this.hero.y - ty) > speed) {
                    this.hero.y += (this.hero.y < ty ? speed : -speed);
                }
            }
        } else if (this.hero.state === 'lifting') {
            this.hero.timer--;
            if (this.hero.timer <= 0) {
                this.hero.state = 'walking_with_pot';

                const minX = 15, maxX = width - 15;
                const minY = 25, maxY = height - 5;

                let tx = minX + Math.random() * (maxX - minX);
                let ty = minY + Math.random() * (maxY - minY);
                let attempts = 0;
                while (attempts < 20) {
                    const candidateX = minX + Math.random() * (maxX - minX);
                    const candidateY = minY + Math.random() * (maxY - minY);
                    const overlap = exclusionAreas.some(area => {
                        return candidateX > area.x - 20 && candidateX < area.x + area.width + 20 &&
                               candidateY > area.y - 20 && candidateY < area.y + area.height + 20;
                    });
                    if (!overlap) {
                        tx = candidateX;
                        ty = candidateY;
                        break;
                    }
                    attempts++;
                }
                this.hero.targetX = tx;
                this.hero.targetY = ty;
            }
        } else if (this.hero.state === 'walking_with_pot') {
            const speed = 1.5;
            if (Math.abs(this.hero.x - this.hero.targetX) > speed) {
                this.hero.x += (this.hero.x < this.hero.targetX ? speed : -speed);
            } else if (Math.abs(this.hero.y - this.hero.targetY) > speed) {
                this.hero.y += (this.hero.y < this.hero.targetY ? speed : -speed);
            }

            if (Math.abs(this.hero.x - this.hero.targetX) <= speed && Math.abs(this.hero.y - this.hero.targetY) <= speed) {
                this.hero.state = 'throwing';
                this.hero.timer = 10;
            }
        } else if (this.hero.state === 'throwing') {
            this.hero.timer--;
            if (this.hero.timer <= 0) {
                const pot = this.pots.find(p => p.state === 'held');
                if (pot) {
                    pot.state = 'broken';
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

        ctx.fillStyle = '#fff';
        this.hero.shards.forEach(s => {
            s.x += s.vx; s.y += s.vy; s.vy += 0.2; s.life--;
            ctx.fillRect(s.x, s.y, 2, 2);
        });
        this.hero.shards = this.hero.shards.filter(s => s.life > 0);

        this.pots.forEach(p => {
            if (p.state === 'idle') {
                ctx.fillRect(p.x - 5, p.y - 10, 10, 10);
            } else if (p.state === 'held') {
                p.x = this.hero.x;
                p.y = this.hero.y - 15;
                ctx.fillRect(p.x - 5, p.y - 10, 10, 10);
            }
        });

        // Ensure Hero is within bounds
        this.hero.x = Math.max(10, Math.min(width - 10, this.hero.x));
        this.hero.y = Math.max(20, Math.min(height, this.hero.y));

        const hx = this.hero.x;
        const hy = this.hero.y;
        ctx.fillRect(hx - 2, hy - 15, 4, 15);
        ctx.fillRect(hx - 4, hy - 18, 8, 4);
        if (this.hero.state === 'lifting' || this.hero.state === 'walking_with_pot' || this.hero.state === 'throwing') {
            ctx.fillRect(hx - 6, hy - 15, 2, 8);
            ctx.fillRect(hx + 4, hy - 15, 2, 8);
        } else {
            ctx.fillRect(hx - 6, hy - 10, 2, 8);
            ctx.fillRect(hx + 4, hy - 10, 2, 8);
        }
    }
}
