import { AnimationBase } from '../animations.js';

export default class Tennis extends AnimationBase {
    static metadata = {
        name: {
            en: "Tennis",
            ja: "テニス",
            de: "Tennis",
            es: "Tenis",
            fr: "Tennis",
            pt: "Tênis",
            ko: "테니스",
            zh: "网球"
        },
        description: {
            en: "An 80s-inspired tennis game where the ball bounces off paddles and UI elements.",
            ja: "80年代のテニスゲームをイメージした、パドルやUI要素でボールが跳ね返るアニメーションです。",
            de: "Ein von den 80er Jahren inspiriertes Tennisspiel, bei dem der Ball von Schlägern und UI-Elementen abprallt.",
            es: "Un juego de tenis inspirado en los 80 donde la pelota rebota en las raquetas y los elementos de la interfaz.",
            fr: "Un jeu de tennis inspiré des années 80 où la balle rebondit sur les raquettes et les éléments de l'interface.",
            pt: "Um jogo de tênis inspirado nos anos 80, onde a bola rebate nas raquetes e nos elementos da interface.",
            ko: "80년대에서 영감을 받은 테니스 게임으로, 공이 패들과 UI 요소에서 튕겨 나옵니다.",
            zh: "受80年代启发的网球游戏，球会在球拍和UI元素上反弹。"
        },
        author: "QuickLog-Solo"
    };

    config = { mode: 'canvas', usePseudoSpace: false };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.ball = { x: width / 2, y: height / 2, vx: 2, vy: 1.5, radius: 4 };
        this.paddleWidth = 6;
        this.paddleHeight = 30;
        this.paddleL = { y: height / 2 - 15, targetY: height / 2 - 15 };
        this.paddleR = { y: height / 2 - 15, targetY: height / 2 - 15 };
        this.scoreL = 0;
        this.scoreR = 0;
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;

        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        if (this.ball.y - this.ball.radius < 0) {
            this.ball.y = this.ball.radius;
            this.ball.vy = Math.abs(this.ball.vy);
        } else if (this.ball.y + this.ball.radius > height) {
            this.ball.y = height - this.ball.radius;
            this.ball.vy = -Math.abs(this.ball.vy);
        }

        if (this.ball.vx < 0) {
            this.paddleL.targetY = this.ball.y - this.paddleHeight / 2;
        } else {
            this.paddleR.targetY = this.ball.y - this.paddleHeight / 2;
        }

        this.paddleL.y += (this.paddleL.targetY - this.paddleL.y) * 0.1;
        this.paddleR.y += (this.paddleR.targetY - this.paddleR.y) * 0.1;

        this.paddleL.y = Math.max(0, Math.min(height - this.paddleHeight, this.paddleL.y));
        this.paddleR.y = Math.max(0, Math.min(height - this.paddleHeight, this.paddleR.y));

        if (this.ball.x - this.ball.radius < this.paddleWidth) {
            if (this.ball.y > this.paddleL.y - 5 && this.ball.y < this.paddleL.y + this.paddleHeight + 5) {
                this.ball.vx = Math.abs(this.ball.vx);
                this.ball.x = this.paddleWidth + this.ball.radius;
            } else if (this.ball.x < -20) {
                this.scoreR++;
                this.resetBall(width, height);
            }
        } else if (this.ball.x + this.ball.radius > width - this.paddleWidth) {
            if (this.ball.y > this.paddleR.y - 5 && this.ball.y < this.paddleR.y + this.paddleHeight + 5) {
                this.ball.vx = -Math.abs(this.ball.vx);
                this.ball.x = width - this.paddleWidth - this.ball.radius;
            } else if (this.ball.x > width + 20) {
                this.scoreL++;
                this.resetBall(width, height);
            }
        }

        exclusionAreas.forEach(area => {
            if (this.ball.x + this.ball.radius > area.x &&
                this.ball.x - this.ball.radius < area.x + area.width &&
                this.ball.y + this.ball.radius > area.y &&
                this.ball.y - this.ball.radius < area.y + area.height) {

                const overlapX = Math.min(this.ball.x + this.ball.radius - area.x, area.x + area.width - (this.ball.x - this.ball.radius));
                const overlapY = Math.min(this.ball.y + this.ball.radius - area.y, area.y + area.height - (this.ball.y - this.ball.radius));

                if (overlapX < overlapY) {
                    this.ball.vx *= -1;
                    this.ball.x += (this.ball.vx > 0 ? 1 : -1) * (overlapX + 2);
                } else {
                    this.ball.vy *= -1;
                    this.ball.y += (this.ball.vy > 0 ? 1 : -1) * (overlapY + 2);
                }
            }
        });

        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#fff';

        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillText(this.scoreL, width / 2 - 30, 20);
        ctx.fillText(this.scoreR, width / 2 + 20, 20);

        ctx.fillRect(this.ball.x - this.ball.radius, this.ball.y - this.ball.radius, this.ball.radius * 2, this.ball.radius * 2);
        ctx.fillRect(0, this.paddleL.y, this.paddleWidth, this.paddleHeight);
        ctx.fillRect(width - this.paddleWidth, this.paddleR.y, this.paddleWidth, this.paddleHeight);
    }

    resetBall(width, height) {
        this.ball.x = width / 2;
        this.ball.y = height / 2;
        this.ball.vx = (Math.random() > 0.5 ? 2 : -2);
        this.ball.vy = (Math.random() - 0.5) * 3;
    }
}
