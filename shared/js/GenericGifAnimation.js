/**
 * QuickLog-Solo: Generic GIF Sprite Animation Renderer
 * Extends AnimationBase. Downsamples sprite frames dynamically.
 */

import { AnimationBase } from './animation_base.js';

export default class GenericGifAnimation extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: { en: 'Custom GIF Sprite', ja: 'カスタムGIFスプライト' },
        description: { en: 'User uploaded sprite sheet', ja: 'ユーザーが読み込んだスプライトシート' },
        author: 'User',
        rewindable: true
    };

    constructor(imageData, renderSpec) {
        super();
        this.imageData = imageData; // Base64 or Blob URL
        this.renderSpec = renderSpec || { frameWidth: 6, frameHeight: 6, frameCount: 1, fps: 10, zoom: 1 };
        this.image = null;
        this.loaded = false;
        this.width = 100;
        this.height = 100;
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
        if (!this.image && this.imageData) {
            this.image = new Image();
            this.image.onload = () => {
                this.loaded = true;
            };
            this.image.src = this.imageData;
        }
    }

    draw(ctx, params) {
        if (!this.loaded || !ctx) return;
        const { elapsedMs } = params;
        const { frameWidth, frameHeight, frameCount = 1, fps = 10, zoom = 1 } = this.renderSpec;

        const currentFps = fps || 10;
        const frameIndex = Math.floor((elapsedMs * currentFps) / 1000) % (frameCount || 1);

        ctx.clearRect(0, 0, this.width, this.height);

        const drawWidth = frameWidth * zoom;
        const drawHeight = frameHeight * zoom;
        const dx = (this.width - drawWidth) / 2;
        const dy = (this.height - drawHeight) / 2;

        ctx.drawImage(
            this.image,
            frameIndex * frameWidth, 0, frameWidth, frameHeight,
            dx, dy, drawWidth, drawHeight
        );
    }
}
