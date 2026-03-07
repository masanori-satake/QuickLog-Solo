import { AnimationBase } from '../animation_base.js';

/**
 * HeartBeat Animation
 * A rhythmic ECG waveform with a glowing trail.
 * リズミカルな心電図の波形アニメーションです。
 */
export default class HeartBeat extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Heart Beat",
            ja: "ハート・ビート",
            de: "Herzschlag",
            es: "Latido del Corazón",
            fr: "Battement de Cœur",
            pt: "Batimento Cardíaco",
            ko: "심장 박동",
            zh: "心跳"
        },
        description: {
            en: "A rhythmic ECG waveform with a glowing trail. Rhythm may fluctuate occasionally after a minute.",
            ja: "画面を流れるリズム正しい心電図の波形です。光の軌跡が残り、1分ほど経つと時折リズムが乱れます。",
            de: "Eine rhythmische EKG-Wellenform mit einer leuchtenden Spur. Der Rhythmus kann nach einer Minute gelegentlich schwanken.",
            es: "Una forma de onda de ECG rítmica con un rastro brillante. El ritmo puede fluctuar ocasionalmente después de un minuto.",
            fr: "Une forme d'onde ECG rythmique avec une trace lumineuse. Le rythme peut fluctuer occasionnellement après une minute.",
            pt: "Uma forma de onda de ECG rítmica con um rastro brillante. O ritmo pode flutuar ocasionalmente após um minuto.",
            ko: "화면을 따라 흐르는 리드미컬한 ECG 파형입니다. 빛의 궤적이 남으며 1分 정도 지나면 때때로 리듬이 불규칙해집니다.",
            zh: "屏幕上律动的心电图波形，带有发光轨迹。一分钟后节奏可能会偶尔波动。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'sprite', usePseudoSpace: true };

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        // Vertical center line
        // 垂直方向の中央線
        this.centerY = height / 2;
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { elapsedMs = 0 } = {}) {
        const sprites = [];
        const width = this.width;
        const centerY = this.centerY;

        const cycleMs = 800; // Average heartbeat interval / 平均的な心拍間隔
        const durationToShow = 2000; // Show 2 seconds of history / 2秒分の履歴を表示
        const resolution = 15; // ms per dot / ドットごとの時間間隔

        // Iterate back in time to draw the trailing waveform
        // 過去に遡って軌跡の波形を描画
        for (let t = elapsedMs - durationToShow; t <= elapsedMs; t += resolution) {
            if (t < 0) continue;

            const beatIndex = Math.floor(t / cycleMs);
            const localT = (t % cycleMs) / cycleMs;

            // Arrhythmia: Occasional skipped beat after 60 seconds
            // 不整脈：60秒経過後、時々心拍を飛ばす演出
            let skip = false;
            if (t > 60000) {
                if ((beatIndex * 17) % 100 < 4) {
                    skip = true;
                }
            }

            let yOffset = 0;
            if (!skip) {
                // ECG Waveform components (P, QRS, T)
                // 心電図の各成分（P波, QRS群, T波）をシミュレート
                if (localT < 0.1) {
                    yOffset = -Math.sin((localT / 0.1) * Math.PI) * 4; // P wave
                } else if (localT < 0.15) {
                    yOffset = 0; // PR interval
                } else if (localT < 0.17) {
                    yOffset = ((localT - 0.15) / 0.02) * 4; // Q wave
                } else if (localT < 0.20) {
                    yOffset = 4 - ((localT - 0.17) / 0.03) * 44; // R wave (peak)
                } else if (localT < 0.24) {
                    yOffset = -40 + ((localT - 0.20) / 0.04) * 48; // S wave
                } else if (localT < 0.27) {
                    yOffset = 8 - ((localT - 0.24) / 0.03) * 8; // Baseline return
                } else if (localT < 0.35) {
                    yOffset = 0; // ST segment
                } else if (localT < 0.50) {
                    yOffset = -Math.sin(((localT - 0.35) / 0.15) * Math.PI) * 6; // T wave
                }
            }

            const age = elapsedMs - t;
            // Trail effect: newer dots are larger
            // 軌跡効果：新しいドットほど大きく表示
            const size = age < 100 ? 3 : (age < 400 ? 2 : 1);

            // X position: current time at the right edge
            // X座標：現在時刻が右端、過去ほど左になるように計算
            const x = width - (age / durationToShow) * width;

            sprites.push({ x, y: centerY + yOffset, size });
        }

        return sprites;
    }
}
