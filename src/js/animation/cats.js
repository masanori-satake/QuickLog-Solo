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
            en: "Pixel art cats playing and resting on the UI text and buttons.",
            ja: "ドット絵の猫たちがUIの文字やボタンの上で遊んだり、くつろいだりします。",
            de: "Pixel-Art-Katzen, die auf den UI-Texten und Schaltflächen spielen und ruhen.",
            es: "Gatos de arte de píxeles que juegan y descansan sobre el texto y los botones de la interfaz.",
            fr: "Des chats en pixel art qui jouent et se reposent sur le texte et les boutons de l'interface.",
            pt: "Gatos em pixel art brincando e descansando sobre o texto e os botões da interface.",
            ko: "도트 아트 고양이들이 UI 텍스트와 버튼 위에서 놀거나 휴식을 취합니다.",
            zh: "在UI文本和按钮上玩耍和休息的像素艺术猫。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', usePseudoSpace: false };

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

        const platforms = exclusionAreas.map(area => ({
            y: area.y,
            xStart: area.x,
            xEnd: area.x + area.width
        }));

        const allPlatforms = [...platforms, { y: this.groundY, xStart: 0, xEnd: width }];

        this.cats.forEach((cat) => {
            if (cat.timer > 0) cat.timer--;

            const currentPlatform = allPlatforms.find(p => Math.abs(cat.y - p.y) < 5 && cat.x >= p.xStart && cat.x <= p.xEnd);

            if (cat.state === 'walking') {
                const speed = 0.8;
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
    }
}
