import { AnimationBase } from '../animations.js';

export default class LeftToRight extends AnimationBase {
    static metadata = {
        name: { en: "Left to Right", ja: "左から右へ" },
        description: { en: "A simple linear fill that progresses from left to right.", ja: "左から右へと背景を塗りつぶしていく、シンプルな進行インジケーターです。" },
        author: "QuickLog-Solo"
    };
    draw(ctx, { width, height, progress }) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width * progress, height);
    }
}
