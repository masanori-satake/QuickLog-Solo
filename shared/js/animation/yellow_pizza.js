import { AnimationBase } from '../animation_base.js';

/**
 * Yellow Pizza-Shape Dot Eater
 * A classic 80s arcade style character eating dots horizontally.
 * 黄色いパックマン風のキャラクターが、ドットを食べながら無限に右へ進み続けます。
 */
export default class YellowPizza extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Yellow Pizza-Shape Dot Eater",
            ja: "ドットイーター",
            de: "Gelber Pizzafresser",
            es: "Devorador de puntos amarillo",
            fr: "Mangeur de points jaune",
            pt: "Comedor de pontos amarelo",
            ko: "노란 피자 도트 이터",
            zh: "黄色比萨点吞噬者"
        },
        description: {
            en: "A bright yellow circular object continuously moves from left to right eating small white dots.",
            ja: "黄色い円形キャラクターが、白いドットを食べながら無限に左から右へ進み続けます。",
            de: "Ein leuchtend gelbes kreisförmiges Objekt bewegt sich kontinuierlich von links nach rechts und frisst kleine weiße Punkte.",
            es: "Un objeto circular amarillo brillante se mueve continuamente de izquierda a derecha comiendo pequeños puntos blancos.",
            fr: "Un objet circulaire jaune vif se déplace continuellement de gauche à droite en mangeant de petits points blancs.",
            pt: "Um objeto circular amarelo brilhante move-se continuamente da esquerda para a direita comendo pequenos pontos brancos.",
            ko: "밝은 노란색 원형 오브젝트가 왼쪽에서 오른쪽으로 끊임없이 이동하며 하얀 도트를 먹습니다.",
            zh: "一个明亮的黄色圆形物体不断从左向右移动，吞噬白色小点。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        this.x = 0;
        this.dots = [];
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.x = 0;

        // Initialize dots ahead
        this.dots = [];
        const spacing = 40;
        for (let dX = spacing; dX < width; dX += spacing) {
            this.dots.push({ x: dX });
        }
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;
        const centerY = height / 2;

        // Move character speed: ~ 2 pixels per frame @ 60fps (~120 pixels/sec)
        // Using elapsedMs for stable rate
        const speed = 0.12; // pixels/ms
        this.x = (elapsedMs * speed) % (width + 60) - 30;

        // Handle mouth opening/closing state every 200ms
        const mouthOpen = (Math.floor(elapsedMs / 200) % 2) === 0;

        ctx.fillStyle = '#fff';
        // Draw dots that aren't eaten (stateless check: character's position is to the left of the dot)
        this.dots.forEach(dot => {
            const eaten = this.x > dot.x - 5;
            if (!eaten) {
                ctx.fillRect(dot.x - 2, centerY - 2, 4, 4);
            }
        });

        // Draw Dot Eater
        ctx.save();
        ctx.translate(this.x, centerY);

        ctx.fillStyle = '#ffd600'; // Arcade classic yellow
        const radius = Math.max(10, Math.min(24, height * 0.25));

        if (mouthOpen) {
            // Draw circle with a 45-degree wedge facing right
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, 0.25 * Math.PI, 1.75 * Math.PI);
            ctx.closePath();
            ctx.fill();
        } else {
            // Closed mouth (almost full circle)
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, 0.05 * Math.PI, 1.95 * Math.PI);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}
