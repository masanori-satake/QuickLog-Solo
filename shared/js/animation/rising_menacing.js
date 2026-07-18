import { AnimationBase } from '../animation_base.js';

/**
 * Rising Menacing Onomatopoeia
 * Infinite floating manga rumbling text "ゴ" that spawns at bottom and ascends.
 * 漫画でおなじみの「ゴ」の文字（ドット絵）が、動的に底辺から生成され、
 * 上昇しながらサイズを大きくし、上端に到達する前にフェードアウト（消去）します。
 */
export default class RisingMenacing extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Rising Menacing Onomatopoeia",
            ja: "ゴゴゴゴ…",
            de: "Aufsteigendes Bedrohliches Onomatopoetikum",
            es: "Onomatopeya amenazante ascendente",
            fr: "Onomatopée menaçante montante",
            pt: "Onomatopeia ameaçadora ascendente",
            ko: "솟구치는 위압감 고고고고",
            zh: "冉冉升起的威胁拟声词"
        },
        description: {
            en: "Pixelated Japanese character symbols ('ゴ') generate at the bottom, floating upward and scaling up while fading.",
            ja: "画面の下端からドット絵の「ゴ」の文字が無限に湧き上がり、回転・拡大しながらゆっくりと上空へ消えていきます。",
            de: "Pixelierte japanische Symbole ('ゴ') entstehen am unteren Rand, schweben nach oben und vergrößern sich, während sie verblassen.",
            es: "Símbolos de caracteres japoneses pixelados ('ゴ') se generan en la parte inferior, flotando hacia arriba y escalando mientras se desvanecen.",
            fr: "Des symboles de caractères japonais pixelisés ('ゴ') sont générés en bas, flottant vers le haut et augmentant de taille tout en s'estompant.",
            pt: "Símbolos de caracteres japoneses pixelados ('ゴ') são gerados na parte inferior, flutuando para cima e aumentando de tamanho enquanto desaparecem.",
            ko: "도트 스타일의 일본어 만화 효과음('ゴ')이 바닥에서 생성되어, 위로 떠오르며 크기가 커지고 서서히 사라집니다.",
            zh: "像素化的日文字符符号（'ゴ'）在底部产生，向上漂浮并放大，同时逐渐淡出。"
        },
        author: "QuickLog-Solo",
        devOnly: true,
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        this.characters = [];
        this.lastSpawnTime = 0;
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.characters = [];
        this.lastSpawnTime = 0;

        // Initialize with a few starting characters in transit (Larger starting scale)
        for (let i = 0; i < 3; i++) {
            this.characters.push({
                x: 20 + Math.random() * (width - 40),
                y: height * 0.3 + Math.random() * (height * 0.6),
                scale: 0.9 + Math.random() * 0.6,
                opacity: 1.0,
                speedY: 0.5 + Math.random() * 0.8
            });
        }
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;

        // Handle time rewinding or jumping
        if (elapsedMs < this.lastSpawnTime) {
            this.lastSpawnTime = elapsedMs;
            this.characters = [];
        }

        // Spawn a new character every 1200ms
        if (elapsedMs - this.lastSpawnTime > 1200) {
            this.lastSpawnTime = elapsedMs;
            this.characters.push({
                x: 15 + Math.random() * (width - 35),
                y: height + 15,
                scale: 0.8, // Larger starting scale
                opacity: 1.0,
                speedY: 0.4 + Math.random() * 0.6
            });
        }

        // Update characters
        this.characters.forEach(char => {
            char.y -= char.speedY;
            // Float upward -> scale up slightly faster
            char.scale = Math.min(2.2, char.scale + 0.005);

            // Fade out smoothly as it approaches the top
            const progressToTop = char.y / height; // 1 at bottom, 0 at top
            if (progressToTop < 0.35) {
                char.opacity = Math.max(0, progressToTop / 0.35);
            }
        });

        // Clean up out of bounds or invisible characters
        this.characters = this.characters.filter(char => char.y > -30 && char.opacity > 0);

        // Draw character symbols "ゴ" using high-Red magenta color
        ctx.fillStyle = '#ff00ff'; // Vibrant Magenta (Red: 255)
        const pSize = 3; // Thicker pixel scale for dot matrix binning visibility

        const drawP = (px, py) => {
            ctx.fillRect(px * pSize, py * pSize, pSize, pSize);
        };

        this.characters.forEach(char => {
            ctx.save();
            ctx.translate(char.x, char.y);
            ctx.scale(char.scale, char.scale);

            ctx.fillStyle = `rgba(255, 0, 255, ${char.opacity})`;

            // "ゴ" Grid Layout:
            // Top Bar
            for (let x = -5; x <= 3; x++) drawP(x, -5);
            // Right edge vertical down
            for (let y = -4; y <= 2; y++) drawP(3, y);
            // Dakuten (two dots at top right)
            drawP(5, -7); drawP(6, -7);
            drawP(5, -6); drawP(6, -6);

            drawP(5, -4); drawP(6, -4);
            drawP(5, -3); drawP(6, -3);

            // Left curved turn
            drawP(-5, -4); drawP(-5, -3);
            drawP(-4, -2); drawP(-3, -2);
            for (let x = -3; x <= 2; x++) drawP(x, -1);

            // Bottom base hook
            drawP(-4, 0); drawP(-4, 1);
            for (let x = -4; x <= 2; x++) drawP(x, 2);

            ctx.restore();
        });
    }
}
