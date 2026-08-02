import { jest } from '@jest/globals';
import {
    splitIntoChunks,
    joinChunks,
    animChunkKey,
    pushAnimationToSync,
    pullAnimationsFromSync,
    removeAnimationFromSync,
    clearAllAnimationChunksFromSync,
} from './anim_sync.js';
import { fc, test as fcTest } from '@fast-check/jest';

describe('anim_sync - pure functions', () => {
    describe('splitIntoChunks', () => {
        it('splits a string into chunks of maxSize or fewer characters', () => {
            const str = 'a'.repeat(15000);
            const chunks = splitIntoChunks(str, 6000);
            expect(chunks).toHaveLength(3);
            expect(chunks[0]).toHaveLength(6000);
            expect(chunks[1]).toHaveLength(6000);
            expect(chunks[2]).toHaveLength(3000);
        });

        it('returns a single chunk when string is shorter than maxSize', () => {
            const str = 'abc';
            const chunks = splitIntoChunks(str, 6000);
            expect(chunks).toHaveLength(1);
            expect(chunks[0]).toBe('abc');
        });

        it('returns an array with one empty string for empty input', () => {
            const chunks = splitIntoChunks('', 6000);
            expect(chunks).toEqual(['']);
        });

        it('every chunk is <= maxSize characters', () => {
            const str = 'x'.repeat(12001);
            const chunks = splitIntoChunks(str, 6000);
            for (const chunk of chunks) {
                expect(chunk.length).toBeLessThanOrEqual(6000);
            }
        });

        it('returns a single chunk when string length equals maxSize', () => {
            const str = 'b'.repeat(6000);
            const chunks = splitIntoChunks(str, 6000);
            expect(chunks).toHaveLength(1);
            expect(chunks[0]).toBe(str);
        });
    });

    describe('joinChunks', () => {
        it('joins chunks back into the original string', () => {
            const chunks = ['abc', 'def', 'ghi'];
            expect(joinChunks(chunks)).toBe('abcdefghi');
        });

        it('returns empty string for an array with one empty string', () => {
            expect(joinChunks([''])).toBe('');
        });

        it('handles single chunk', () => {
            expect(joinChunks(['hello'])).toBe('hello');
        });
    });

    describe('splitIntoChunks + joinChunks round-trip', () => {
        it('round-trip preserves the original string', () => {
            const original = 'A'.repeat(18500);
            const result = joinChunks(splitIntoChunks(original, 6000));
            expect(result).toBe(original);
        });

        it('round-trip preserves empty string', () => {
            const result = joinChunks(splitIntoChunks('', 6000));
            expect(result).toBe('');
        });
    });

    describe('animChunkKey', () => {
        it('generates key in the correct format', () => {
            expect(animChunkKey('550e8400-e29b-41d4-a716-446655440000', 0)).toBe(
                'anim_chunk_550e8400-e29b-41d4-a716-446655440000_0'
            );
        });

        it('handles different chunk indices', () => {
            expect(animChunkKey('abc-123', 5)).toBe('anim_chunk_abc-123_5');
        });

        it('generates unique keys for different indices', () => {
            const key0 = animChunkKey('test-id', 0);
            const key1 = animChunkKey('test-id', 1);
            expect(key0).not.toBe(key1);
        });
    });
});

/**
 * Property 7: チャンク分割の round-trip と上限保証
 * Validates: Requirements 6.1, 6.6
 *
 * 任意の Base64 文字列に対して splitIntoChunks(base64, 6000) を実行すると、
 * すべてのチャンクの長さが 6,000 文字以下であり、かつ
 * joinChunks(splitIntoChunks(base64, 6000)) === base64 が成立する。
 */
describe('Property 7: チャンク分割の round-trip と上限保証', () => {
    fcTest.prop([fc.string({ minLength: 0, maxLength: 50000 })])('splitIntoChunks round-trip', (base64) => {
        const chunks = splitIntoChunks(base64, 6000);
        expect(chunks.every((c) => c.length <= 6000)).toBe(true);
        expect(joinChunks(chunks)).toBe(base64);
    });
});

