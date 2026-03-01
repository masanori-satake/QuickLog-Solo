import { AnimationBase } from '../animations.js';

export default class Tennis extends AnimationBase {
    static metadata = {
        name: { en: "Tennis", ja: "テニス" },
        description: { en: "80s style tennis game. Ball bounces off paddles and text.", ja: "80年代風テニスゲーム。ボールがパドルやテキストで跳ね返ります。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.ball = { x: width / 2, y: height / 2, vx: 3, vy: 2, radius: 4 };
        this.paddleWidth = 6;
        this.paddleHeight = 30;
        this.paddleL = { y: height / 2 - 15 };
        this.paddleR = { y: height / 2 - 15 };
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;

        // Move ball
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        // Bounce off top/bottom
        if (this.ball.y - this.ball.radius < 0 || this.ball.y + this.ball.radius > height) {
            this.ball.vy *= -1;
        }

        // AI Paddles
        const targetL = this.ball.y - this.paddleHeight / 2;
        this.paddleL.y += (targetL - this.paddleL.y) * 0.1;
        const targetR = this.ball.y - this.paddleHeight / 2;
        this.paddleR.y += (targetR - this.paddleR.y) * 0.1;

        // Constraint paddles
        this.paddleL.y = Math.max(0, Math.min(height - this.paddleHeight, this.paddleL.y));
        this.paddleR.y = Math.max(0, Math.min(height - this.paddleHeight, this.paddleR.y));

        // Bounce off paddles
        if (this.ball.x - this.ball.radius < this.paddleWidth) {
            if (this.ball.y > this.paddleL.y && this.ball.y < this.paddleL.y + this.paddleHeight) {
                this.ball.vx = Math.abs(this.ball.vx);
            } else if (this.ball.x < 0) {
                this.ball.x = width / 2; // Reset
            }
        }
        if (this.ball.x + this.ball.radius > width - this.paddleWidth) {
            if (this.ball.y > this.paddleR.y && this.ball.y < this.paddleR.y + this.paddleHeight) {
                this.ball.vx = -Math.abs(this.ball.vx);
            } else if (this.ball.x > width) {
                this.ball.x = width / 2; // Reset
            }
        }

        // Bounce off exclusionAreas
        exclusionAreas.forEach(area => {
            if (this.ball.x + this.ball.radius > area.x &&
                this.ball.x - this.ball.radius < area.x + area.width &&
                this.ball.y + this.ball.radius > area.y &&
                this.ball.y - this.ball.radius < area.y + area.height) {

                // Simple collision response
                const overlapX = Math.min(this.ball.x + this.ball.radius - area.x, area.x + area.width - (this.ball.x - this.ball.radius));
                const overlapY = Math.min(this.ball.y + this.ball.radius - area.y, area.y + area.height - (this.ball.y - this.ball.radius));

                if (overlapX < overlapY) {
                    this.ball.vx *= -1;
                    this.ball.x += this.ball.vx * 2;
                } else {
                    this.ball.vy *= -1;
                    this.ball.y += this.ball.vy * 2;
                }
            }
        });

        // Draw everything
        ctx.fillStyle = '#fff';
        // Ball
        ctx.fillRect(this.ball.x - this.ball.radius, this.ball.y - this.ball.radius, this.ball.radius * 2, this.ball.radius * 2);
        // Paddles
        ctx.fillRect(0, this.paddleL.y, this.paddleWidth, this.paddleHeight);
        ctx.fillRect(width - this.paddleWidth, this.paddleR.y, this.paddleWidth, this.paddleHeight);

        // Center line
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}
