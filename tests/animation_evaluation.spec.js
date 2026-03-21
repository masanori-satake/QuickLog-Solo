import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { EVAL_CONFIG } from './animation_eval_config.js';

// Helper to get animation IDs from the filesystem, excluding development-only modules
const animationDir = path.join(process.cwd(), 'shared/js/animation');
const animationFiles = fs.readdirSync(animationDir).filter(f => {
    if (!f.endsWith('.js')) return false;
    const content = fs.readFileSync(path.join(animationDir, f), 'utf-8');
    // 正規表現を使い、より堅牢な方法で開発専用モジュールをスキップします
    return !/devOnly:\s*true/.test(content);
});
const animationIds = animationFiles.map(f => f.replace('.js', ''));

test.describe('Animation Quality Evaluation', () => {
    for (const id of animationIds) {
        test(`Evaluating animation: ${id}`, async ({ page }) => {
            // Navigate to the app with test parameters to start a task immediately
            const dbName = `EvalDB_${id}_${Math.random().toString(36).substring(7)}`;
            await page.goto(`/projects/app/app.html?test_cat=EvalTarget&test_elapsed=0&db=${dbName}`);

            // Wait for the app to initialize
            await page.waitForSelector('#animation-canvas');

            // Open settings and select the animation
            await page.click('#settings-toggle');
            await page.selectOption('#animation-select', id);
            await page.click('.close-btn');

            // Evaluation Loop
            const stats = {
                samples: [],
                firstActivityTime: null,
                totalNonZero: 0,
                totalChanged: 0
            };

            let lastPixels = null;
            const startTime = Date.now();

            while (Date.now() - startTime < EVAL_CONFIG.TOTAL_EVALUATION_MS) {
                const sampleResult = await page.evaluate((prevPixels) => {
                    const canvas = document.getElementById('animation-canvas');
                    if (!canvas) return null;
                    const ctx = canvas.getContext('2d');
                    const width = canvas.width;
                    const height = canvas.height;
                    const imgData = ctx.getImageData(0, 0, width, height).data;

                    let nonZero = 0;
                    let changed = 0;

                    const currentPixels = new Uint32Array(width * height);
                    for (let i = 0; i < imgData.length; i += 4) {
                        const r = imgData[i];
                        const g = imgData[i + 1];
                        const b = imgData[i + 2];
                        const val = r + g + b;
                        const idx = i / 4;
                        currentPixels[idx] = val;

                        if (val !== 0) nonZero++;
                        if (prevPixels && val !== prevPixels[idx]) {
                            changed++;
                        }
                    }

                    return {
                        nonZero,
                        changed,
                        currentPixels: Array.from(currentPixels),
                        totalPixels: width * height
                    };
                }, lastPixels);

                if (sampleResult) {
                    const elapsed = Date.now() - startTime;
                    if (stats.firstActivityTime === null && sampleResult.nonZero > 0) {
                        stats.firstActivityTime = elapsed;
                    }

                    stats.samples.push({
                        elapsed,
                        nonZero: sampleResult.nonZero,
                        changed: sampleResult.changed,
                        totalPixels: sampleResult.totalPixels
                    });

                    stats.totalNonZero += sampleResult.nonZero;
                    stats.totalChanged += sampleResult.changed;
                    lastPixels = sampleResult.currentPixels;
                }

                await page.waitForTimeout(EVAL_CONFIG.SAMPLE_INTERVAL_MS);
            }

            // Calculations
            const avgDots = stats.samples.length > 0 ? stats.totalNonZero / stats.samples.length : 0;
            const avgChangeRate = (stats.samples.length > 1)
                ? (stats.totalChanged / (stats.samples.length - 1)) / stats.samples[0].totalPixels
                : 0;

            const sustainedActivity = stats.samples.some(s => s.elapsed >= EVAL_CONFIG.SUSTAINED_ACTIVITY_CHECK_MS && s.changed > 0);

            console.log(`Results for ${id}:`, {
                firstActivityTime: stats.firstActivityTime,
                avgDots,
                avgChangeRate,
                sustainedActivity
            });

            expect(stats.firstActivityTime, `Animation ${id} did not start within threshold`).toBeLessThanOrEqual(EVAL_CONFIG.INITIAL_ACTIVITY_THRESHOLD_MS);
            expect(sustainedActivity, `Animation ${id} did not show sustained activity`).toBe(true);
            expect(avgDots, `Animation ${id} is too sparse (avg dots: ${avgDots})`).toBeGreaterThanOrEqual(EVAL_CONFIG.MIN_AVERAGE_DOTS);
            expect(avgChangeRate, `Animation ${id} is too static (avg change rate: ${avgChangeRate})`).toBeGreaterThanOrEqual(EVAL_CONFIG.MIN_CHANGE_RATE);
        });
    }
});