describe('anim_sync - async functions (chrome.storage.sync)', () => {
    let mockStorage;

    beforeEach(() => {
        mockStorage = {};
        global.chrome = {
            storage: {
                sync: {
                    set: jest.fn(async (items) => {
                        Object.assign(mockStorage, items);
                    }),
                    get: jest.fn(async () => ({ ...mockStorage })),
                    remove: jest.fn(async (keys) => {
                        for (const k of keys) delete mockStorage[k];
                    }),
                },
            },
        };
    });

    afterEach(() => {
        delete global.chrome;
    });

    describe('pushAnimationToSync - retry logic', () => {
        it('throws after exactly 3 retries when set always fails', async () => {
            const genericError = new Error('network error');
            global.chrome.storage.sync.set = jest.fn().mockRejectedValue(genericError);

            const onProgress = jest.fn();

            await expect(pushAnimationToSync('test-id', 'short', onProgress)).rejects.toThrow(/after 3 retries/);

            // The chunk 'short' fits in one chunk, so set is called 3 times for that single chunk
            expect(global.chrome.storage.sync.set).toHaveBeenCalledTimes(3);
        });
    });

    describe('pushAnimationToSync - QUOTA_BYTES_PER_ITEM error', () => {
        it('throws immediately without retry on QUOTA_BYTES_PER_ITEM error', async () => {
            const quotaError = new Error('QUOTA_BYTES_PER_ITEM exceeded');
            global.chrome.storage.sync.set = jest.fn().mockRejectedValue(quotaError);

            const onProgress = jest.fn();

            await expect(pushAnimationToSync('test-id', 'data', onProgress)).rejects.toThrow('QUOTA_BYTES_PER_ITEM');

            // Called only once — no retry for quota errors
            expect(global.chrome.storage.sync.set).toHaveBeenCalledTimes(1);
        });
    });

    describe('clearAllAnimationChunksFromSync', () => {
        it('deletes all anim_chunk_ and anim_meta_ keys but preserves other keys', async () => {
            mockStorage = {
                'anim_chunk_abc-123_0': 'chunk0',
                'anim_chunk_abc-123_1': 'chunk1',
                'anim_meta_abc-123': { chunkCount: 2 },
                'anim_chunk_def-456_0': 'chunk0',
                'anim_meta_def-456': { chunkCount: 1 },
                settings_syncEnabled: true,
                categories_data: '[]',
            };

            await clearAllAnimationChunksFromSync();

            expect(global.chrome.storage.sync.remove).toHaveBeenCalledTimes(1);
            const removedKeys = global.chrome.storage.sync.remove.mock.calls[0][0];
            expect(removedKeys).toContain('anim_chunk_abc-123_0');
            expect(removedKeys).toContain('anim_chunk_abc-123_1');
            expect(removedKeys).toContain('anim_meta_abc-123');
            expect(removedKeys).toContain('anim_chunk_def-456_0');
            expect(removedKeys).toContain('anim_meta_def-456');
            expect(removedKeys).not.toContain('settings_syncEnabled');
            expect(removedKeys).not.toContain('categories_data');

            // Verify storage state after removal
            expect(mockStorage).toEqual({
                settings_syncEnabled: true,
                categories_data: '[]',
            });
        });
    });

    describe('removeAnimationFromSync', () => {
        it('removes only the target animation chunks and metadata', async () => {
            mockStorage = {
                'anim_chunk_abc-123_0': 'chunkA0',
                'anim_chunk_abc-123_1': 'chunkA1',
                'anim_meta_abc-123': { chunkCount: 2 },
                'anim_chunk_def-456_0': 'chunkB0',
                'anim_meta_def-456': { chunkCount: 1 },
                other_key: 'value',
            };

            await removeAnimationFromSync('abc-123');

            const removedKeys = global.chrome.storage.sync.remove.mock.calls[0][0];
            expect(removedKeys).toContain('anim_chunk_abc-123_0');
            expect(removedKeys).toContain('anim_chunk_abc-123_1');
            expect(removedKeys).toContain('anim_meta_abc-123');
            expect(removedKeys).not.toContain('anim_chunk_def-456_0');
            expect(removedKeys).not.toContain('anim_meta_def-456');
            expect(removedKeys).not.toContain('other_key');

            // Verify storage state
            expect(mockStorage).toEqual({
                'anim_chunk_def-456_0': 'chunkB0',
                'anim_meta_def-456': { chunkCount: 1 },
                other_key: 'value',
            });
        });
    });

    describe('pullAnimationsFromSync', () => {
        it('reconstructs animation data correctly from multiple chunked animations', () => {
            const syncData = {
                'anim_chunk_anim-1_0': 'AAAA',
                'anim_chunk_anim-1_1': 'BBBB',
                'anim_chunk_anim-1_2': 'CC',
                'anim_chunk_anim-2_0': 'XXXX',
                'anim_chunk_anim-2_1': 'YY',
                'anim_meta_anim-1': { chunkCount: 3 },
                'anim_meta_anim-2': { chunkCount: 2 },
                settings_key: 'unrelated',
            };

            const results = pullAnimationsFromSync(syncData);

            expect(results).toHaveLength(2);

            const anim1 = results.find((r) => r.id === 'anim-1');
            const anim2 = results.find((r) => r.id === 'anim-2');

            expect(anim1).toBeDefined();
            expect(anim1.base64).toBe('AAAABBBBCC');

            expect(anim2).toBeDefined();
            expect(anim2.base64).toBe('XXXXYY');
        });
    });

    describe('pushAnimationToSync - onProgress callback', () => {
        it('calls onProgress with (completedChunks, totalChunks) after each successful write', async () => {
            const onProgress = jest.fn();
            // 15000 chars → 3 chunks of 6000 each (6000 + 6000 + 3000)
            const base64 = 'A'.repeat(15000);

            await pushAnimationToSync('prog-id', base64, onProgress);

            // 3 data chunks
            expect(onProgress).toHaveBeenCalledTimes(3);
            expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
            expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3);
            expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3);
        });
    });
});
