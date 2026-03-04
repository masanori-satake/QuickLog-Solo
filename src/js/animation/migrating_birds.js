import { AnimationBase } from '../animation_base.js';

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
            ko: "화면을 가로질러 클래식한 V자 대형으로 날아가는 철새 떼입니다.",
            zh: "候鸟以经典的V字形飞过屏幕。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'sprite', usePseudoSpace: true };

    setup(width, height) {
        this.w = width;
        this.h = height;
        this.yBase = height / 2;
        this.birdCount = 7;
        this.spacing = 25;
    }

    draw(ctx, { progress }) {
        const sprites = [];
        // Start with the lead bird at x=0 when progress=0 to ensure immediate visibility.
        const xBase = (this.w + 100) * progress;

        for (let i = 0; i < this.birdCount; i++) {
            const offset = i - Math.floor(this.birdCount / 2);
            const bx = xBase - Math.abs(offset) * this.spacing;
            const by = this.yBase + offset * this.spacing * 0.5;

            const flap = Math.sin(Date.now() / 150 + i) > 0;

            // Represent bird with 3 dots (body and wing tips)
            sprites.push({ x: bx, y: by, size: 2 }); // Body
            if (flap) {
                sprites.push({ x: bx - 8, y: by - 5, size: 1 });
                sprites.push({ x: bx - 8, y: by + 5, size: 1 });
            } else {
                sprites.push({ x: bx - 8, y: by - 1, size: 1 });
                sprites.push({ x: bx - 8, y: by + 1, size: 1 });
            }
        }

        // Surprise bird (flying opposite)
        if (progress > 0.4 && progress < 0.6) {
            const sx = this.w + 100 - (this.w + 200) * (progress - 0.4) * 5;
            const sy = this.h * 0.2;
            const flap = Math.sin(Date.now() / 120) > 0;
            sprites.push({ x: sx, y: sy, size: 2 });
            if (flap) {
                sprites.push({ x: sx + 8, y: sy - 4, size: 1 });
                sprites.push({ x: sx + 8, y: sy + 4, size: 1 });
            }
        }

        return sprites;
    }
}
