import { AnimationBase } from '../animation_base.js';

/**
 * M3SymbolsWithKB Animation
 * Displays Material Design 3 symbols with Ken Burns zoom, random placement,
 * random scale, and subtle rotation tilt (up to +-20 deg) to visually indicate
 * break status without using localized text.
 */
export default class M3SymbolsWithKB extends AnimationBase {
    static metadata = {
        specVersion: '2.0',
        name: {
            en: "M3 Symbols (KB)",
            ja: "M3シンボル (KB)",
            de: "M3-Symbole (KB)",
            es: "Símbolos M3 (KB)",
            fr: "Symboles M3 (KB)",
            pt: "Símbolos M3 (KB)",
            ko: "M3 심볼 (KB)",
            zh: "M3 符号 (KB)"
        },
        description: {
            en: "Break reminder animation displaying Material Design 3 symbols with Ken Burns zoom, random placement, and rotation tilt.",
            ja: "M3シンボルがランダムな位置・傾き・大きさでKen Burns効果で拡大・フェードし、休憩中であることを優しく知らせるアニメーションです。",
            de: "Pause-Erinnerungsanimation mit Material Design 3-Symbolen mit Ken Burns-Zoom, zufälliger Platzierung und Drehung.",
            es: "Animación de recordatorio de descanso que muestra símbolos de Material Design 3 con zoom Ken Burns, ubicación aleatoria e inclinación.",
            fr: "Animation de rappel de pause affichant des symboles Material Design 3 avec zoom Ken Burns, placement aléatoire et inclinaison.",
            pt: "Animação de lembrete de pausa exibindo símbolos do Material Design 3 com zoom Ken Burns, posicionamento aleatório e inclinação.",
            ko: "Ken Burns 줌, 렌덤 위치 및 회전 효과로 Material Design 3 심볼을 표시하여 휴식 중임을 알려주는 애니메이션입니다.",
            zh: "带有 Ken Burns 缩放、随机位置和倾斜旋转的 Material Design 3 符号休息提醒动画。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = {
        mode: 'canvas',
        exclusionStrategy: 'mask'
    };

    constructor() {
        super();

        // Symbol Category Definitions
        this.categories = {
            pause: ['pause', 'do_not_disturb', 'sleep', 'bedtime', 'dark_mode', 'timer_off'],
            relax: ['spa', 'self_care', 'local_cafe', 'weekend', 'eco'],
            abstract: ['circle', 'radio_button_unchecked', 'brightness_low', 'blur_on', 'star', 'motion_photos_pause'],
            random: ['hexagon', 'change_history', 'wifi', 'bluetooth', 'cloud', 'water_drop', 'bolt']
        };

        // Configurable Animation Parameters
        this.symbol_category_weights = {
            pause: 0.60,
            relax: 0.20,
            abstract: 0.15,
            random: 0.05
        };
        this.kb_scale_start = 1.0;
        this.kb_scale_end = 1.4;
        this.kb_duration = 2500; // ms per cycle
        this.kb_easing = 'ease-in-out';
        this.max_tilt_deg = 20; // max tilt angle +-20 degrees
        this.min_visibility_ratio = 0.60; // guarantee at least 60% of symbol is visible
        this.dot_granularity = 10;
        this.baseSymbolSize = 0;
    }

    /**
     * Initial setup and viewport resize
     * @param {number} width - Viewport width
     * @param {number} height - Viewport height
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
        this.baseSymbolSize = Math.min(width, height) * 0.45;
    }

    /**
     * Easing function helper
     * @param {number} t - Normalized progress (0.0 to 1.0)
     * @returns {number} Eased value
     */
    _ease(t) {
        if (this.kb_easing === 'ease-in-out') {
            return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        }
        return t;
    }

    /**
     * Pseudo-random generator for deterministic animation frame generation
     * @param {number} seed - Seed value
     * @returns {number} Value between 0.0 and 1.0
     */
    _pseudoRandom(seed) {
        const x = Math.sin(seed + 1.618) * 10000;
        return x - Math.floor(x);
    }

    /**
     * Get randomized cycle parameters deterministically based on cycle index
     * @param {number} cycleIndex - Index of current cycle
     * @returns {Object} Cycle properties (symbol, sizeFactor, tiltRad, rPosX, rPosY)
     */
    _getCycleProperties(cycleIndex) {
        const seedBase = cycleIndex * 7 + 100;

        // 1. Category Selection
        const rCat = this._pseudoRandom(seedBase + 1);
        let cumulative = 0;
        let selectedCategory = 'pause';

        for (const [cat, weight] of Object.entries(this.symbol_category_weights)) {
            cumulative += weight;
            if (rCat <= cumulative) {
                selectedCategory = cat;
                break;
            }
        }

        // 2. Symbol Selection
        const symbolList = this.categories[selectedCategory] || this.categories.pause;
        const rSym = this._pseudoRandom(seedBase + 2);
        const symbolIdx = Math.floor(rSym * symbolList.length) % symbolList.length;
        const symbol = symbolList[symbolIdx];

        // 3. Size Factor (0.85 to 1.25)
        const rSize = this._pseudoRandom(seedBase + 3);
        const sizeFactor = 0.85 + rSize * 0.40;

        // 4. Tilt Angle in Radians (+- max_tilt_deg)
        const rTilt = this._pseudoRandom(seedBase + 4);
        const tiltDeg = (rTilt * 2 - 1) * this.max_tilt_deg;
        const tiltRad = (tiltDeg * Math.PI) / 180;

        // 5. Position Ratios
        const rPosX = this._pseudoRandom(seedBase + 5);
        const rPosY = this._pseudoRandom(seedBase + 6);

        return { symbol, sizeFactor, tiltRad, tiltDeg, rPosX, rPosY };
    }

    /**
     * Main drawing loop
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} params - Animation runtime parameters
     */
    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;

        if (width <= 0 || height <= 0) {
            return;
        }

        const duration = Math.max(100, this.kb_duration);
        const cycleIndex = Math.floor(elapsedMs / duration);
        const cycleProgress = (elapsedMs % duration) / duration;

        const props = this._getCycleProperties(cycleIndex);

        // Ken Burns Scale Calculation
        const easedProgress = this._ease(cycleProgress);
        const kbScale = this.kb_scale_start + (this.kb_scale_end - this.kb_scale_start) * easedProgress;

        // Final rendered symbol font size
        const fontSize = Math.floor(this.baseSymbolSize * props.sizeFactor * kbScale);

        // Calculate position limits to guarantee >= 60% visibility
        // To guarantee >= 60% total area visible, ensure at least sqrt(0.60) ~= 0.775 coverage per axis
        // Overlapping at most 0.225 * fontSize outside each canvas boundary
        const maxOverflowRatio = 0.22;
        const minMargin = (0.50 - maxOverflowRatio) * fontSize;

        let minCx = minMargin;
        let maxCx = width - minMargin;
        if (minCx >= maxCx) {
            minCx = width / 2;
            maxCx = width / 2;
        }

        let minCy = minMargin;
        let maxCy = height - minMargin;
        if (minCy >= maxCy) {
            minCy = height / 2;
            maxCy = height / 2;
        }

        const cx = minCx + props.rPosX * (maxCx - minCx);
        const cy = minCy + props.rPosY * (maxCy - minCy);

        // Smooth Alpha Fade In and Fade Out
        const alpha = Math.sin(cycleProgress * Math.PI);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(props.tiltRad);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, Math.floor(fontSize * 0.03));
        ctx.font = `${fontSize}px "Material Symbols Outlined"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(props.symbol, 0, 0);
        ctx.strokeText(props.symbol, 0, 0);
        ctx.restore();
    }
}
