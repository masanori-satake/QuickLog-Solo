import { AnimationBase } from '../animations.js';

export default class RightToLeft extends AnimationBase {
    static metadata = {
        name: { en: "Right to Left", ja: "右から左へ" },
        description: { en: "Fills the background from right to left.", ja: "背景を右から左へ塗りつぶします。" },
        author: "QuickLog-Solo"
    };
    draw(ctx, { width, height, progress }) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(width * (1 - progress), 0, width * progress, height);
    }
}
