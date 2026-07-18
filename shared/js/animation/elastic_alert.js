import { AnimationBase } from '../animation_base.js';

/**
 * Elastic Alert Pop-Up
 * Stealth-action exclamation alert mark hovering loop.
 * 鮮やかな赤色のドット絵「！」マークが、中央上部付近に突如として出現します。
 * 出現時はサイズ0から1.2まで一瞬で拡大し、ゴムのような弾力（ばね運動）で1.0に落ち着きます。
 * その後は、上下に数ピクセル揺れながらホバーし続け、一定時間でループ（リセット）します。
 */
export default class ElasticAlert extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Elastic Alert Pop-Up",
            ja: "発見アラート",
            de: "Elastischer Alarm-Pop-up",
            es: "Ventana emergente de alerta elástica",
            fr: "Pop-up d'alerte élastique",
            pt: "Pop-up de alerta elástico",
            ko: "탄력 있는 발견 경고 팝업",
            zh: "弹性警报弹出窗口"
        },
        description: {
            en: "A red pixel exclamation mark '!' pops up with a spring-like dampening motion, hovering gently.",
            ja: "赤い「！」マークが弾むように現れ、上下にふわふわと浮遊するループを繰り返します。",
            de: "Ein rotes Pixel-Ausrufezeichen '!' erscheint mit einer federartigen Dämpfungsbewegung und schwebt sanft.",
            es: "Un signo de exclamación de píxeles rojos '!' aparece con un movimiento de amortiguación similar a un resorte, flotando suavemente.",
            fr: "Un point d'exclamation rouge en pixel '!' apparaît avec un mouvement d'amortissement de type ressort, planant doucement.",
            pt: "Um ponto de exclamação de pixel vermelho '!' aparece com um movimento de amortecimento elástico, flutuando suavemente.",
            ko: "빨간색 픽셀 느낌의 느낌표('!')가 용수철처럼 탄력 있게 튀어나온 뒤, 공중에 부드럽게 둥둥 떠다닙니다.",
            zh: "一个红色的像素感叹号“！”伴随着弹簧般的阻尼运动弹出，并在空中轻轻漂浮。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;
        const centerX = width / 2;
        // Position centerY in the upper portion of the panel to ensure full visibility
        // above the centered category text and timer band
        const centerY = Math.max(16, height * 0.25);

        // 3.5s total loop cycle
        const loopMs = 3500;
        const t = elapsedMs % loopMs;

        let scale = 1.0;
        let hoverY = 0;

        const popDuration = 400; // ms

        if (t < popDuration) {
            // Spring-like elastic scaling up: 0 -> overshoot -> 1.0
            // x = t / popDuration (0 to 1)
            const x = t / popDuration;
            // formula for elastic overshoot: 1 - cos(x * PI * 2.5) * (1 - x)
            scale = 1.0 - 1.0 * Math.cos(x * Math.PI * 2.5) * (1 - x);
            scale = Math.max(0, scale);
        } else {
            // Gentle float bobbing (sine wave)
            const floatPeriod = 1500;
            const floatT = (t - popDuration) % floatPeriod;
            hoverY = Math.sin((floatT / floatPeriod) * Math.PI * 2) * 5;
        }

        // Exclamation mark drawing
        ctx.save();
        ctx.translate(centerX, centerY + hoverY);
        ctx.scale(scale, scale);

        ctx.fillStyle = '#ff1744'; // Bright red exclamation color

        // Exclamation vertical height: 18px total
        // Top block (bar)
        ctx.fillRect(-2, -12, 4, 10);
        // Bottom dot
        ctx.fillRect(-2, 1, 4, 3);

        ctx.restore();
    }
}
