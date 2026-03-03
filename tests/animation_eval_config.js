/**
 * Configuration for Animation Evaluation System
 * These parameters define the thresholds for an animation to be considered "interesting" and "active".
 */

export const EVAL_CONFIG = {
    // Time (ms) within which the first visual change must appear after starting.
    // Set to 15s to accommodate animations with slow starts like 'Migrating Birds'.
    INITIAL_ACTIVITY_THRESHOLD_MS: 15000,

    // Time (ms) at which to verify if the animation is still producing changes.
    SUSTAINED_ACTIVITY_CHECK_MS: 8000,

    // Minimum average number of "active" dots (non-zero pixels in LCD style) per sample.
    MIN_AVERAGE_DOTS: 5,

    // Minimum percentage of pixel change between samples to be considered "active".
    MIN_CHANGE_RATE: 0.0001,

    // Interval (ms) between evaluation samples.
    SAMPLE_INTERVAL_MS: 500,

    // Total duration (ms) to run each animation for evaluation.
    TOTAL_EVALUATION_MS: 20000
};
