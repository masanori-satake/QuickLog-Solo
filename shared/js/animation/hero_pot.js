import { AnimationBase } from '../animation_base.js';

/**
 * HeroPot Animation
 * An RPG hero lifts pots and throws them to break them, avoiding UI elements.
 * RPGの勇者が壺を持ち上げて、UIを避けながら投げ壊します。
 */
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
            ko: "RPG 용사가 항아리를 들어 올려 UI 요소를 피하면서 던져서 깨뜨립니다。",
            zh: "一位RPG英雄举起壶并扔向它们以打破它们，同时避开UI元素。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.hero = { shards: [] };
        this.pots = [];
    }

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
        this.groundY = height - 20;

        // Initialize hero state
        // 勇者の状態を初期化
        this.hero = {
            x: 20,
            y: this.groundY,
            targetX: 0,
            targetY: 0,
            state: 'walking',
            potX: 0,
            potY: 0,
            shards: []
        };

        // Initialize with one pot
        // 最初に壺を1つ用意しておく
        this.pots = [{ x: width / 2, y: this.groundY, state: 'idle' }];
    }

    /**
     * Interaction: User places a pot by clicking on the ground
     * インタラクション：地面をクリックして壺を置く
     */
    onClick(x, y) {
        if (Math.abs(y - this.groundY) < 20) {
            this.pots.push({ x, y: this.groundY, state: 'idle' });
        }
    }

    /**
     * Main drawing and logic loop
     * 描画およびロジックループ
     */
    draw(ctx, { exclusionAreas = [] } = {}) {
        const width = this.width;
        const height = this.height;
        const groundY = this.groundY;

        // 1. Spawn new pots occasionally
        // 1. 時々新しい壺を出現させる
        if (this.pots.length < 3 && Math.random() < 0.05) {
            let rx = 20 + Math.random() * (width - 40);
            let ry = groundY;

            // Check if spawn location overlaps with UI text
            // 出現場所がUIテキストと重なっていないか確認
            const isOverlap = exclusionAreas.some(area => {
                return rx > area.x + 10 && rx < area.x + area.width - 10 &&
                       ry > area.y + 5 && ry < area.y + area.height - 5;
            });

            if (!isOverlap && !this.pots.some(p => Math.abs(p.x - rx) < 20)) {
                this.pots.push({ x: rx, y: ry, state: 'idle' });
            }
        }

        // 2. Hero Logic (State Machine)
        // 2. 勇者のロジック（状態遷移）
        if (this.hero.state === 'walking') {
            // Find an idle pot to pick up
            // 落ちている壺を探す
            const targetPot = this.pots.find(p => p.state === 'idle');
            if (targetPot) {
                const speed = 2.0;
                // Move towards pot / 壺に向かって移動
                if (Math.abs(this.hero.x - targetPot.x) > speed) {
                    this.hero.x += (this.hero.x < targetPot.x ? speed : -speed);
                } else if (Math.abs(this.hero.y - targetPot.y) > speed) {
                    this.hero.y += (this.hero.y < targetPot.y ? speed : -speed);
                } else {
                    // Start lifting / 持ち上げ開始
                    this.hero.state = 'lifting';
                    targetPot.state = 'held';
                    this.hero.timer = 30;
                }
            } else {
                // Return to center if no pots / 壺がない場合は中央に戻る
                const tx = width / 2;
                const ty = groundY;
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
                // Find a target to throw the pot towards (avoiding UI)
                // 壺を投げる目標地点を探す（UIを避ける）
                this.hero.state = 'walking_with_pot';
                this.hero.targetX = this.findSafeThrowTarget(width, height, exclusionAreas).x;
                this.hero.targetY = this.findSafeThrowTarget(width, height, exclusionAreas).y;
            }
        } else if (this.hero.state === 'walking_with_pot') {
            // Move to throw target / 投げる場所まで移動
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
                // Break the pot / 壺を割る
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

        // 3. Drawing
        // 3. 描画
        ctx.fillStyle = '#fff';

        // Draw shards
        // 破片の描画
        this.hero.shards.forEach(s => {
            s.x += s.vx; s.y += s.vy; s.vy += 0.2; s.life--;
            ctx.fillRect(s.x, s.y, 2, 2);
        });
        this.hero.shards = this.hero.shards.filter(s => s.life > 0);

        // Draw pots
        // 壺の描画
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

        // Draw Hero
        // 勇者の描画
        this.drawHero(ctx, this.hero.x, this.hero.y);
    }

    /**
     * Find a safe coordinate for throwing that doesn't overlap UI
     * UIと重ならない安全な投下座標を探す
     */
    findSafeThrowTarget(width, height, exclusionAreas) {
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
        return { x: tx, y: ty };
    }

    /**
     * Helper to draw the hero character
     * 勇者の描画ヘルパー
     */
    drawHero(ctx, hx, hy) {
        ctx.fillRect(hx - 2, hy - 15, 4, 15); // Body
        ctx.fillRect(hx - 4, hy - 18, 8, 4);  // Head

        // Arms based on state / 状態に合わせた腕の位置
        if (this.hero.state === 'lifting' || this.hero.state === 'walking_with_pot' || this.hero.state === 'throwing') {
            ctx.fillRect(hx - 6, hy - 15, 2, 8); // Hands up
            ctx.fillRect(hx + 4, hy - 15, 2, 8);
        } else {
            ctx.fillRect(hx - 6, hy - 10, 2, 8); // Hands down
            ctx.fillRect(hx + 4, hy - 10, 2, 8);
        }
    }
}
