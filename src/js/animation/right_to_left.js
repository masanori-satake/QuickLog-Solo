import { AnimationBase } from '../animations.js';

export default class RightToLeft extends AnimationBase {
    static metadata = {
        name: { en: "Right to Left", ja: "右から左へ" },
        description: { en: "A simple linear fill that progresses from right to left.", ja: "右から左へと背景を塗りつぶしていく、シンプルな進行インジケーターです。" },
        author: "QuickLog-Solo"
    };
    draw(ctx, { width, height, progress }) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(width * (1 - progress), 0, width * progress, height);
    }
}
