import { AnimationBase } from '../animation_base.js';

/**
 * CarDrive Animation
 * 90s style pseudo-3D driving game.
 * 90年代風の疑似3Dドライブゲームです。
 */
export default class CarDrive extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Car Drive",
            ja: "カー・ドライブ",
            de: "Auto-Fahrt",
            es: "Conducción de coche",
            fr: "Conduite automobile",
            pt: "Condução de carro",
            ko: "자동차 드ライ브",
            zh: "赛车驱动"
        },
        description: {
            en: "90s style pseudo-3D driving game. UI text and trees appear as roadside objects.",
            ja: "90年代風の疑似3Dドライブゲーム。UIのテキストや木々が道路脇のオブジェクトとして登場します。",
            de: "Pseudo-3D-Rennspiel im Stil der 90er Jahre. UI-Text und Bäume erscheinen als Objekte am Straßenrand.",
            es: "Juego de conducción pseudo-3D al estilo de los 90. El texto de la interfaz y los árboles aparecen como objetos al borde de la carretera.",
            fr: "Jeu de conduite pseudo-3D de style années 90. El texte de l'interface et les arbres apparaissent comme des objets au bord de la route.",
            pt: "Jogo de condução pseudo-3D no estilo dos anos 90. O texto da interface e as árvores aparecem como objetos à beira da estrada.",
            ko: "90년대 스타일의 의사 3D 드라이빙 게임입니다. UI 텍스트와 나무가 도로변의 오브ジェクト로 나타납니다.",
            zh: "90年代风格的伪3D驾驶游戏。UI文本和树木显示为路边物体。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'mask' };

    constructor() {
        super();
        this.mountains = [];
        this.stars = [];
        this.horizonY = 0;
    }

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        // Calculate horizon line (45% from top)
        // 地平線の位置を計算（上から45%の位置）
        this.horizonY = height * 0.45;

        // Initialize mountains background
        // 背景の山の初期化
        this.mountains = Array(5).fill(0).map((_, i) => ({
            x: (i / 5) * width,
            width: width * (0.3 + Math.random() * 0.4),
            height: height * (0.1 + Math.random() * 0.2)
        }));

        // Stars for the night sky
        // 夜空の星
        this.stars = Array(20).fill(0).map(() => ({
            x: Math.random() * width,
            y: Math.random() * this.horizonY
        }));
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { elapsedMs, exclusionAreas = [] } = {}) {
        const width = this.width;
        const height = this.height;
        const time = elapsedMs / 1000;
        const speed = 5;

        // 1. Sky Background (Top half)
        // 1. 空の背景（上半分）
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, this.horizonY);

        // Draw static stars
        // 星の描画
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;
        this.stars.forEach(star => {
            ctx.fillRect(star.x, star.y, 1, 1);
        });
        ctx.globalAlpha = 1.0;

        // 2. Mountains (Parallax scrolling)
        // 2. 山（パララックス・スクロール）
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.2;
        const scrollX = (time * 10) % width;
        this.mountains.forEach(m => {
            let mx = (m.x - scrollX + width) % width;
            this.drawMountain(ctx, mx, this.horizonY, m.width, m.height);

            // Handle wrapping around screen edges
            // 画面端でのループ処理
            if (mx + m.width > width) {
                this.drawMountain(ctx, mx - width, this.horizonY, m.width, m.height);
            }
        });
        ctx.globalAlpha = 1.0;

        // 3. Road (Perspective view)
        // 3. 道路（遠近法）
        ctx.fillStyle = '#fff';
        const roadBottomWidth = width * 0.8;
        const roadTopWidth = 20;
        ctx.beginPath();
        ctx.moveTo(width / 2 - roadTopWidth / 2, this.horizonY);
        ctx.lineTo(width / 2 + roadTopWidth / 2, this.horizonY);
        ctx.lineTo(width / 2 + roadBottomWidth / 2, height);
        ctx.lineTo(width / 2 - roadBottomWidth / 2, height);
        ctx.closePath();
        ctx.fill();

        // Road center line
        // 道路の中央線
        const roadTime = (time * speed) % 1;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const p = (i / 5 + roadTime / 5) % 1;
            const y = this.horizonY + (p * p) * (height - this.horizonY);
            ctx.beginPath();
            ctx.moveTo(width / 2, y);
            ctx.lineTo(width / 2, y + 10 * p);
            ctx.stroke();
        }

        // 4. Roadside Objects (Trees/Buildings)
        // 4. 道路脇のオブジェクト（木やビル）
        const objectSpeed = speed * 0.8;
        const objectTime = (time * objectSpeed) % 1;
        for (let i = 0; i < 10; i++) {
            const pRaw = (i / 10 + objectTime) % 1;
            const p = pRaw * pRaw; // Non-linear for perspective / 遠近感を出すための非線形補間
            const y = this.horizonY + p * (height - this.horizonY);
            const w = roadTopWidth + p * (roadBottomWidth - roadTopWidth);
            const side = (i % 2 === 0 ? 1 : -1);
            const tx = width / 2 + side * (w / 2 + 60 * p);
            const size = 5 + 50 * p;

            if (p > 0.01) {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                if ((i + Math.floor(time * objectSpeed)) % 3 === 0) { // Building / ビル
                    ctx.rect(tx - size / 2, y - size, size, size);
                } else { // Tree / 木
                    ctx.moveTo(tx, y - size);
                    ctx.lineTo(tx - size / 3, y);
                    ctx.lineTo(tx + size / 3, y);
                }
                ctx.fill();
            }
        }

        // 5. UI Exclusion Areas (Visualized as roadside signs)
        // 5. テキスト領域の回避（道路脇の看板として表現）
        exclusionAreas.forEach((area) => {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(area.x - 2, area.y - 2, area.width + 4, area.height + 4);
            ctx.beginPath();
            const sideX = (area.x + area.width / 2 < width / 2) ? area.x : area.x + area.width;
            ctx.moveTo(sideX, area.y + area.height);
            ctx.lineTo(sideX, height);
            ctx.stroke();
        });

        // 6. Player Car
        // 6. 自車
        const carWidth = 40;
        const carHeight = 20;
        const drift = Math.sin(time * 2) * 20;
        const cx = width / 2 + drift;
        const cy = height - 30;

        ctx.fillStyle = '#000';
        ctx.fillRect(cx - carWidth / 2, cy, carWidth, carHeight);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - carWidth / 2 + 2, cy + 2, carWidth - 4, carHeight - 4);
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - carWidth / 2 + 6, cy + 4, carWidth - 12, carHeight / 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - carWidth / 2 + 4, cy + carHeight - 6, 6, 3);
        ctx.fillRect(cx + carWidth / 2 - 10, cy + carHeight - 6, 6, 3);
    }

    /**
     * Helper to draw a mountain
     * 山を描画するためのヘルパー関数
     */
    drawMountain(ctx, x, y, w, h) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w / 2, y - h);
        ctx.lineTo(x + w, y);
        ctx.fill();
    }
}
