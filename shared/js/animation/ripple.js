import { AnimationBase } from '../animation_base.js';

/**
 * Ripple Animation
 * Dynamic concentric ripples that expand and fade across the background.
 * 画面いっぱいに広がり、消えていくダイナミックな同心円状の波紋です。
 */
export default class Ripple extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Ripple",
            ja: "波紋",
            de: "Wellen",
            es: "Ondas",
            fr: "Ondulations",
            pt: "Ondulações",
            ko: "파문",
            zh: "涟漪"
        },
        description: {
            en: "Dynamic concentric ripples that expand and fade across the background.",
            ja: "画面いっぱいに広がり、消えていくダイナミックな同心円状の波紋です。",
            de: "Dynamische konzentrische Wellen, die sich über den Hintergrund ausbreiten und verblassen.",
            es: "Ondas concéntricas dinámicas que se expanden y se desvanecen por el fondo.",
            fr: "Ondulations concentriques dynamiques qui s'étendent et s'estompent sur l'arrière-plan.",
            pt: "Ondulações concêntricas dinâmicas que se expandem e desaparecem pelo fundo.",
            ko: "배경을 가로질러 확장되고 사라지는 다이내믹한 동심원 파문입니다。",
            zh: "动态同心涟漪在背景中扩散并淡出。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.ripples = [];
        this.maxRadius = 0;
    }

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
        this.ripples = [];
        // Diagonal distance to ensure ripples can cover the whole screen
        // 画面全体をカバーできる対角線の長さを計算
        this.maxRadius = Math.sqrt(width * width + height * height) / 2;
    }

    /**
     * Interaction: Add a ripple where clicked
     * インタラクション：クリックした場所に波紋を追加
     */
    onClick(x, y) {
        this.ripples.push({
            x, y,
            radius: 0,
            life: 1.0,
            speed: 2
        });
    }

    /**
     * Main drawing and update loop
     * 描画および更新ループ
     */
    draw(ctx, { progress = 0 } = {}) {
        const width = this.width;
        const height = this.height;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;

        // 1. Randomly add new ripple sources
        // 1. ランダムに新しい波紋を追加
        if (Math.random() < 0.05 + progress * 0.1) {
            this.ripples.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: 0,
                life: 1.0,
                speed: 1 + Math.random() * 1.5
            });
        }

        // 2. Animate and Draw Ripples
        // 2. 波紋の更新と描画
        this.ripples.forEach((r) => {
            r.radius += r.speed;
            r.life -= 0.01;

            // Outer circle / 外側の円
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.globalAlpha = r.life * 0.5;
            ctx.stroke();

            // Inner circle (double ripple effect) / 内側の円（二重の波紋）
            if (r.radius > 10) {
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.radius - 10, 0, Math.PI * 2);
                ctx.globalAlpha = r.life * 0.3;
                ctx.stroke();
            }
        });

        // 3. Remove finished ripples
        // 3. 終わった波紋を削除
        this.ripples = this.ripples.filter(r => r.life > 0 && r.radius < this.maxRadius);

        ctx.globalAlpha = 1.0;
    }
}
