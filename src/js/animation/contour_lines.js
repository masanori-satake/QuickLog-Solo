import { AnimationBase } from '../animation_base.js';

/**
 * ContourLines Animation
 * Abstract, organic topographic-style lines that flow smoothly.
 * 抽象的で有機的な、流れるような等高線スタイルの曲線アニメーションです。
 */
export default class ContourLines extends AnimationBase {
    static metadata = {
        specVersion: '1.1',
        name: {
            en: "Contour Lines",
            ja: "等高線",
            de: "Höhenlinien",
            es: "Curvas de nivel",
            fr: "Courbes de niveau",
            pt: "Curvas de nível",
            ko: "등고선",
            zh: "等高线"
        },
        description: {
            en: "Abstract, organic topographic-style lines that flow smoothly.",
            ja: "抽象的で有機的な、流れるような等高線スタイルの曲線です。",
            de: "Abstrakte, organische Linien im topografischen Stil, die sanft fließen.",
            es: "Líneas abstractas y orgánicas de estilo topográfico que fluyen suavemente.",
            fr: "Lignes abstraites et organiques de style topographique qui coulent doucement.",
            pt: "Linhas abstratas e orgânicas de estilo topográfico que fluem suavemente.",
            ko: "부드럽게 흐르는 추상적이고 유기적인 지형 스타일의 선です。",
            zh: "抽象、有机的地形风格线条，流动平滑。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'mask' };

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        // Number of concentric lines
        // 同心円状の線の数
        this.lineCount = 10;
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { elapsedMs = 0, progress = 0 } = {}) {
        const width = this.width;
        const height = this.height;

        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;

        // Slow time factor for smooth animation
        // 滑らかなアニメーションのための時間係数
        const time = elapsedMs / 3000;

        for (let i = 0; i < this.lineCount; i++) {
            // Base radius for each line
            // 各線の基本半径
            const baseRadius = 20 + i * 15 + Math.sin(time + i) * 10;

            ctx.beginPath();
            // Draw a closed loop by iterating around a circle
            // 円に沿ってループを描画
            for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.2) {
                // Add "noise" to create organic shapes
                // 有機的な形状を作るための揺らぎを追加
                const noise = Math.sin(a * 3 + time + i) * 10 * progress;
                const r = baseRadius + noise;
                const x = width / 2 + Math.cos(a) * r;
                const y = height / 2 + Math.sin(a) * r;

                if (a === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        ctx.globalAlpha = 1.0;
    }
}
