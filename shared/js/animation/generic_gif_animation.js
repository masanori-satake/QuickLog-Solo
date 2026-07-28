import { AnimationBase } from '../animation_base.js';
import { initAnimationDraftDB, getAnimationDraftRecord } from '../idb_storage.js';

export default class GenericGifAnimation extends AnimationBase {
    static metadata = {
        specVersion: '1.1',
        name: {
            ja: 'カスタムGIF',
            en: 'Custom GIF'
        },
        description: {
            ja: 'ユーザーがインポートしたカスタムGIFアニメーション',
            en: 'Custom GIF animation imported by user'
        },
        author: 'User',
        rewindable: true
    };

    config = {
        mode: 'canvas',
        exclusionStrategy: 'mask'
    };

    constructor() {
        super();
        this.currentId = null;
        this.isLoading = false;
        this.frames = []; // Array of { bitmap, duration }
        this.totalDuration = 0;
        this.renderSpec = null;
    }

    /**
     * Resets the animation state.
     */
    reset() {
        this.frames.forEach(f => {
            if (f.bitmap && typeof f.bitmap.close === 'function') {
                f.bitmap.close();
            }
        });
        this.frames = [];
        this.totalDuration = 0;
        this.renderSpec = null;
        this.currentId = null;
        this.isLoading = false;
        this.config = {
            mode: 'canvas',
            exclusionStrategy: 'mask'
        };
    }

    /**
     * Loads the custom GIF from IndexedDB and decodes its frames.
     */
    async loadCustomGif(id, isDraft = false) {
        if (this.isLoading || this.currentId === id) return;
        this.reset();
        this.currentId = id;
        this.isLoading = true;

        try {
            // 1. Try loading from Draft DB first
            let record = null;
            if (isDraft) {
                try {
                    await initAnimationDraftDB();
                    record = await getAnimationDraftRecord(id);
                } catch (err) {
                    console.warn('GenericGifAnimation: Failed to access Draft DB', err);
                    record = null;
                }
            }

            // Check for tombstone (deleted record)
            if (record && record.deleted) {
                console.warn(`GenericGifAnimation: Animation "${id}" is marked as deleted`);
                this.isLoading = false;
                return;
            }

            // 2. Fall back to Production DB
            if (!record) {
                record = await new Promise((resolve, reject) => {
                    const req = indexedDB.open('QuickLogAnimationDB', 1);
                    req.onsuccess = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('blobs')) {
                            resolve(null);
                            return;
                        }
                        const tx = db.transaction('blobs', 'readonly');
                        const store = tx.objectStore('blobs');
                        const getReq = store.get(id);
                        getReq.onsuccess = () => resolve(getReq.result || null);
                        getReq.onerror = () => reject(getReq.error);
                    };
                    req.onerror = () => reject(req.error);
                });
            }

            if (!record || !record.blob) {
                console.warn(`GenericGifAnimation: No GIF data found for custom ID "${id}"`);
                this.isLoading = false;
                return;
            }

            this.renderSpec = record.renderSpec || {
                focusX: 0,
                focusY: 0,
                targetHeight: 100,
                maxWidth: 2030,
                scaleWithHeight: false,
                overflowBehavior: 'categoryColor'
            };
            this.config = {
                mode: 'canvas',
                exclusionStrategy: (record.config && record.config.exclusionStrategy) || 'mask'
            };

