import { dbAdd, dbPut, dbDelete, dbGetAll, STORE_LOGS, STORE_SETTINGS, SETTING_KEY_PAUSE_STATE } from './db.js';
import { SYSTEM_CATEGORY_IDLE, SYSTEM_CATEGORY_PAGE_BREAK, escapeHtml, escapeTsv, escapeCsv } from './utils.js';
import { t } from './i18n.js';

export function formatDuration(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatLogDuration(ms) {
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }

    const totalMinutes = Math.round(ms / 60000);
    if (totalMinutes < 60) {
        return `${totalMinutes}m`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) {
        return `${hours}h`;
    } else if (minutes < 10) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${hours}h${minutes}m`;
    }
}

/**
 * Calculates aggregated duration per tag from a list of logs.
 * @param {Object[]} logs
 * @returns {Object} { tagAgg, noTagDuration, totalWorkDuration }
 */
export function calculateTagAggregation(logs) {
    const tagAgg = {};
    let noTagDuration = 0;
    let totalWorkDuration = 0;

    logs.forEach(l => {
        const category = l.category || '';
        if (l.isManualStop || category === SYSTEM_CATEGORY_IDLE || category.startsWith(SYSTEM_CATEGORY_PAGE_BREAK) || !l.endTime) return;
        const dur = l.endTime - l.startTime;
        if (dur <= 0) return;

        totalWorkDuration += dur;

        const tagStr = l.tags || '';
        const tags = tagStr ? [...new Set(tagStr.split(',').map(t => t.trim()).filter(Boolean))] : [];
        if (tags.length > 0) {
            tags.forEach(tag => {
                tagAgg[tag] = (tagAgg[tag] || 0) + dur;
            });
        } else {
            noTagDuration += dur;
        }
    });

    return { tagAgg, noTagDuration, totalWorkDuration };
}

/**
 * Strips all emojis from a string.
 * Exported for testing purposes only.
 */
export function stripEmojis(str) {
    if (!str) return '';
    // This regex covers most emojis including variations and skin tones
    return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B06}\u{2194}\u{21AA}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25FE}\u{25FD}\u{25FB}\u{25FC}\u{25B6}\u{25C0}\u{1F1E6}-\u{1F1FF}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F201}\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}-\u{1F251}\u{3030}\u{303D}\u{3297}\u{3299}\u{203C}\u{2049}\u{2122}\u{2139}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{231A}-\u{231B}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2600}-\u{2604}\u{260E}\u{2611}\u{2614}-\u{2615}\u{2618}\u{261D}\u{2620}\u{2622}-\u{2623}\u{2626}\u{262A}\u{262E}-\u{262F}\u{2638}-\u{263A}\u{2640}\u{2642}\u{2648}-\u{2653}\u{2660}\u{2663}\u{2665}-\u{2666}\u{2668}\u{267B}\u{267F}\u{2692}-\u{2697}\u{2699}\u{269B}-\u{269C}\u{26A0}-\u{26A1}\u{26AA}-\u{26AB}\u{26B0}-\u{26B1}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26C8}\u{26CE}-\u{26CF}\u{26D1}\u{26D3}-\u{26D4}\u{26E9}-\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '').trim();
}

/**
 * Calculates the visual width of a string, accounting for multi-byte characters.
 * Exported for testing purposes only.
 */
export function getVisualWidth(str) {
    if (!str) return 0;
    let width = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        // Half-width characters (roughly)
        if ((code >= 0x00 && code <= 0xff) || (code >= 0xff61 && code <= 0xff9f)) {
            width += 1;
        } else {
            width += 2;
        }
    }
    return width;
}

/**
 * Pads a string to a target visual width.
 * Exported for testing purposes only.
 */
export function visualPadEnd(str, targetWidth, padChar = ' ') {
    let currentWidth = getVisualWidth(str);
    if (currentWidth >= targetWidth) return str;
    return str + padChar.repeat(targetWidth - currentWidth);
}

/**
 * Formats a report based on provided logs and options.
 */
export function generateReport(logs, options) {
    const { format } = options;
    const items = prepareReportItems(logs, options);

    switch (format) {
        case 'csv':
            return formatAsCsv(items, options);
        case 'tsv':
            return formatAsTsv(items, options);
        case 'html':
            return formatAsHtml(items, options);
        case 'markdown':
            return formatAsList(items, options, '-');
        case 'wiki':
            return formatAsList(items, options, '*');
        case 'text-plain':
            return formatAsText(items, options, false);
        case 'text-table':
            return formatAsText(items, options, true);
        default:
            return '';
    }
}

/**
 * Prepares log items for report generation, applying emoji removal and time adjustment.
 * @param {Object[]} logs
 * @param {Object} options
 * @returns {Object[]}
 */
function prepareReportItems(logs, options) {
    const { emoji, adjust } = options;
    const filteredLogs = logs.filter(log => !log.isManualStop);
    if (filteredLogs.length === 0) return [];

    const adjustMinutes = parseInt(adjust);
    const adjustIntervalMs = (adjustMinutes && !isNaN(adjustMinutes)) ? adjustMinutes * 60 * 1000 : 0;

    let displayLogs = filteredLogs.map(log => ({
        startTime: log.startTime,
        endTime: log.endTime,
        category: log.category === '__IDLE__' ? (options.idleText || t('idle-category-log')) : log.category
    }));

    if (adjustIntervalMs > 0) {
        const allTimestamps = [];
        displayLogs.forEach(log => {
            allTimestamps.push(log.startTime);
            if (log.endTime) allTimestamps.push(log.endTime);
        });
        const uniqueTimes = [...new Set(allTimestamps)].sort((a, b) => a - b);
        const adjustedTimesMap = new Map();

        const timestampCount = uniqueTimes.length;
        if (timestampCount > 0) {
            // The first timestamp of the day and the last timestamp of the day are kept fixed
            // as per requirements to preserve workday boundaries.
            adjustedTimesMap.set(uniqueTimes[0], uniqueTimes[0]);
            if (timestampCount > 1) {
                adjustedTimesMap.set(uniqueTimes[timestampCount - 1], uniqueTimes[timestampCount - 1]);
            }

            // Adjust intermediate points (rounding to the nearest interval).
            // Logic: A rounded time is accepted only if it remains chronological,
            // i.e., not before the previous (already adjusted) point and not after
            // the next (original) point. This ensures no overlaps or order swaps.
            // Loop runs from 1 to timestampCount - 2, so i+1 is always valid (< timestampCount).
            for (let i = 1; i < timestampCount - 1; i++) {
                const originalTime = uniqueTimes[i];
                const roundedTime = Math.round(originalTime / adjustIntervalMs) * adjustIntervalMs;

                const previousAdjustedTime = adjustedTimesMap.get(uniqueTimes[i - 1]);
                const nextOriginalTime = uniqueTimes[i + 1];

                if (roundedTime >= previousAdjustedTime && roundedTime <= nextOriginalTime) {
                    adjustedTimesMap.set(originalTime, roundedTime);
                } else {
                    // Fallback to original time if rounding causes a chronological contradiction.
                    adjustedTimesMap.set(originalTime, originalTime);
                }
            }

            // Apply adjusted timestamps to the display log copies.
            displayLogs.forEach(log => {
                log.startTime = adjustedTimesMap.get(log.startTime);
                if (log.endTime) log.endTime = adjustedTimesMap.get(log.endTime);
            });
        }
    }

    return displayLogs.map(log => {
        let category = log.category;
        if (emoji === 'remove') {
            category = stripEmojis(category);
        }

        const startText = new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endText = log.endTime ? new Date(log.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const durationMs = log.endTime ? log.endTime - log.startTime : 0;
        const durationText = log.endTime ? formatLogDuration(durationMs) : '';

        return { start: startText, end: endText, category, durText: durationText };
    });
}

function formatAsCsv(items, options) {
    const { endTime, duration } = options;
    const columns = ['startTime'];
    if (endTime === 'show') columns.push('endTime');
    columns.push('category');
    if (duration !== 'none') columns.push('duration');

    const header = columns.join(',');
    const lines = items.map(item => {
        const row = [item.start];
        if (endTime === 'show') row.push(item.end);
        row.push(escapeCsv(item.category));
        if (duration !== 'none') row.push(item.durText);
        return row.join(',');
    });
    return [header, ...lines].join('\n') + '\n';
}

function formatAsTsv(items, options) {
    const { endTime, duration } = options;
    const columns = ['startTime'];
    if (endTime === 'show') columns.push('endTime');
    columns.push('category');
    if (duration !== 'none') columns.push('duration');

    const header = columns.join('\t');
    const lines = items.map(item => {
        const row = [item.start];
        if (endTime === 'show') row.push(item.end);
        row.push(escapeTsv(item.category));
        if (duration !== 'none') row.push(item.durText);
        return row.join('\t');
    });
    return [header, ...lines].join('\n') + '\n';
}

function formatAsHtml(items, options) {
    const headerTime = options.headerTime || 'Time';
    const headerCategory = options.headerCategory || 'Category';
    const { endTime, duration } = options;

    let html = '<table>\n  <thead>\n    <tr>';
    html += `<th>${headerTime}</th><th>${headerCategory}</th>`;
    html += '</tr>\n  </thead>\n  <tbody>\n';

    items.forEach(item => {
        let timePart = item.start;
        if (endTime === 'show') timePart += ` - ${item.end}`;
        if (duration === 'right' && item.durText) timePart += ` (${item.durText})`;

        html += '    <tr>';
        html += `<td>${timePart}`;
        if (duration === 'bottom' && item.durText) {
            html += `<br>(${item.durText})`;
        }
        html += `</td><td>${escapeHtml(item.category)}</td>`;
        html += '</tr>\n';
    });

    html += '  </tbody>\n</table>';
    return html;
}

function formatAsList(items, options, bullet) {
    const { endTime, duration } = options;
    return items.map(item => {
        let line = `${bullet} ${item.start}`;
        if (endTime === 'show') line += ` - ${item.end}`;

        if (duration === 'right' && item.durText) {
            line += ` (${item.durText})`;
        } else if (duration === 'bottom' && item.durText) {
            line += `\n  (${item.durText})`;
        }

        line += ` | ${item.category}`;
        return line;
    }).join('\n');
}

function formatAsText(items, options, isTable) {
    const { endTime, duration } = options;
    const headerTime = options.headerTime || 'Time';
    const headerCategory = options.headerCategory || 'Category';

    const maxTimeLen = Math.max(
        endTime === 'show' ? 15 : 5,
        isTable ? getVisualWidth(headerTime) : 5,
        ...items.map(i => {
            let len = getVisualWidth(i.start + (endTime === 'show' ? ` - ${i.end}` : ''));
            if (duration === 'right' && i.durText) len += getVisualWidth(` (${i.durText})`);
            return len;
        }),
        ...items.map(i => (duration === 'bottom' && i.durText) ? getVisualWidth(`(${i.durText})`) : 0)
    );
    const maxCatLen = Math.max(...items.map(i => getVisualWidth(i.category)), isTable ? getVisualWidth(headerCategory) : 8);

    if (isTable) {
        const lineSep = '+' + '-'.repeat(maxTimeLen + 2) + '+' + '-'.repeat(maxCatLen + 2) + '+';
        let out = lineSep + '\n';
        out += `| ${visualPadEnd(headerTime, maxTimeLen)} | ${visualPadEnd(headerCategory, maxCatLen)} |\n`;
        out += lineSep + '\n';

        items.forEach(item => {
            let timePart = item.start + (endTime === 'show' ? ` - ${item.end}` : '');
            if (duration === 'right' && item.durText) timePart += ` (${item.durText})`;

            out += `| ${visualPadEnd(timePart, maxTimeLen)} | ${visualPadEnd(item.category, maxCatLen)} |\n`;
            if (duration === 'bottom' && item.durText) {
                out += `| ${visualPadEnd(`(${item.durText})`, maxTimeLen)} | ${visualPadEnd('', maxCatLen)} |\n`;
            }
            out += lineSep + '\n';
        });
        return out.trim();
    } else {
        return items.map(item => {
            let timePart = item.start + (endTime === 'show' ? ` - ${item.end}` : '');
            if (duration === 'right' && item.durText) timePart += ` (${item.durText})`;

            let line = `${visualPadEnd(timePart, maxTimeLen)} | ${visualPadEnd(item.category, maxCatLen)}`;
            if (duration === 'bottom' && item.durText) {
                line += `\n${visualPadEnd(`(${item.durText})`, maxTimeLen)} | ${visualPadEnd('', maxCatLen)}`;
            }
            return line;
        }).join('\n');
    }
}

export async function startTaskLogic(categoryName, activeTask, resumableCategory = null, color = null, tags = '') {
    if (activeTask && activeTask.category === categoryName && !activeTask.isPaused) return activeTask;

    await stopTaskLogic(activeTask);

    const newLog = {
        category: categoryName,
        startTime: Date.now(),
        endTime: null,
        resumableCategory: resumableCategory,
        color: color,
        tags: tags
    };

    const id = await dbAdd(STORE_LOGS, newLog);
    newLog.id = id;
    return newLog;
}

export async function stopTaskLogic(activeTask, isManualStop = false, customEndTime = null) {
    if (!activeTask) return null;

    const endTime = customEndTime || Date.now();

    if (activeTask.isPaused) {
        const idleLog = {
            ...activeTask,
            category: SYSTEM_CATEGORY_IDLE,
            endTime: endTime,
            isManualStop: false
        };
        delete idleLog.isPaused;

        if (idleLog.id) {
            await dbPut(STORE_LOGS, idleLog);
        } else {
            await dbAdd(STORE_LOGS, idleLog);
        }

        await dbDelete(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    } else {
        // 通常の作業中の場合は、その作業を正常終了させる
        const taskToSave = { ...activeTask, endTime: endTime, isManualStop: false };
        await dbPut(STORE_LOGS, taskToSave);
    }

    if (isManualStop) {
        // 停止ボタンが押された場合は、追加で停止マーカーを記録する
        // 重複（同じ時刻のマーカー）を避けるためのチェック
        const allLogs = await dbGetAll(STORE_LOGS);
        const isDuplicate = allLogs.some(l =>
            l.isManualStop &&
            l.category === SYSTEM_CATEGORY_IDLE &&
            l.startTime === endTime &&
            l.endTime === endTime
        );

        if (!isDuplicate) {
            const stopLog = {
                category: SYSTEM_CATEGORY_IDLE,
                startTime: endTime,
                endTime: endTime,
                isManualStop: true
            };
            await dbAdd(STORE_LOGS, stopLog);
        }
    }
    return null;
}

export async function pauseTaskLogic(activeTask) {
    if (!activeTask || activeTask.category === SYSTEM_CATEGORY_IDLE || activeTask.isPaused) return activeTask;
    const lastCategory = activeTask.category;
    await stopTaskLogic(activeTask);

    const pauseState = {
        category: SYSTEM_CATEGORY_IDLE,
        startTime: Date.now(),
        resumableCategory: lastCategory,
        isPaused: true
    };
    const id = await dbAdd(STORE_LOGS, pauseState);
    pauseState.id = id;
    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_PAUSE_STATE, value: pauseState });
    return pauseState;
}

/**
 * Updates the start time of a history log item and propagates the change to the previous item if contiguous.
 * @param {number} logId
 * @param {number} newTs
 */
export async function updateHistoryStartTime(logId, newTs) {
    const allLogs = await dbGetAll(STORE_LOGS);
    const sortedLogs = allLogs.sort((a, b) => a.startTime - b.startTime);
    const index = sortedLogs.findIndex(l => l.id === logId);
    if (index === -1) return;

    let currentLog = sortedLogs[index];
    let currentNewTs = newTs;

    // Update the targeted log
    const oldStartTs = currentLog.startTime;
    currentLog.startTime = currentNewTs;
    if (currentLog.isManualStop) {
        currentLog.endTime = currentNewTs;
    }
    await dbPut(STORE_LOGS, currentLog);

    // Propagate changes to previous items as long as they are contiguous
    let prevIndex = index - 1;
    let lastOldStartTs = oldStartTs;
    let lastNewStartTs = currentNewTs;
    let lastWasStop = currentLog.isManualStop;

    while (prevIndex >= 0) {
        const prevLog = sortedLogs[prevIndex];
        if (prevLog.endTime !== lastOldStartTs) break;

        const oldPrevStartTs = prevLog.startTime;
        prevLog.endTime = lastNewStartTs;

        if (prevLog.isManualStop) {
            prevLog.startTime = prevLog.endTime;
        }

        await dbPut(STORE_LOGS, prevLog);

        // Move to next (previous) item
        lastOldStartTs = oldPrevStartTs;
        lastNewStartTs = prevLog.startTime;
        lastWasStop = prevLog.isManualStop;
        prevIndex--;

        // If the item we just updated was NOT a stop marker,
        // its start time didn't change, so propagation stops here.
        if (!prevLog.isManualStop) break;
    }
}

/**
 * Deletes a history log item and updates the next item's start time to maintain continuity.
 * @param {number} logId
 */
export async function deleteHistoryItem(logId) {
    const allLogs = await dbGetAll(STORE_LOGS);
    const sortedLogs = allLogs.sort((a, b) => a.startTime - b.startTime);
    const index = sortedLogs.findIndex(l => l.id === logId);
    if (index === -1) return;

    const log = sortedLogs[index];
    const oldStartTs = log.startTime;
    const oldEndTs = log.endTime;

    await dbDelete(STORE_LOGS, logId);

    // Propagation for deletion: update next items as long as they are contiguous
    let nextIndex = index + 1;
    let lastOldEndTs = oldEndTs;
    let lastNewStartTs = oldStartTs;

    while (nextIndex < sortedLogs.length) {
        const nextLog = sortedLogs[nextIndex];
        if (nextLog.startTime !== lastOldEndTs) break;

        const oldNextEndTs = nextLog.endTime;
        nextLog.startTime = lastNewStartTs;
        if (nextLog.isManualStop) {
            nextLog.endTime = lastNewStartTs;
        }

        await dbPut(STORE_LOGS, nextLog);

        // Move to next item
        lastOldEndTs = oldNextEndTs;
        lastNewStartTs = nextLog.endTime;
        nextIndex++;

        // If the item we just updated was NOT a stop marker,
        // its end time didn't change, so propagation stops here.
        if (!nextLog.isManualStop) break;
    }
}
