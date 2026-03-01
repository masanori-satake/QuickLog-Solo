import { AnimationBase } from '../animations.js';

export default class LeftToRight extends AnimationBase {
    static metadata = {
        name: { en: "Left to Right", ja: "左から右へ" },
        description: { en: "Fills the background from left to right.", ja: "背景を左から右へ塗りつぶします。" },
        author: "QuickLog-Solo"
    };
    draw(ctx, { width, height, progress }) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width * progress, height);
    }
}
