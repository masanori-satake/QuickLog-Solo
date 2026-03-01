import { AnimationBase } from '../animations.js';

export default class Cats extends AnimationBase {
    static metadata = {
        name: { en: "Cats", ja: "猫" },
        description: { en: "Pixel art cats playing and resting on the UI text and buttons.", ja: "ドット絵の猫たちがUIの文字やボタンの上で遊んだり、くつろいだりします。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.groundY = height - 15;
        this.cats = [
            { x: Math.random() * width, y: this.groundY, targetX: Math.random() * width, state: 'walking', timer: 0, color: '#fff', scale: 1.5 },
            { x: Math.random() * width, y: this.groundY, targetX: Math.random() * width, state: 'sitting', timer: 100, color: '#aaa', scale: 1.4 },
            { x: Math.random() * width, y: this.groundY, targetX: Math.random() * width, state: 'walking', timer: 0, color: '#ccc', scale: 1.6 }
        ];
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.groundY = height - 15;

        // Platforms based on exclusionAreas
        const platforms = exclusionAreas.map(area => ({
            y: area.y,
            xStart: area.x,
            xEnd: area.x + area.width
        }));

        // Ground platform
        const allPlatforms = [...platforms, { y: this.groundY, xStart: 0, xEnd: width }];

        this.cats.forEach((cat) => {
            if (cat.timer > 0) cat.timer--;

            // Find current platform
            const currentPlatform = allPlatforms.find(p => Math.abs(cat.y - p.y) < 5 && cat.x >= p.xStart && cat.x <= p.xEnd);

            if (cat.state === 'walking') {
                const speed = 0.8;
                if (cat.x < cat.targetX) cat.x += speed; else cat.x -= speed;

                // If reached target or edge of platform
                const atEdge = currentPlatform && (cat.x <= currentPlatform.xStart + 5 || cat.x >= currentPlatform.xEnd - 5);
                if (Math.abs(cat.x - cat.targetX) < 2 || atEdge) {
                    if (atEdge && Math.random() > 0.3) {
                        cat.state = 'jumping';
                        // Decide whether to jump up or down
                        const higher = allPlatforms.filter(p => p.y < cat.y - 10 && Math.abs(p.y - cat.y) < 60);
                        const lower = allPlatforms.filter(p => p.y > cat.y + 10 && Math.abs(p.y - cat.y) < 60);

                        if (higher.length > 0 && Math.random() > 0.5) {
                            cat.jumpTarget = higher[Math.floor(Math.random() * higher.length)];
                        } else if (lower.length > 0) {
                            cat.jumpTarget = lower[Math.floor(Math.random() * lower.length)];
                        } else {
                            cat.state = 'sitting';
                            cat.timer = 100 + Math.random() * 200;
                        }
                    } else {
                        cat.state = 'sitting';
                        cat.timer = 100 + Math.random() * 200;
                    }
                }
            } else if (cat.state === 'sitting') {
                if (cat.timer <= 0) {
                    cat.state = 'walking';
                    cat.targetX = Math.random() * width;
                }
            } else if (cat.state === 'jumping') {
                if (cat.jumpTarget) {
                    const dx = (cat.jumpTarget.xStart + cat.jumpTarget.xEnd) / 2 - cat.x;
                    const dy = cat.jumpTarget.y - cat.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist > 5) {
                        cat.x += dx / dist * 3;
                        cat.y += dy / dist * 3;
                    } else {
                        cat.y = cat.jumpTarget.y;
                        cat.state = 'sitting';
                        cat.timer = 50;
                        delete cat.jumpTarget;
                    }
                } else {
                    cat.state = 'walking'; // Failsafe
                }
            }

            // Draw Detailed Pixel Cat
            ctx.save();
            ctx.translate(cat.x, cat.y);
            ctx.scale(cat.scale, cat.scale);
            ctx.fillStyle = cat.color;

            // Mirror if walking left
            if (cat.x > cat.targetX && cat.state === 'walking') {
                ctx.scale(-1, 1);
            }

            // Body
            ctx.fillRect(-6, -6, 10, 6);
            // Head
            ctx.fillRect(2, -10, 6, 6);
            // Ears
            ctx.fillRect(3, -12, 2, 2);
            ctx.fillRect(6, -12, 2, 2);
            // Legs
            if (cat.state === 'walking') {
                const legOffset = Math.sin(Date.now() / 100) * 2;
                ctx.fillRect(-5, 0, 2, 2 + legOffset);
                ctx.fillRect(2, 0, 2, 2 - legOffset);
            } else {
                ctx.fillRect(-5, 0, 2, 2);
                ctx.fillRect(2, 0, 2, 2);
            }
            // Tail
            const tailAngle = Math.sin(Date.now() / 300) * 0.5;
            ctx.save();
            ctx.translate(-6, -4);
            ctx.rotate(tailAngle);
            ctx.fillRect(-4, 0, 4, 2);
            ctx.restore();

            // Eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(6, -8, 1, 1);

            ctx.restore();
        });
    }
}
