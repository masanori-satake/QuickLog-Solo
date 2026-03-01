import { AnimationBase } from '../animations.js';

export default class CarDrive extends AnimationBase {
    static metadata = {
        name: {
            en: "Car Drive",
            ja: "カー・ドライブ",
            de: "Auto-Fahrt",
            es: "Conducción de coche",
            fr: "Conduite automobile",
            pt: "Condução de carro",
            ko: "자동차 드라이브",
            zh: "赛车驱动"
        },
        description: {
            en: "90s style pseudo-3D driving game. UI text and trees appear as roadside objects.",
            ja: "90年代風の疑似3Dドライブゲーム。UIのテキストや木々が道路脇のオブジェクトとして登場します。",
            de: "Pseudo-3D-Rennspiel im Stil der 90er Jahre. UI-Text und Bäume erscheinen als Objekte am Straßenrand.",
            es: "Juego de conducción pseudo-3D al estilo de los 90. El texto de la interfaz y los árboles aparecen como objetos al borde de la carretera.",
            fr: "Jeu de conduite pseudo-3D de style années 90. Le texte de l'interface et les arbres apparaissent comme des objets au bord de la route.",
            pt: "Jogo de condução pseudo-3D no estilo dos anos 90. O texto da interface e as árvores aparecem como objetos à beira da estrada.",
            ko: "90년대 스타일의 의사 3D 드라이빙 게임입니다. UI 텍스트와 나무가 도로변의 오브젝트로 나타납니다.",
            zh: "90年代风格的伪3D驾驶游戏。UI文本和树木显示为路边物体。"
        },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.horizonY = height * 0.45;
        this.mountains = Array(5).fill(0).map((_, i) => ({
            x: (i / 5) * width,
            width: width * (0.3 + Math.random() * 0.4),
            height: height * (0.1 + Math.random() * 0.2)
        }));
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;
        this.horizonY = height * 0.45;
        const time = Date.now() / 1000;
        const speed = 5;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, this.horizonY);

        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 20; i++) {
            const sx = (Math.sin(i * 123.45) * 0.5 + 0.5) * width;
            const sy = (Math.cos(i * 678.9) * 0.5 + 0.5) * this.horizonY;
            ctx.fillRect(sx, sy, 1, 1);
        }
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.2;
        const scrollX = (time * 10) % width;
        this.mountains.forEach(m => {
            let mx = (m.x - scrollX + width) % width;
            ctx.beginPath();
            ctx.moveTo(mx, this.horizonY);
            ctx.lineTo(mx + m.width / 2, this.horizonY - m.height);
            ctx.lineTo(mx + m.width, this.horizonY);
            ctx.fill();

            if (mx + m.width > width) {
                let mx2 = mx - width;
                ctx.beginPath();
                ctx.moveTo(mx2, this.horizonY);
                ctx.lineTo(mx2 + m.width / 2, this.horizonY - m.height);
                ctx.lineTo(mx2 + m.width, this.horizonY);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1.0;

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

        // Draw Trees
        const treeTime = (time * speed) % 1;
        for (let i = 0; i < 4; i++) {
            const p = (i / 4 + treeTime / 4) % 1;
            const y = this.horizonY + (p * p) * (height - this.horizonY);
            const w = roadTopWidth + p * (roadBottomWidth - roadTopWidth);
            const side = (i % 2 === 0 ? 1 : -1);
            const tx = width / 2 + side * (w / 2 + 30 * p);
            const size = 20 * p;

            if (p > 0.1) {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.moveTo(tx, y);
                ctx.lineTo(tx - size / 2, y + size);
                ctx.lineTo(tx + size / 2, y + size);
                ctx.fill();
            }
        }

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
}
