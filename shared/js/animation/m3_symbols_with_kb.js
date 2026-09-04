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

        // Unified Material Design 3 Symbol Definitions
        this.symbols = [
            // Pause / Relax / Time
            'pause', 'do_not_disturb', 'sleep', 'bedtime', 'dark_mode', 'timer_off', 'timer', 'alarm',
            'schedule', 'calendar_today', 'today', 'event', 'hourglass_empty', 'hourglass_full',
            'spa', 'self_care', 'local_cafe', 'weekend', 'eco', 'coffee', 'water_drop', 'forest', 'park',
            'nature', 'grass', 'flower', 'nest_eco_leaf', 'nights_stay', 'wb_sunny', 'light_mode', 'sunny',
            'partly_cloudy_day', 'cloud', 'air', 'waves', 'thermostat', 'bolt', 'electric_bolt', 'solar_power',

            // Shapes / Abstract
            'circle', 'radio_button_unchecked', 'brightness_low', 'blur_on', 'star', 'motion_photos_pause',
            'hexagon', 'change_history', 'square', 'pentagon', 'token', 'diamond', 'interests', 'category',
            'palette', 'brush', 'draw', 'gesture', 'design_services', 'layers', 'grid_view', 'dashboard',

            // Action / Navigation / UI
            'search', 'favorite', 'home', 'settings', 'check', 'close', 'menu', 'refresh', 'arrow_forward',
            'arrow_back', 'check_circle', 'info', 'warning', 'error', 'delete', 'edit', 'visibility',
            'thumb_up', 'thumb_down', 'share', 'download', 'upload', 'lock', 'key', 'shield', 'notifications',
            'tune', 'filter_alt', 'zoom_in', 'zoom_out', 'sync', 'loop', 'update', 'history',

            // Devices / Tech / Communication
            'wifi', 'bluetooth', 'devices', 'computer', 'laptop', 'smartphone', 'tablet', 'tv', 'watch',
            'headphones', 'headset', 'mic', 'videocam', 'camera', 'photo', 'image', 'music_note',
            'volume_up', 'cast', 'router', 'memory', 'smart_toy', 'rocket', 'build', 'extension', 'widgets',

            // Places / Food / Objects / Social
            'location_on', 'map', 'place', 'explore', 'flight', 'directions_car', 'directions_bike',
            'pedal_bike', 'directions_walk', 'directions_run', 'fitness_center', 'sailing', 'train',
            'shopping_cart', 'store', 'payment', 'credit_card', 'restaurant', 'flatware', 'local_bar',
            'cake', 'icecream', 'cookie', 'ramen_dining', 'local_pizza', 'bakery_dining', 'fastfood',
            'chair', 'king_bed', 'hot_tub', 'bathtub', 'shower', 'clean_hands', 'handshake', 'person',
            'group', 'groups', 'sentiment_satisfied', 'face', 'psychology', 'pets', 'support_agent'
        ];
        this.min_duration = 6000; // ms
        this.max_duration = 8000; // ms
        this.zoom_in_scale_start = 1.0;
        this.zoom_in_scale_end = 1.4;
        this.zoom_out_scale_start = 2.0;
        this.zoom_out_scale_end = 1.2;
        this.kb_easing = 'ease-in-out';
        this.max_tilt_deg = 20; // max tilt angle +-20 degrees
        this.min_visibility_ratio = 0.60; // guarantee at least 60% of symbol is visible
        this.dot_granularity = 10;
        this.baseSymbolSize = 0;
        this.cycleStartTimes = [0];
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
     * @returns {Object} Cycle properties (duration, symbol, sizeFactor, tiltRad, rPosX, rPosY, zoomDirection, scaleStart, scaleEnd)
     */
    _getCycleProperties(cycleIndex) {
        const seedBase = cycleIndex * 7 + 100;

        // 0. Duration Selection (6000ms to 8000ms)
        const rDur = this._pseudoRandom(seedBase + 0);
        const duration = this.min_duration + rDur * (this.max_duration - this.min_duration);

        // 1. Symbol Selection (Randomly pick from the full symbols array)
        const rSym = this._pseudoRandom(seedBase + 1);
        const symbolIdx = Math.floor(rSym * this.symbols.length) % this.symbols.length;
        const symbol = this.symbols[symbolIdx];

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

        // 6. Zoom Direction and Scale Limits
        const rZoom = this._pseudoRandom(seedBase + 7);
        const zoomDirection = rZoom < 0.5 ? 'in' : 'out';
        const scaleStart = zoomDirection === 'in' ? this.zoom_in_scale_start : this.zoom_out_scale_start;
        const scaleEnd = zoomDirection === 'in' ? this.zoom_in_scale_end : this.zoom_out_scale_end;

        return {
            duration,
            symbol,
            sizeFactor,
            tiltRad,
            tiltDeg,
            rPosX,
            rPosY,
            zoomDirection,
            scaleStart,
            scaleEnd
        };
    }

    /**
     * Calculate cycle index, start time, duration, and progress for a given elapsed time
     * @param {number} elapsedMs - Total elapsed time in milliseconds
     * @returns {Object} Cycle time info
     */
    _getCycleTimeInfo(elapsedMs) {
        if (elapsedMs <= 0) {
            const props = this._getCycleProperties(0);
            return {
                cycleIndex: 0,
                cycleStartMs: 0,
                duration: props.duration,
                cycleProgress: 0,
                props
            };
        }

        let lastCycleIndex = this.cycleStartTimes.length - 1;
        let lastCycleStartMs = this.cycleStartTimes[lastCycleIndex];
        let lastCycleProps = this._getCycleProperties(lastCycleIndex);

        while (lastCycleStartMs + lastCycleProps.duration <= elapsedMs) {
            lastCycleStartMs += lastCycleProps.duration;
            this.cycleStartTimes.push(lastCycleStartMs);
            lastCycleIndex++;
            lastCycleProps = this._getCycleProperties(lastCycleIndex);
        }

        let low = 0;
        let high = this.cycleStartTimes.length;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (this.cycleStartTimes[mid] <= elapsedMs) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        const cycleIndex = low - 1;
        const cycleStartMs = this.cycleStartTimes[cycleIndex];
        const props = this._getCycleProperties(cycleIndex);

        const cycleProgress = (elapsedMs - cycleStartMs) / props.duration;

        return {
            cycleIndex,
            cycleStartMs,
            duration: props.duration,
            cycleProgress,
            props
        };
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

        const timeInfo = this._getCycleTimeInfo(elapsedMs);
        const cycleProgress = timeInfo.cycleProgress;
        const props = timeInfo.props;

        // Ken Burns Scale Calculation
        const easedProgress = this._ease(cycleProgress);
        const kbScale = props.scaleStart + (props.scaleEnd - props.scaleStart) * easedProgress;

        // Final rendered symbol font size
        const fontSize = Math.floor(this.baseSymbolSize * props.sizeFactor * kbScale);

        // Smooth Alpha Fade In and Fade Out
        const alpha = Math.sin(cycleProgress * Math.PI);

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, Math.floor(fontSize * 0.03));
        ctx.font = `${fontSize}px "Material Symbols Outlined"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Calculate the rotated text bounds, including the stroke, so edge placements
        // preserve the configured visible-area ratio instead of assuming a square glyph.
        const metrics = ctx.measureText(props.symbol);
        const measuredWidth = Number.isFinite(metrics.width) ? metrics.width : fontSize;
        const strokeRadius = ctx.lineWidth / 2;
        const left =
            (Number.isFinite(metrics.actualBoundingBoxLeft) ? metrics.actualBoundingBoxLeft : measuredWidth / 2) +
            strokeRadius;
        const right =
            (Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : measuredWidth / 2) +
            strokeRadius;
        const ascent =
            (Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : fontSize / 2) +
            strokeRadius;
        const descent =
            (Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : fontSize / 2) +
            strokeRadius;

        const cosTilt = Math.cos(props.tiltRad);
        const sinTilt = Math.sin(props.tiltRad);
        const corners = [
            [-left, -ascent],
            [right, -ascent],
            [right, descent],
            [-left, descent],
        ];
        const rotatedX = corners.map(([x, y]) => x * cosTilt - y * sinTilt);
        const rotatedY = corners.map(([x, y]) => x * sinTilt + y * cosTilt);
        const minRotatedX = Math.min(...rotatedX);
        const maxRotatedX = Math.max(...rotatedX);
        const minRotatedY = Math.min(...rotatedY);
        const maxRotatedY = Math.max(...rotatedY);

        const visibilityRatio = Math.min(1, Math.max(0, this.min_visibility_ratio));
        const maxOverflowRatio = 1 - Math.sqrt(visibilityRatio);
        const maxOverflowX = (maxRotatedX - minRotatedX) * maxOverflowRatio;
        const maxOverflowY = (maxRotatedY - minRotatedY) * maxOverflowRatio;

        let minCx = -minRotatedX - maxOverflowX;
        let maxCx = width - maxRotatedX + maxOverflowX;
        if (minCx >= maxCx) {
            minCx = width / 2;
            maxCx = width / 2;
        }

        let minCy = -minRotatedY - maxOverflowY;
        let maxCy = height - maxRotatedY + maxOverflowY;
        if (minCy >= maxCy) {
            minCy = height / 2;
            maxCy = height / 2;
        }

        const cx = minCx + props.rPosX * (maxCx - minCx);
        const cy = minCy + props.rPosY * (maxCy - minCy);

        ctx.translate(cx, cy);
        ctx.rotate(props.tiltRad);

        ctx.fillText(props.symbol, 0, 0);
        ctx.strokeText(props.symbol, 0, 0);
        ctx.restore();
    }
}