            // Parse GIF using browser native ImageDecoder if available
            if (typeof ImageDecoder !== 'undefined') {
                const response = record.blob;
                const buffer = await response.arrayBuffer();
                const decoder = new ImageDecoder({ data: buffer, type: 'image/gif' });

                if (!decoder.tracks) {
                    throw new Error('ImageDecoder tracks list is undefined.');
                }

                // Correctly wait for the tracks to populate
                await decoder.tracks.ready;

                const track = decoder.tracks.selectedTrack;
                if (!track) {
                    throw new Error('ImageDecoder selectedTrack is null or undefined.');
                }

                const frameCount = track.frameCount;
                if (typeof frameCount !== 'number' || frameCount <= 0) {
                    throw new Error(`Invalid frameCount: ${frameCount}`);
                }

                let accumulatedDuration = 0;

                for (let i = 0; i < frameCount; i++) {
                    const result = await decoder.decode({ frameIndex: i });
                    const videoFrame = result.image;

                    // Convert VideoFrame to standard ImageBitmap for ultra-fast rendering
                    const bitmap = await createImageBitmap(videoFrame);
                    videoFrame.close(); // Crucial to prevent native memory leaks

                    // Get frame duration in milliseconds (decoder exposes microseconds)
                    let frameDuration = (videoFrame.duration || 100000) / 1000;
                    if (frameDuration <= 0) frameDuration = 100; // Default fallback

                    this.frames.push({
                        bitmap,
                        duration: frameDuration
                    });
                    accumulatedDuration += frameDuration;
                }

                this.totalDuration = accumulatedDuration;
            } else {
                console.warn('GenericGifAnimation: ImageDecoder API is not supported in this environment.');
            }
        } catch (err) {
            console.error('GenericGifAnimation: Failed to decode custom GIF:', err);
            this.reset();
        } finally {
            this.isLoading = false;
        }
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
    }

    draw(ctx, params) {
        if (!ctx) return;

        const customId = params.customAnimationId;
        if (!customId) return;

        // Lazy load GIF if changed
        if (this.currentId !== customId && !this.isLoading) {
            this.loadCustomGif(customId, params.isDraft);
            return;
        }

        if (this.frames.length === 0 || !this.renderSpec) {
            // No frames loaded yet, draw nothing
            return;
        }

        // Determine current frame based on elapsed time and loop duration
        const elapsed = params.elapsedMs || 0;
        const currentMs = elapsed % this.totalDuration;

        let frameIndex = 0;
        let runningSum = 0;
        for (let i = 0; i < this.frames.length; i++) {
            runningSum += this.frames[i].duration;
            if (currentMs < runningSum) {
                frameIndex = i;
                break;
            }
        }

        const frame = this.frames[frameIndex];
        if (!frame || !frame.bitmap) return;

        const imgWidth = frame.bitmap.width;
        const imgHeight = frame.bitmap.height;

        // Scaling factor math
        let S = 1.0;
        if (this.renderSpec.scaleWithHeight) {
            // S is relative to the canvas height divided by targetHeight
            const targetH = this.renderSpec.targetHeight || 100;
            S = this.height / targetH;
        }

        const scaledW = imgWidth * S;
        const scaledH = imgHeight * S;

        const focusX = this.renderSpec.focusX || 0;
        const focusY = this.renderSpec.focusY || 0;

        // Destination X & Y to align scaled focus point on the center of the canvas
        const destX = (this.width / 2) - (focusX * S);
        const destY = (this.height / 2) - (focusY * S);

        // maxWidth clamping math
        const maxW = this.renderSpec.maxWidth || this.width;
        const scaledMaxW = maxW * S;
        const clipLeft = (this.width / 2) - (scaledMaxW / 2);

        // Save context state for clipping and color fills
        ctx.save();

        // Apply brightness adjustment if configured
        if (this.renderSpec.brightness !== undefined && this.renderSpec.brightness !== 1.0) {
            ctx.filter = `brightness(${this.renderSpec.brightness})`;
        }

        // 1. Clip horizontal area according to maxWidth
        ctx.beginPath();
        ctx.rect(clipLeft, 0, scaledMaxW, this.height);
        ctx.clip();

        // 2. Render background / overflow color
        // Fill underlay background: always pure white (#ffffff) to ensure correct downsampled dot behavior after worker inversion
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(clipLeft, 0, scaledMaxW, this.height);

        // 3. Draw image with repeat or single tile
        if (this.renderSpec.overflowBehavior === 'repeat' && scaledW > 0) {
            // Draw original centered tile first
            ctx.drawImage(frame.bitmap, destX, destY, scaledW, scaledH);

            // Tile to the right
            let rightX = destX + scaledW;
            while (rightX < clipLeft + scaledMaxW) {
                ctx.drawImage(frame.bitmap, rightX, destY, scaledW, scaledH);
                rightX += scaledW;
            }

            // Tile to the left
            let leftX = destX - scaledW;
            while (leftX + scaledW > clipLeft) {
                ctx.drawImage(frame.bitmap, leftX, destY, scaledW, scaledH);
                leftX -= scaledW;
            }
        } else {
            // Default single tile (centered)
            ctx.drawImage(frame.bitmap, destX, destY, scaledW, scaledH);
        }

        // Restore context state
        ctx.restore();
    }
}
