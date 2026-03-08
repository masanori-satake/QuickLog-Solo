import { AnimationBase } from '../animation_base.js';

/**
 * MigratingBirds Animation
 * Birds flying across the screen in a classic V-formation.
 * 画面を横切ってV字型に飛んでいく渡り鳥の群れです。
 */
export default class MigratingBirds extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Migrating Birds",
            ja: "渡り鳥",
            de: "Zugvögel",
            es: "Aves migratorias",
            fr: "Oiseaux migrateurs",
            pt: "Aves migratórias",
            ko: "철새",
            zh: "候鸟"
        },
        description: {
            en: "Birds flying across the screen in a classic V-formation.",
            ja: "画面を横切ってV字型に飛んでいく渡り鳥の群れです。",
            de: "Vögel, die in einer klassischen V-Formation über den Bildschirm fliegen.",
            es: "Aves volando por la pantalla en una clásica formación en V.",
            fr: "Oiseaux volant à travers l'écran dans une formation classique en V.",
            pt: "Pássaros voando pela tela em uma formação clássica em V.",
            ko: "화면을 가로질러 클래식한 V자 대형으로 날아가는 철새 떼입니다。",
            zh: "候鸟以经典的V字形飞过屏幕。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'sprite', exclusionStrategy: 'pseudo' };

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        // Horizontal center for flight path
        // 飛行経路の垂直方向の中心
        this.yBase = height / 2;

        // Group properties
        // 群れのプロパティ
        this.birdCount = 7;
        this.spacing = 25;
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { elapsedMs = 0, progress = 0 } = {}) {
        const sprites = [];
        const width = this.width;
        const height = this.height;

        // Current horizontal position of the lead bird
        // 先頭の鳥の現在の水平位置
        const xBase = (width + 100) * progress;

        // Draw the V-formation group
        // V字編成の群れを描画
        for (let i = 0; i < this.birdCount; i++) {
            const offset = i - Math.floor(this.birdCount / 2);
            const bx = xBase - Math.abs(offset) * this.spacing;
            const by = this.yBase + offset * this.spacing * 0.5;

            // Wing flap animation / 羽ばたきのアニメーション
            const flap = Math.sin(elapsedMs / 150 + i) > 0;

            // Represent bird with 3 dots (body and wing tips)
            // 鳥を3つのドット（体と翼の先端）で表現
            sprites.push({ x: bx, y: by, size: 2 }); // Body / 体
            if (flap) {
                // Wings up / 翼が上がっている状態
                sprites.push({ x: bx - 8, y: by - 5, size: 1 });
                sprites.push({ x: bx - 8, y: by + 5, size: 1 });
            } else {
                // Wings down / 翼が下がっている状態
                sprites.push({ x: bx - 8, y: by - 1, size: 1 });
                sprites.push({ x: bx - 8, y: by + 1, size: 1 });
            }
        }

        // Surprise bird (flying opposite)
        // 演出：反対方向に飛ぶはぐれ鳥
        if (progress > 0.4 && progress < 0.6) {
            const sx = width + 100 - (width + 200) * (progress - 0.4) * 5;
            const sy = height * 0.2;
            const flap = Math.sin(elapsedMs / 120) > 0;
            sprites.push({ x: sx, y: sy, size: 2 });
            if (flap) {
                sprites.push({ x: sx + 8, y: sy - 4, size: 1 });
                sprites.push({ x: sx + 8, y: sy + 4, size: 1 });
            }
        }

        return sprites;
    }
}
