import { AnimationBase } from '../animation_base.js';

/**
 * Snoring Zzz... Animation
 * Manga/Anime style snoring "Zzz..." text floating diagonally upward.
 * アニメ・漫画でおなじみの「Zzz...」とスヤスヤ泡・キラリドットが斜め上へ浮遊する待機用アニメーション。
 */
export default class SnoringZzz extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Snoring Zzz...",
            ja: "Zzz...",
            de: "Schnarchen Zzz...",
            es: "Roncando Zzz...",
            fr: "Ronflement Zzz...",
            pt: "Roncando Zzz...",
            ko: "코골이 Zzz...",
            zh: "打呼噜 Zzz..."
        },
        description: {
            en: "Manga-style floating 'Z', 'z', and '.' symbols with gentle swaying motion for standby state.",
            ja: "待機状態中に、漫画でおなじみの「Z」「z」「.」やスヤスヤ泡がゆらゆらと斜め上に浮遊するアニメーションです。",
            de: "Manga-artige schwebende 'Z'-, 'z'- und '.'-Symbole mit sanfter Wiegebewegung für den Standby-Zustand.",
            es: "Símbolos 'Z', 'z' y '.' de estilo manga flotando suavemente para el estado de reposo.",
            fr: "Symboles 'Z', 'z' et '.' flottants de style manga avec un mouvement de balancement doux pour l'état de veille.",
            pt: "Símbolos 'Z', 'z' e '.' no estilo mangá flutuando suavemente para o estado de espera.",
            ko: "대기 상태 동안 만화 스타일의 'Z', 'z', '.' 및 거품 기호가 대각선 위로 수줍게 떠오릅니다.",
            zh: "漫画风格的 'Z'、'z' 和 '.' 符号在待机状态下缓缓斜向上方飘动。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'sprite', exclusionStrategy: 'jump' };

    // Pixel patterns (1 cell = 1 dot)
    // Single-line width pixels so lines don't merge or overlap into solid blocks
    static PATTERNS = {
        'Z': [
            [1, 1, 1, 1, 1],
            [0, 0, 0, 1, 0],
            [0, 0, 1, 0, 0],
            [0, 1, 0, 0, 0],
            [1, 1, 1, 1, 1]
        ],
        'z': [
            [1, 1, 1],
            [0, 1, 0],
            [1, 1, 1]
        ],
        '.': [
            [1]
        ],
        'bubble': [
            [0, 1, 1, 0],
            [1, 0, 0, 1],
            [1, 0, 0, 1],
            [0, 1, 1, 0]
        ],
        'star': [
            [0, 1, 0],
            [1, 1, 1],
            [0, 1, 0]
        ]
    };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        this.elements = [];
        this.lastSpawnTime = 0;
        this.lastElapsedMs = null;
        this.nextSpawnInterval = 1000;
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.elements = [];
        this.lastSpawnTime = 0;
        this.lastElapsedMs = null;

        // Seed initial floating elements on both left and right sides
        this.spawnInitialElements();
    }

    spawnInitialElements() {
        if (!this.width || !this.height) return;

        // Populate a few initial elements at various heights
        for (let i = 0; i < 4; i++) {
            const side = i % 2 === 0 ? 'left' : 'right';
            const progress = (i + 1) * 0.2;
            const element = this.createRandomElement(side);
            element.y = this.height * (1.0 - progress);
            element.x += element.speedX * (this.height * progress / element.speedY);
            this.elements.push(element);
        }
    }

    createRandomElement(forcedSide) {
        const side = forcedSide || (Math.random() < 0.5 ? 'left' : 'right');

        // Split canvas into left half and right half, keeping middle clear
        const margin = 10;
        const halfWidth = this.width / 2;
        const safeCenterMargin = Math.max(25, this.width * 0.15);

        let minX, maxX;
        let speedX;

        if (side === 'left') {
            minX = margin;
            maxX = Math.max(margin + 5, halfWidth - safeCenterMargin);
            speedX = -0.3 + Math.random() * 0.5;
        } else {
            minX = Math.min(this.width - margin - 5, halfWidth + safeCenterMargin);
            maxX = Math.max(minX + 5, this.width - margin);
            speedX = -0.2 + Math.random() * 0.5;
        }

        const typeRoll = Math.random();
        let type;
        if (typeRoll < 0.40) {
            type = 'Z';
        } else if (typeRoll < 0.75) {
            type = 'z';
        } else if (typeRoll < 0.88) {
            type = '.';
        } else if (typeRoll < 0.95) {
            type = 'bubble';
        } else {
            type = 'star';
        }

        const x = minX + Math.random() * Math.max(1, (maxX - minX));
        const y = this.height + 10;

        return {
            x,
            y,
            side,
            minX: Math.max(5, side === 'left' ? 5 : halfWidth + safeCenterMargin / 2),
            maxX: Math.min(this.width - 5, side === 'left' ? halfWidth - safeCenterMargin / 2 : this.width - 5),
            type,
            speedY: 0.35 + Math.random() * 0.45,
            speedX,
            swayAmplitude: 4 + Math.random() * 12,
            swayFrequency: 0.002 + Math.random() * 0.003,
            swayPhase: Math.random() * Math.PI * 2,
            scale: type === 'Z' ? (0.9 + Math.random() * 0.4) : (0.8 + Math.random() * 0.3),
            rotation: (Math.random() - 0.5) * 0.4, // Tilt in radians (-11 deg to +11 deg)
            spawnTime: 0
        };
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const sprites = [];
        const width = this.width;
        const height = this.height;

        if (width <= 0 || height <= 0) return sprites;

        // Handle rewinding / reset
        const hasPreviousFrame = this.lastElapsedMs !== null;
        const deltaMs = hasPreviousFrame ? Math.max(0, elapsedMs - this.lastElapsedMs) : 0;
        if (hasPreviousFrame && elapsedMs < this.lastElapsedMs) {
            this.lastSpawnTime = elapsedMs;
            this.elements = [];
            this.spawnInitialElements();
        }
        this.lastElapsedMs = elapsedMs;

        // Spawn new element periodically
        if (elapsedMs - this.lastSpawnTime > this.nextSpawnInterval) {
            this.lastSpawnTime = elapsedMs;
            this.nextSpawnInterval = 600 + Math.random() * 900;
            const newElem = this.createRandomElement();
            newElem.spawnTime = elapsedMs;
            this.elements.push(newElem);
        }

        // Update position and collect sprite dots
        const activeElements = [];

        for (const elem of this.elements) {
            elem.y -= elem.speedY * deltaMs / (1000 / 60);

            // Horizontal sway
            const sway = Math.sin(elapsedMs * elem.swayFrequency + elem.swayPhase) * elem.swayAmplitude;
            let currentX = elem.x + sway + (elem.speedX * (height - elem.y) * 0.1);

            // Clamp within left or right boundary
            currentX = Math.max(elem.minX, Math.min(elem.maxX, currentX));

            // Fade/disappear check as it reaches top
            if (elem.y < -20) continue;

            activeElements.push(elem);

            // Get pattern grid
            const pattern = SnoringZzz.PATTERNS[elem.type] || SnoringZzz.PATTERNS['z'];
            const cosR = Math.cos(elem.rotation);
            const sinR = Math.sin(elem.rotation);
            const dotSize = 2;

            const gridH = pattern.length;
            const gridW = pattern[0].length;
            const originX = (gridW * dotSize) / 2;
            const originY = (gridH * dotSize) / 2;

            for (let r = 0; r < gridH; r++) {
                for (let c = 0; c < gridW; c++) {
                    if (pattern[r][c] === 1) {
                        // Position relative to element center
                        const localX = (c * dotSize - originX) * elem.scale;
                        const localY = (r * dotSize - originY) * elem.scale;

                        // Rotate
                        const rotX = localX * cosR - localY * sinR;
                        const rotY = localX * sinR + localY * cosR;

                        sprites.push({
                            x: Math.round(currentX + rotX),
                            y: Math.round(elem.y + rotY),
                            size: dotSize
                        });
                    }
                }
            }
        }

        this.elements = activeElements;

        return sprites;
    }
}
