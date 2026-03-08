import { AnimationBase } from '../animation_base.js';

/**
 * Spectrum Animation
 * A dynamic audio spectrum analyzer where bars bounce to a rhythm.
 * リズムに合わせて上下するオーディオ・スペクトラムアナライザ風のアニメーションです。
 */
export default class Spectrum extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Spectrum",
            ja: "スペクトラム",
            de: "Spektrum",
            es: "Espectro",
            fr: "Spectre",
            pt: "Espectro",
            ko: "스펙트럼",
            zh: "频谱"
        },
        description: {
            en: "A dynamic audio spectrum analyzer where bars bounce to a rhythm, avoiding UI elements.",
            ja: "リズムに合わせて上下する、UI要素を避けるオーディオ・スペクトラムアナライザです。",
            de: "Ein dynamischer Audiospektrum-Analysator, bei dem Balken im Rhythmus hüpfen und UI-Elemente umgehen.",
            es: "Un analizador de espectro de audio dinámico donde las barras rebotan al ritmo, evitando los elementos de la interfaz.",
            fr: "Un analyseur de spectre audio dynamique où des barres rebondissent au rythme, en évitant les éléments de l'interface.",
            pt: "Um analisador de espectro de áudio dinâmico onde as barras saltam au ritmo, evitando elementos da interface.",
            ko: "리듬에 맞춰 바가 튀어 오르는 다이내믹한 오디오 스펙트럼 분석기로, UI 요소를 피합니다。",
            zh: "动态音频频谱分析仪，条形随节奏跳动，避开UI元素。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'sprite', exclusionStrategy: 'jump' };

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        // Configuration
        // 設定
        this.barCount = 32;

        // Initial bar heights and target heights
        // バーの現在高と目標高
        this.bars = Array(this.barCount).fill(0).map(() => Math.random() * 50);
        this.targetBars = Array(this.barCount).fill(0).map(() => Math.random() * 100);

        // Peak markers
        // ピーク（頂点）マーカー
        this.peaks = Array(this.barCount).fill(0);
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(_ctx) {
        const sprites = [];
        const width = this.width;
        const height = this.height;

        const barWidth = width / this.barCount;
        const spacingY = 6;

        for (let i = 0; i < this.barCount; i++) {
            // If bar reaches target, pick a new random target
            // 目標高に近づいたら、新しいランダムな目標を設定
            if (Math.abs(this.bars[i] - this.targetBars[i]) < 1) {
                this.targetBars[i] = Math.random() * height * 0.8;
            }

            // Smoothly move towards target (interpolation)
            // 目標に向かって滑らかに補間
            this.bars[i] += (this.targetBars[i] - this.bars[i]) * 0.15;

            // Update peak position
            // ピーク位置の更新
            if (this.bars[i] > this.peaks[i]) {
                this.peaks[i] = this.bars[i];
            } else {
                this.peaks[i] -= 1; // Peaks fall slowly / ピークはゆっくり下降
            }

            const x = i * barWidth + barWidth / 2;

            // Create dots for the bar
            // バーを構成するドットを生成
            for (let y = height; y > height - this.bars[i]; y -= spacingY) {
                sprites.push({ x, y, size: 2 });
            }

            // Draw peak marker dot
            // ピークドットの描画
            sprites.push({ x, y: height - this.peaks[i], size: 2 });
        }

        return sprites;
    }
}
