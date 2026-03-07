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
        author: 'QuickLog-Solo'
    };

    /**
     * Animation Configuration.
     * mode: 'canvas' (default), 'matrix', or 'sprite'
     * usePseudoSpace: If true, the engine provides a virtual width excluding the widest exclusion area.
     */
    config = {
        mode: 'canvas',
        usePseudoSpace: false,
        rewindable: false
    };

    /**
     * Called when the animation starts or the viewport is resized.
     * @param {number} _width - Viewport width (mapped if usePseudoSpace is true)
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
