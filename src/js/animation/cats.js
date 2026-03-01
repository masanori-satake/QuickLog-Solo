import { AnimationBase } from '../animations.js';

export default class Cats extends AnimationBase {
    static metadata = {
        name: { en: "Cats", ja: "猫" },
        description: { en: "Cats playing and resting on UI elements.", ja: "UI要素の上で遊んだり休んだりする猫たちです。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.cats = [
            { x: Math.random() * width, y: height, targetX: Math.random() * width, state: 'walking', timer: 0 },
            { x: Math.random() * width, y: height, targetX: Math.random() * width, state: 'jumping', timer: 0 },
            { x: Math.random() * width, y: height, targetX: Math.random() * width, state: 'sitting', timer: 100 }
        ];
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;

        this.cats.forEach((cat, i) => {
            cat.timer--;

            // Determine ground or platforms
            const groundY = height - 10;
            const platforms = exclusionAreas.map(area => ({ y: area.y - 10, xStart: area.x, xEnd: area.x + area.width }));

            // Find current platform
            let currentPlatform = null;
            if (Math.abs(cat.y - groundY) < 5) {
                currentPlatform = { y: groundY, xStart: 0, xEnd: width };
            } else {
                currentPlatform = platforms.find(p => Math.abs(cat.y - p.y) < 5 && cat.x >= p.xStart && cat.x <= p.xEnd);
            }

            if (cat.state === 'walking') {
                const speed = 0.5;
                if (cat.x < cat.targetX) cat.x += speed; else cat.x -= speed;

                if (Math.abs(cat.x - cat.targetX) < 2) {
                    cat.state = Math.random() > 0.5 ? 'sitting' : 'jumping';
                    cat.timer = 60 + Math.random() * 200;
                    cat.targetX = Math.random() * width;
                }

                // Check for edges of platform
                if (currentPlatform && (cat.x < currentPlatform.xStart || cat.x > currentPlatform.xEnd)) {
                    cat.state = 'jumping';
                    cat.timer = 0;
                }
            } else if (cat.state === 'sitting') {
                if (cat.timer <= 0) {
                    cat.state = 'walking';
                    cat.targetX = Math.random() * width;
                }
            } else if (cat.state === 'jumping') {
                // Find a platform to jump to or fall
                const targetPlatforms = [...platforms, { y: groundY, xStart: 0, xEnd: width }];
                const jumpTarget = targetPlatforms.find(p => p.y < cat.y && Math.abs(p.y - cat.y) < 50);

                if (jumpTarget) {
                    cat.y -= 2; // Move up
                    if (Math.abs(cat.y - jumpTarget.y) < 5) {
                       cat.state = 'sitting';
                       cat.timer = 100;
                    }
                } else {
                    // Fall
                    if (cat.y < groundY) cat.y += 2;
                    else {
                        cat.y = groundY;
                        cat.state = 'walking';
                    }
                }
            }

            // Draw Cat (simple representation)
            ctx.fillStyle = '#fff';
            ctx.save();
            ctx.translate(cat.x, cat.y);

            // Body
            ctx.fillRect(-5, -5, 10, 5);
            // Head
            ctx.fillRect(cat.x < cat.targetX ? 3 : -8, -8, 5, 5);
            // Ears
            ctx.fillRect(cat.x < cat.targetX ? 4 : -7, -10, 2, 2);
            ctx.fillRect(cat.x < cat.targetX ? 7 : -4, -10, 2, 2);
            // Tail
            ctx.fillRect(cat.x < cat.targetX ? -8 : 5, -6, 4, 2);

            ctx.restore();
        });
    }
}
