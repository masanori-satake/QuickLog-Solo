import { AnimationBase } from '../animation_base.js';

/**
 * NewtonsCradle Animation
 * A simulation of the classic physical office toy.
 * 古典的な物理玩具である「ニュートンのゆりかご」のシミュレーションです。
 */
export default class NewtonsCradle extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Newton's Cradle",
            ja: "ニュートンのゆりかご",
            de: "Newton-Pendel",
            es: "Cuna de Newton",
            fr: "Pendule de Newton",
            pt: "Berço de Newton",
            ko: "뉴턴의 요람",
            zh: "牛顿摆"
        },
        description: {
            en: "A simulation of the classic physical office toy.",
            ja: "古典的な物理玩具である「ニュートンのゆりかご」のシミュレーションです。",
            de: "Eine simulation des klassischen physikalischen Bürospielzeugs.",
            es: "Una simulación del clásico juguete físico de oficina.",
            fr: "Une simulation du jouet de bureau physique classique.",
            pt: "Uma simulação do clássico brinquedo físico de escritório.",
            ko: "고전적인 물리 사무용 장난감인 '뉴턴의 요람' 시ミュ레이션입니다。",
            zh: "经典办公物理玩具的模拟。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'mask' };

    constructor() {
        super();
        this.ballCount = 0;
        this.ballRadius = 0;
        this.stringLength = 0;
    }

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        // Physics properties
        // 物理的なプロパティ
        this.ballCount = 5;
        this.ballRadius = 10;
        this.stringLength = height / 2;
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { elapsedMs = 0, progress = 0, exclusionAreas = [] } = {}) {
        const width = this.width;
        const height = this.height;
        const stringLength = this.stringLength;

        // Total width of the cradle
        // 装置全体の幅
        const totalW = this.ballRadius * 2 * this.ballCount;

        // Find a safe spot for the cradle (default to center-ish)
        // 安全な（UIと重ならない）配置場所を探す
        let centerX = width * 0.15 + totalW / 2;
        let centerY = height / 3;

        if (exclusionAreas && exclusionAreas.length > 0) {
            const h = stringLength + this.ballRadius;
            const spots = [
                {x: totalW/2 + 20, y: height/3},
                {x: width - totalW/2 - 20, y: height/3},
                {x: width * 0.25, y: height / 3},
                {x: width * 0.75, y: height / 3}
            ];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot.x + totalW/2 > area.x && spot.x - totalW/2 < area.x + area.width &&
                           spot.y + h > area.y && spot.y < area.y + area.height;
                });
                if (!overlap) {
                    centerX = spot.x;
                    centerY = spot.y;
                    break;
                }
            }
        }

        ctx.strokeStyle = '#fff';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 1;

        // Swing amplitude fluctuates slightly over time
        // 振幅を時間とともにわずかに変化させる
        const amplitude = Math.PI / 6 * (1 + 0.2 * Math.sin(progress * Math.PI * 10));
        const time = elapsedMs / 300;
        const angle = Math.sin(time);

        // Draw each ball and its string
        // 各ボールと紐を描画
        for (let i = 0; i < this.ballCount; i++) {
            let currentAngle = 0;
            // Only the outer balls swing
            // 端のボールだけが振れるように制御
            if (i === 0 && angle < 0) currentAngle = angle * amplitude;
            if (i === this.ballCount - 1 && angle > 0) currentAngle = angle * amplitude;

            // Pivot point X for each ball
            // 各ボールの支点位置
            const pivotX = centerX + (i - (this.ballCount - 1) / 2) * this.ballRadius * 2;

            // Calculate ball position based on angle
            // 角度に基づいてボールの位置を計算
            const bx = pivotX + Math.sin(currentAngle) * stringLength;
            const by = centerY + Math.cos(currentAngle) * stringLength;

            // Draw string / 紐を描画
            ctx.beginPath();
            ctx.moveTo(pivotX, centerY);
            ctx.lineTo(bx, by);
            ctx.stroke();

            // Draw ball / ボールを描画
            ctx.beginPath();
            ctx.arc(bx, by, this.ballRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
