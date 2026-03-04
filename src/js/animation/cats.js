import { AnimationBase } from '../animation_base.js';

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

    config = { mode: 'canvas', usePseudoSpace: true };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.groundY = height - 15;
        this.cats = [
            { x: Math.random() * width, y: this.groundY, targetX: Math.random() * width, state: 'walking', timer: 0, color: '#fff', scale: 1.5, interested: true },
            { x: Math.random() * width, y: this.groundY, targetX: Math.random() * width, state: 'sitting', timer: 100, color: '#aaa', scale: 1.4, interested: false },
            { x: Math.random() * width, y: this.groundY, targetX: Math.random() * width, state: 'walking', timer: 0, color: '#ccc', scale: 1.6, interested: true }
        ];
        this.foods = [];
        this.lastPlatforms = [];
    }

    onClick(x, y) {
        if (this.lastPlatforms.length === 0) {
            this.foods.push({ x, y, life: 300 });
            return;
        }

        // Snap food to the nearest platform
        const nearestP = this.lastPlatforms.reduce((closest, current) => {
            const dCurrent = Math.abs(y - current.y);
            const dClosest = Math.abs(y - closest.y);
            return dCurrent < dClosest ? current : closest;
        });

        const snappedX = Math.max(nearestP.xStart + 5, Math.min(nearestP.xEnd - 5, x));
        this.foods.push({ x: snappedX, y: nearestP.y, life: 300 });
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.groundY = height - 15;

        // Draw food
        this.foods = this.foods.filter(f => f.life > 0);

        const platforms = exclusionAreas.map(area => ({
            y: area.y,
            xStart: area.x,
            xEnd: area.x + area.width
        }));

        const allPlatforms = [...platforms, { y: this.groundY, xStart: 0, xEnd: width }];
        this.lastPlatforms = allPlatforms;

        this.cats.forEach((cat) => {
            if (cat.timer > 0) cat.timer--;

            const currentPlatform = allPlatforms.find(p => Math.abs(cat.y - p.y) < 5 && cat.x >= p.xStart && cat.x <= p.xEnd);

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

            if (cat.state === 'walking') {
                const speed = (cat.state === 'walking' && cat.interested && this.foods.length > 0) ? 1.2 : 0.8;
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
                    // Move away after eating
                    cat.targetX = Math.random() * width;
                }
            }

            ctx.save();
            ctx.translate(cat.x, cat.y);
            ctx.scale(cat.scale, cat.scale);
            ctx.fillStyle = cat.color;

            if (cat.x > cat.targetX && cat.state === 'walking') {
                ctx.scale(-1, 1);
            }

            ctx.fillRect(-6, -6, 10, 6);
            ctx.fillRect(2, -10, 6, 6);
            ctx.fillRect(3, -12, 2, 2);
            ctx.fillRect(6, -12, 2, 2);
            if (cat.state === 'walking') {
                const legOffset = Math.sin(Date.now() / 100) * 2;
                ctx.fillRect(-5, 0, 2, 2 + legOffset);
                ctx.fillRect(2, 0, 2, 2 - legOffset);
            } else {
                ctx.fillRect(-5, 0, 2, 2);
                ctx.fillRect(2, 0, 2, 2);
            }
            const tailAngle = Math.sin(Date.now() / 300) * 0.5;
            ctx.save();
            ctx.translate(-6, -4);
            ctx.rotate(tailAngle);
            ctx.fillRect(-4, 0, 4, 2);
            ctx.restore();
            ctx.fillStyle = '#000';
            ctx.fillRect(6, -8, 1, 1);
            ctx.restore();
        });

        // Draw food
        this.foods.forEach(f => {
            ctx.fillStyle = '#ffa';
            ctx.fillRect(f.x - 2, f.y - 2, 4, 2);
            ctx.fillRect(f.x - 1, f.y - 4, 2, 2);
        });
    }
}
