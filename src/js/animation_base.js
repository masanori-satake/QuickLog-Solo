/**
 * QuickLog-Solo: Animation Module Base Class
 */

export class AnimationBase {
    /**
     * Static metadata for the animation.
     */
    static metadata = {
        specVersion: '1.0',
        name: 'Base Animation',
        description: 'Template for animations',
        author: 'QuickLog-Solo',
        rewindable: false
    };

    /**
     * Animation Configuration.
     * mode: 'canvas' (default), 'matrix', or 'sprite'
     * exclusionStrategy: 'mask' (default), 'pseudo', or 'ignore'
     */
    config = {
        mode: 'canvas',
        exclusionStrategy: 'mask'
    };

    /**
     * Called when the animation starts or the viewport is resized.
     * @param {number} _width - Viewport width (mapped if exclusionStrategy is 'pseudo')
     * @param {number} _height - Viewport height
     */
    setup(_width, _height) {}

    /**
     * Called every frame to draw the animation.
     * @param {CanvasRenderingContext2D} _ctx - Offscreen context (Canvas Mode only).
     * @param {Object} _params - Animation parameters (elapsedMs, progress, step, exclusionAreas).
     * @returns {number[][]|Array<{x,y,size}>|void} - Data based on the selected mode.
     */
    draw(_ctx, _params) {}

    /**
     * Interaction hooks (Optional)
     */
    onClick(_x, _y) {}
    onMouseMove(_x, _y) {}
}
