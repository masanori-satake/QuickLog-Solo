import { AnimationBase } from '../animations.js';

export default class Spectrum extends AnimationBase {
    static metadata = {
        name: { en: "Spectrum", ja: "スペクトラム" },
        description: { en: "Audio spectrum analyzer bars that respect UI boundaries.", ja: "UIの境界に配慮したオーディオ・スペクトラムアナライザです。" },
        author: "QuickLog-Solo"
    };

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.barCount = 32;
        this.bars = Array(this.barCount).fill(0).map(() => Math.random() * 50);
        this.targetBars = Array(this.barCount).fill(0).map(() => Math.random() * 100);
        this.peaks = Array(this.barCount).fill(0);
    }

    draw(ctx, { width, height, exclusionAreas }) {
        this.width = width;
        this.height = height;
        const barWidth = width / this.barCount;

        // Animate bars
        for (let i = 0; i < this.barCount; i++) {
            if (Math.abs(this.bars[i] - this.targetBars[i]) < 1) {
                this.targetBars[i] = Math.random() * height * 0.8;
            }
            this.bars[i] += (this.targetBars[i] - this.bars[i]) * 0.15;

            // Peak effect
            if (this.bars[i] > this.peaks[i]) this.peaks[i] = this.bars[i];
            else this.peaks[i] -= 1;

            const x = i * barWidth;
            let barHeight = this.bars[i];

            // Constrain height based on exclusion areas
            exclusionAreas.forEach(area => {
                if (x + barWidth > area.x && x < area.x + area.width) {
                    // Check if the bar would grow from bottom and overlap area
                    // The bar grows from height (bottom) towards 0 (top)
                    // If barHeight reaches a y-coordinate above area.y+area.height, we must cap it.
                    // area.y + area.height is the bottom edge of the area.
                    // If area.y + area.height is close to height, barHeight should be very small.
                    const maxBarHeight = height - (area.y + area.height);
                    if (maxBarHeight > 0) {
                        barHeight = Math.min(barHeight, maxBarHeight);
                    } else {
                        // Area is above the bar's bottom base
                        // The bar starts at 'height' and goes up to 'height - barHeight'
                        // If the area starts at 'area.y', and 'area.y' is less than 'height',
                        // the bar cannot go above 'area.y + area.height' if it is below 'area.y'.
                        // Wait, easier: if (height - barHeight < area.y + area.height && height - barHeight > area.y)
                        // This means the top of the bar is inside the area.
                        // For the spectrum, it's better to just not draw where it's excluded.
                        // But the request asks to respect it. Let's make it "duck" below.
                        const barTop = height - barHeight;
                        const areaBottom = area.y + area.height;
                        if (barTop < areaBottom) {
                           barHeight = Math.max(0, height - areaBottom);
                        }
                    }
                }
            });

            // Draw Bar
            ctx.fillStyle = '#fff';
            ctx.fillRect(x + 1, height - barHeight, barWidth - 2, barHeight);

            // Draw Peak
            ctx.fillRect(x + 1, height - this.peaks[i] - 2, barWidth - 2, 2);
        }
    }
}
