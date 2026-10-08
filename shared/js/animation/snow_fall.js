import { AnimationBase } from '../animation_base.js';
import { CELL_SIZE } from '../utils.js';

/**
 * SnowFall Animation
 * Gentle falling snow effect with distant small snowflakes and detailed foreground crystal snowflakes.
 * 遠くの小雪と近くの繊細な大粒の雪の結晶がフワフワと降り注ぐスノーアニメーションです。
 */
export default class SnowFall extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Falling Snow",
            ja: "降雪",
            de: "Schneefall",
            es: "Nieve cayendo",
            fr: "Chute de neige",
            pt: "Queda de neve",
            ko: "내리는 눈",
            zh: "降雪"
        },
        description: {
            en: "A peaceful snow scene featuring distant small snowflakes and detailed foreground crystal snowflakes falling gently.",
            ja: "遠くの小さめの雪と、ドット表示でも映える複数の雪の結晶が少しずつ速度を違えてゆっくりとフワフワ降るアニメーションです。",
            de: "Eine friedliche Schneeszene mit kleinen Schneeflocken im Hintergrund und detaillierten Kristall-Schneeflocken im Vordergrund.",
            es: "Una pacífica escena de nieve con pequeños copos de nieve lejanos y detallados cristales en primer plano.",
            fr: "Une scène de neige paisible avec de petits flocons lointains et des cristaux détaillés au premier plan.",
            pt: "Uma cena de neve tranquila com pequenos flocos ao fundo e cristais detalhados em primeiro plano.",
            ko: "고요한 눈 내리는 풍경으로, 멀리 작은 눈송이와 가까이 다채로운 눈 결정체가 부드럽게 떨어집니다.",
            zh: "宁静的雪景，远处的细雪与近处精致的雪花晶体在缓缓飘落。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'sprite', exclusionStrategy: 'jump' };

    // Foreground snowflake crystal pixel patterns (mapped to 6px CELL_SIZE grid)
    // 近くの大きな雪の結晶パターン (6px CELL_SIZE グリッド)
    static CRYSTAL_PATTERNS = [
        // Pattern 0: Classic 6-arm cross crystal (5x5)
        [
            [0, 1, 0, 1, 0],
            [1, 0, 1, 0, 1],
            [0, 1, 1, 1, 0],
            [1, 0, 1, 0, 1],
            [0, 1, 0, 1, 0]
        ],
        // Pattern 1: Star / Diamond crystal (5x5)
        [
            [0, 0, 1, 0, 0],
            [0, 1, 1, 1, 0],
            [1, 1, 0, 1, 1],
            [0, 1, 1, 1, 0],
            [0, 0, 1, 0, 0]
        ],
        // Pattern 2: Hexagonal flower crystal (5x5)
        [
            [1, 0, 1, 0, 1],
            [0, 1, 1, 1, 0],
            [1, 1, 1, 1, 1],
            [0, 1, 1, 1, 0],
            [1, 0, 1, 0, 1]
        ],
        // Pattern 3: Ornate large snowflake crystal (7x7)
        [
            [1, 0, 0, 1, 0, 0, 1],
            [0, 1, 0, 1, 0, 1, 0],
            [0, 0, 1, 1, 1, 0, 0],
            [1, 1, 1, 1, 1, 1, 1],
            [0, 0, 1, 1, 1, 0, 0],
            [0, 1, 0, 1, 0, 1, 0],
            [1, 0, 0, 1, 0, 0, 1]
        ]
    ];

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        this.backgroundFlakes = [];
        this.foregroundCrystals = [];
        this.lastElapsedMs = 0;
    }

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
        this.backgroundFlakes = [];
        this.foregroundCrystals = [];
        this.lastElapsedMs = 0;

        if (width <= 0 || height <= 0) return;

        // Initialize background small snowflakes (distant snow)
        // 遠くの小雪の初期化 (サイズ1のランダムドット)
        const bgCount = Math.max(15, Math.floor((width * height) / 1200));
        for (let i = 0; i < bgCount; i++) {
            this.backgroundFlakes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                speedY: 0.15 + Math.random() * 0.25,
                swayAmplitude: 2 + Math.random() * 6,
                swayFrequency: 0.001 + Math.random() * 0.002,
                swayPhase: Math.random() * Math.PI * 2,
                size: Math.random() < 0.2 ? 2 : 1
            });
        }

        // Initialize foreground large snowflake crystals (staggered positions and different fall speeds)
        // 近くの大きな雪の結晶の初期化 (位置ずらし・多様な速度とパターン)
        const fgCount = Math.max(4, Math.floor(width / 70));
        for (let i = 0; i < fgCount; i++) {
            this.foregroundCrystals.push(this.createForegroundCrystal(i, fgCount));
        }
    }

    /**
     * Helper to create a single foreground snowflake crystal
     * 近くの雪の結晶作成ヘルパー関数
     */
    createForegroundCrystal(index, totalCount) {
        const width = this.width || 300;
        const height = this.height || 150;

        // Stagger horizontal zones with subtle overlap
        const zoneWidth = width / Math.max(1, totalCount);
        const minX = index * zoneWidth;
        const x = minX + Math.random() * zoneWidth;

        // Randomly choose pattern (0..3)
        const patterns = this.constructor.CRYSTAL_PATTERNS || SnowFall.CRYSTAL_PATTERNS;
        const patternIndex = Math.floor(Math.random() * patterns.length);

        return {
            x,
            y: Math.random() * height,
            patternIndex,
            // Vary fall speeds slightly so foreground snowflakes don't move in parallel
            speedY: 0.2 + Math.random() * 0.35,
            // Horizontal gentle swaying
            swayAmplitude: 6 + Math.random() * 12,
            swayFrequency: 0.001 + Math.random() * 0.002,
            swayPhase: Math.random() * Math.PI * 2,
            spawnX: x
        };
    }

    /**
     * Main drawing loop
     * 描画処理ループ
     */
    draw(ctx, { elapsedMs = 0 } = {}) {
        const sprites = [];
        const width = this.width;
        const height = this.height;

        if (width <= 0 || height <= 0) return sprites;

        // Handle rewinding / time reset
        if (elapsedMs < this.lastElapsedMs) {
            this.setup(width, height);
        }
        // Preserve the original 60fps fall speed when frames are skipped.
        const frameScale = (elapsedMs - this.lastElapsedMs) / (1000 / 60);
        this.lastElapsedMs = elapsedMs;

        // 1. Render Background Small Snowflakes (Distant layer)
        // 1. 遠くの小雪描画 (フワフワと落ちる小さなドット)
        for (const flake of this.backgroundFlakes) {
            flake.y += flake.speedY * frameScale;

            // Wrap around top when falling off bottom
            if (flake.y > height + 5) {
                flake.y = -5;
                flake.x = Math.random() * width;
            }

            const sway = Math.sin(elapsedMs * flake.swayFrequency + flake.swayPhase) * flake.swayAmplitude;
            const drawX = Math.round(flake.x + sway);
            const drawY = Math.round(flake.y);

            if (drawX >= 0 && drawX < width && drawY >= 0 && drawY < height) {
                sprites.push({
                    x: drawX,
                    y: drawY,
                    size: flake.size
                });
            }
        }

        // 2. Render Foreground Snowflake Crystals (Near layer)
        // 2. 近くの大きな雪の結晶描画 (パターン表示と並行移動回避)
        for (const crystal of this.foregroundCrystals) {
            crystal.y += crystal.speedY * frameScale;

            // Wrap around top with new random pattern when falling off bottom
            const patterns = this.constructor.CRYSTAL_PATTERNS || SnowFall.CRYSTAL_PATTERNS;
            if (crystal.y > height + 20) {
                crystal.y = -20;
                crystal.x = Math.random() * width;
                crystal.patternIndex = Math.floor(Math.random() * patterns.length);
                crystal.speedY = 0.2 + Math.random() * 0.35; // New slightly varied speed
            }

            const sway = Math.sin(elapsedMs * crystal.swayFrequency + crystal.swayPhase) * crystal.swayAmplitude;
            const currentX = crystal.x + sway;
            const currentY = crystal.y;

            const pattern = patterns[crystal.patternIndex] || patterns[0];
            const gridH = pattern.length;
            const gridW = pattern[0].length;
            const originX = (gridW * CELL_SIZE) / 2;
            const originY = (gridH * CELL_SIZE) / 2;

            for (let r = 0; r < gridH; r++) {
                for (let c = 0; c < gridW; c++) {
                    if (pattern[r][c] === 1) {
                        const px = Math.round(currentX + c * CELL_SIZE - originX);
                        const py = Math.round(currentY + r * CELL_SIZE - originY);

                        if (px >= -CELL_SIZE && px <= width + CELL_SIZE && py >= -CELL_SIZE && py <= height + CELL_SIZE) {
                            sprites.push({
                                x: px,
                                y: py,
                                size: 2
                            });
                        }
                    }
                }
            }
        }

        return sprites;
    }
}
