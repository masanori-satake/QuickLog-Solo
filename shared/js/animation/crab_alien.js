import { AnimationBase } from '../animation_base.js';

/**
 * Crab-Shaped Alien Metronome
 * Classic 8-bit space invader styling metronome swinging left and right.
 * カニのような8bit宇宙人が、400ms周期で腕を広げる・縮めるの2つのフレームを切り替えます。
 * 同時にコンテナ中心を基準にゆっくりと左右にスライドし、リズムを刻むメトロノームのように振る舞います。
 */
export default class CrabAlien extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Crab-Shaped Alien Metronome",
            ja: "インベーダー",
            de: "Krabben-Alien-Metronom",
            es: "Metrónomo alienígena con forma de cangrejo",
            fr: "Métronome extraterrestre en forme de crabe",
            pt: "Metrônomo alienígena em forma de caranguejo",
            ko: "게 모양 외계인 메트로놈",
            zh: "蟹形外星人节拍器"
        },
        description: {
            en: "An 8-bit crab-like silhouette swings left and right, toggling limbs every 400ms like a rhythmic pendulum.",
            ja: "8ビットのカニ型宇宙人が400msごとに腕の開閉を繰り返し、中央を基準に左右へ振り子のようにスライドします。",
            de: "Eine 8-Bit-Krabben-Silhouette schwingt nach links und rechts und schaltet alle 400 ms wie ein rhythmisches Pendel die Gliedmaßen um.",
            es: "Una silueta similar a un cangrejo de 8 bits se balancea de izquierda a derecha, alternando extremidades cada 400 ms como un péndulo rítmico.",
            fr: "Une silhouette de crabe 8 bits balance de gauche à droite, alternant les membres toutes les 400 ms comme un pendule rythmique.",
            pt: "Uma silhueta de caranguejo de 8 bits balança para a esquerda e para a direita, alternando os membros a cada 400 ms como um pêndulo rítmico.",
            ko: "8비트 게 모양 실루엣이 왼쪽과 오른쪽으로 흔들리며, 리드미컬한 진자처럼 400ms마다 팔다리를 전환합니다.",
            zh: "一个8位蟹状剪影左右摆动，每400毫秒切换一次肢体，就像一个有节奏的钟摆。"
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

        // Toggle frames every 400ms
        const isFrame2 = (Math.floor(elapsedMs / 400) % 2) === 1;

        // Metronome swing: left and right relative to center
        // Using sine wave for smooth pendulum effect
        // 3 seconds full period swing
        const swingPeriod = 3000;
        const angle = Math.sin((elapsedMs % swingPeriod) / swingPeriod * Math.PI * 2);

        // Horizontal shift width limits based on size
        const maxShift = Math.max(30, width * 0.25);
        const alienX = (width / 2) + angle * maxShift;
        const alienY = height / 2;

        ctx.save();
        ctx.translate(alienX, alienY);

        // Render Crab-like Alien (approx. 11x8 grid pixels)
        // Set pixel block size based on screen scale (much bolder and larger)
        const pSize = height >= 80 ? 4 : (height >= 50 ? 3 : 2);

        ctx.fillStyle = '#c6ff00'; // Lime green invader look (High Red: 198)

        // Invader 11x8 layout helper
        // Offsets relative to center of alien
        const drawPixel = (px, py) => {
            ctx.fillRect(px * pSize, py * pSize, pSize, pSize);
        };

        // Standard features for both frames (Core body, eyes, antenna)
        // Row 0 (Antenna)
        drawPixel(-4, -4); drawPixel(4, -4);
        // Row 1 (Antenna neck / head top)
        drawPixel(-3, -3); drawPixel(3, -3);
        // Row 2 (Head)
        for (let x = -4; x <= 4; x++) drawPixel(x, -2);
        // Row 3 (Eyes: gaps at -2, 2)
        for (let x = -5; x <= 5; x++) {
            if (x !== -2 && x !== 2) drawPixel(x, -1);
        }
        // Row 4 (Body middle)
        for (let x = -6; x <= 6; x++) drawPixel(x, 0);
        // Row 5 (Mouth line)
        drawPixel(-6, 1); drawPixel(-4, 1); drawPixel(4, 1); drawPixel(6, 1);
        for (let x = -2; x <= 2; x++) drawPixel(x, 1);

        // Frame variations (limbs)
        if (!isFrame2) {
            // Frame 1: Limbs extended outward (arms up, legs down wide)
            // Row 0 arms
            drawPixel(-6, -3); drawPixel(6, -3);
            // Row 1 arms
            drawPixel(-7, -2); drawPixel(7, -2);
            // Row 2 arms
            drawPixel(-7, -1); drawPixel(7, -1);
            // Row 6 limbs
            drawPixel(-6, 2); drawPixel(-5, 2); drawPixel(5, 2); drawPixel(6, 2);
            // Row 7 limbs
            drawPixel(-7, 3); drawPixel(-3, 3); drawPixel(3, 3); drawPixel(7, 3);
        } else {
            // Frame 2: Limbs retracted inward (arms down, legs closer)
            // Row 1 arms down
            drawPixel(-6, -2); drawPixel(6, -2);
            // Row 2 arms down
            drawPixel(-5, -1); drawPixel(5, -1);
            // Row 6 limbs closer
            drawPixel(-4, 2); drawPixel(-3, 2); drawPixel(3, 2); drawPixel(4, 2);
            // Row 7 limbs closer
            drawPixel(-5, 3); drawPixel(-2, 3); drawPixel(2, 3); drawPixel(5, 3);
        }

        ctx.restore();
    }
}
