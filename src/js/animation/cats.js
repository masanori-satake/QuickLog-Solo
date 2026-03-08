import { AnimationBase } from '../animation_base.js';

/**
 * Cats Animation
 * Pixel art cats walking around and eating food.
 * 猫たちが歩き回ったり、餌を食べたりするピクセルアート・アニメーションです。
 */
export default class Cats extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Cats",
            ja: "猫",
            de: "Katzen",
            es: "Gatos",
            fr: "Chats",
            pt: "Gatos",
            ko: "고양이",
            zh: "猫"
        },
        description: {
            en: "Pixel art cats walking around and eating food.",
            ja: "猫たちが歩き回ったり、餌を食べたりします。",
            de: "Pixel-Art-Katzen, die herumspazieren und Futter fressen.",
            es: "Gatos de arte de píxeles caminando y comiendo comida.",
            fr: "Des chats en pixel art qui se promènent et mangent de la nourriture.",
            pt: "Gatos de arte pixelada andando e comendo comida.",
            ko: "도트 아트 고양이들이 돌아다니며 먹이를 먹습니다.",
            zh: "像素艺术猫在到处走动并吃食物。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', exclusionStrategy: 'pseudo' };

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        // The Y coordinate where cats stand
        // 猫が立つ地面の高さ
        this.groundY = height - 15;

        // Initialize cat instances
        // 猫のインスタンスを初期化
        this.cats = [
            { x: Math.random() * width, y: this.groundY, targetX: Math.random() * width, state: 'walking', timer: 0, color: '#fff', scale: 1.5, interested: true },
            { x: Math.random() * width, y: this.groundY, targetX: Math.random() * width, state: 'sitting', timer: 100, color: '#aaa', scale: 1.4, interested: false },
            { x: Math.random() * width, y: this.groundY, targetX: Math.random() * width, state: 'walking', timer: 0, color: '#ccc', scale: 1.6, interested: true }
        ];
        this.foods = [];
        this.lastPlatforms = [];
    }

    /**
     * Interaction: User places food by clicking
     * インタラクション：クリックで餌を置く
     */
    onClick(x, y) {
        // If no UI text "platforms" exist, just drop on ground level
        // UIテキストの「足場」がない場合は、そのままの高さで置く
        if (this.lastPlatforms.length === 0) {
            this.foods.push({ x, y, life: 300 });
            return;
        }

        // Snap food to the nearest platform (UI text or ground)
        // 最も近い足場（テキスト領域または地面）に吸着させる
        const nearestP = this.lastPlatforms.reduce((closest, current) => {
            const dCurrent = Math.abs(y - current.y);
            const dClosest = Math.abs(y - closest.y);
            return dCurrent < dClosest ? current : closest;
        });

        const snappedX = Math.max(nearestP.xStart + 5, Math.min(nearestP.xEnd - 5, x));
        this.foods.push({ x: snappedX, y: nearestP.y, life: 300 });
    }

    /**
     * Main drawing and update loop
     * 描画および更新ループ
     */
    draw(ctx, { elapsedMs = 0, exclusionAreas = [] } = {}) {
        const width = this.width;

        // 1. Update Food state
        // 1. 餌の状態更新
        this.foods = this.foods.filter(f => f.life > 0);

        // 2. Define platforms (Top of UI text boxes + ground)
        // 2. 足場の定義（テキスト領域の上端 + 地面）
        const platforms = exclusionAreas.map(area => ({
            y: area.y,
            xStart: area.x,
            xEnd: area.x + area.width
        }));

        const allPlatforms = [...platforms, { y: this.groundY, xStart: 0, xEnd: width }];
        this.lastPlatforms = allPlatforms;

        // 3. Update and Draw Cats
        // 3. 猫の更新と描画
        this.cats.forEach((cat) => {
            if (cat.timer > 0) cat.timer--;

            // Find current platform the cat is on
            // 現在乗っている足場を確認
            const currentPlatform = allPlatforms.find(p => Math.abs(cat.y - p.y) < 5 && cat.x >= p.xStart && cat.x <= p.xEnd);

            // Food detection logic
            // 餌の検知ロジック
            if (cat.interested && this.foods.length > 0 && cat.state !== 'eating') {
                const food = this.foods[0];
                if (Math.abs(cat.y - food.y) < 20) {
                    cat.targetX = food.x;
                    cat.state = 'walking';
                    if (Math.abs(cat.x - food.x) < 10) {
                        cat.state = 'eating';
                        cat.timer = 100;
                    }
                }
            }

            // State management: walking, sitting, eating
            // 状態管理：歩く、座る、食べる
            if (cat.state === 'walking') {
                const speed = (cat.interested && this.foods.length > 0) ? 1.2 : 0.8;
                if (cat.x < cat.targetX) cat.x += speed; else cat.x -= speed;

                const atEdge = currentPlatform && (cat.x <= currentPlatform.xStart + 5 || cat.x >= currentPlatform.xEnd - 5);
                if (Math.abs(cat.x - cat.targetX) < 2 || atEdge) {
                    cat.state = 'sitting';
                    cat.timer = 100 + Math.random() * 200;
                }
            } else if (cat.state === 'sitting') {
                if (cat.timer <= 0) {
                    const nextPlatform = allPlatforms[Math.floor(Math.random() * allPlatforms.length)];
                    cat.targetX = nextPlatform.xStart + Math.random() * (nextPlatform.xEnd - nextPlatform.xStart);
                    cat.y = nextPlatform.y;
                    cat.state = 'walking';
                }
            } else if (cat.state === 'eating') {
                if (cat.timer <= 0) {
                    if (this.foods.length > 0) this.foods[0].life -= 50;
                    cat.state = 'sitting';
                    cat.timer = 60;
                    cat.targetX = Math.random() * width; // Move away after eating
                }
            }

            // Draw the cat (Pixel art style)
            // 猫の描画（ドット絵スタイル）
            this.drawCat(ctx, cat, elapsedMs);
        });

        // 4. Draw Food
        // 4. 餌の描画
        this.foods.forEach(f => {
            ctx.fillStyle = '#ffa';
            ctx.fillRect(f.x - 2, f.y - 2, 4, 2);
            ctx.fillRect(f.x - 1, f.y - 4, 2, 2);
        });
    }

    /**
     * Helper to draw a pixel art cat
     * 猫の描画ヘルパー関数
     */
    drawCat(ctx, cat, elapsedMs) {
        ctx.save();
        ctx.translate(cat.x, cat.y);
        ctx.scale(cat.scale, cat.scale);
        ctx.fillStyle = cat.color;

        // Flip horizontally based on movement direction
        // 移動方向に基づいて左右反転
        if (cat.x > cat.targetX && cat.state === 'walking') {
            ctx.scale(-1, 1);
        }

        // Body, Head, Ears
        ctx.fillRect(-6, -6, 10, 6); // Body
        ctx.fillRect(2, -10, 6, 6);  // Head
        ctx.fillRect(3, -12, 2, 2);  // Ear L
        ctx.fillRect(6, -12, 2, 2);  // Ear R

        // Legs (Walking animation)
        if (cat.state === 'walking') {
            const legOffset = Math.sin(elapsedMs / 100) * 2;
            ctx.fillRect(-5, 0, 2, 2 + legOffset);
            ctx.fillRect(2, 0, 2, 2 - legOffset);
        } else {
            ctx.fillRect(-5, 0, 2, 2);
            ctx.fillRect(2, 0, 2, 2);
        }

        // Tail
        const tailAngle = Math.sin(elapsedMs / 300) * 0.5;
        ctx.save();
        ctx.translate(-6, -4);
        ctx.rotate(tailAngle);
        ctx.fillRect(-4, 0, 4, 2);
        ctx.restore();

        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(6, -8, 1, 1);

        ctx.restore();
    }
}
