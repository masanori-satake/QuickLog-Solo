import { AnimationBase } from '../animation_base.js';

export default class HeartBeat extends AnimationBase {
    static metadata = {
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

    draw(_ctx, { width, height, elapsedMs }) {
        const sprites = [];
        const centerY = height / 2;
        const cycleMs = 800; // Average heartbeat interval
        const durationToShow = 2000; // Show 2 seconds of history
        const resolution = 15; // ms per dot

        for (let t = elapsedMs - durationToShow; t <= elapsedMs; t += resolution) {
            if (t < 0) continue;

            const beatIndex = Math.floor(t / cycleMs);
            const localT = (t % cycleMs) / cycleMs;

            // Arrhythmia: Occasional skipped beat after 60 seconds
            let skip = false;
            if (t > 60000) {
                // Use beatIndex to keep the skip stable as it moves across the screen
                if ((beatIndex * 17) % 100 < 4) {
                    skip = true;
                }
            }

            let yOffset = 0;
            if (!skip) {
                // ECG Waveform components (P, QRS, T)
                if (localT < 0.1) {
                    // P wave
                    yOffset = -Math.sin((localT / 0.1) * Math.PI) * 4;
                } else if (localT < 0.15) {
                    // PR interval (baseline)
                    yOffset = 0;
                } else if (localT < 0.17) {
                    // Q wave
                    yOffset = ((localT - 0.15) / 0.02) * 4;
                } else if (localT < 0.20) {
                    // R wave (peak)
                    yOffset = 4 - ((localT - 0.17) / 0.03) * 44;
                } else if (localT < 0.24) {
                    // S wave
                    yOffset = -40 + ((localT - 0.20) / 0.04) * 48;
                } else if (localT < 0.27) {
                    // Back to baseline
                    yOffset = 8 - ((localT - 0.24) / 0.03) * 8;
                } else if (localT < 0.35) {
                    // ST segment (baseline)
                    yOffset = 0;
                } else if (localT < 0.50) {
                    // T wave
                    yOffset = -Math.sin(((localT - 0.35) / 0.15) * Math.PI) * 6;
                }
                // TP interval (baseline) is the rest of the cycle
            }

            const age = elapsedMs - t;
            // Trail effect: newer dots are larger
            const size = age < 100 ? 3 : (age < 400 ? 2 : 1);

            // X position: current time at the right edge, older points to the left
            const x = width - (age / durationToShow) * width;

            sprites.push({ x, y: centerY + yOffset, size });
        }

        return sprites;
    }
}
