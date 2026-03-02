/**
 * QuickLog-Solo: Animation Module Base Class
 */

export class AnimationBase {
    /**
     * Static metadata for the animation.
     */
    static metadata = {
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
        usePseudoSpace: false
    };

    /**
     * Called when the animation starts or the viewport is resized.
     * @param {number} width - Viewport width (mapped if usePseudoSpace is true)
     * @param {number} height - Viewport height
     */
    setup(width, height) {}

    /**
     * Called every frame to draw the animation.
     * @param {CanvasRenderingContext2D} ctx - Offscreen context (Canvas Mode only).
     * @param {Object} params - Animation parameters (width, height, elapsedMs, progress, step, exclusionAreas).
     * @returns {number[][]|Array<{x,y,size}>|void} - Data based on the selected mode.
     */
    draw(ctx, params) {}

    /**
     * Interaction hooks (Optional)
     */
    onClick(x, y) {}
    onMouseMove(x, y) {}
}
