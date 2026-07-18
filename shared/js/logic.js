import { dbGet, dbAdd, dbPut, dbDelete, dbGetAll, dbGetManualStopsAt, STORE_LOGS, STORE_SETTINGS, SETTING_KEY_PAUSE_STATE } from './db.js';
import { SYSTEM_CATEGORY_IDLE, SYSTEM_CATEGORY_UNKNOWN, SYSTEM_CATEGORY_PAGE_BREAK, CONTIGUITY_TOLERANCE_MS, escapeHtml, escapeTsv, escapeCsv, generateUUID, floorToMinute } from './utils.js';
import { recordDeletedSyncId } from './session_sync.js';
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
        if (l.isManualStop || category === SYSTEM_CATEGORY_IDLE || category === SYSTEM_CATEGORY_UNKNOWN || category.startsWith(SYSTEM_CATEGORY_PAGE_BREAK) || !l.endTime) return;
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
 */
export function stripEmojis(str) {
    if (!str) return '';
    // This regex covers most emojis including variations and skin tones
    return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B06}\u{2194}\u{21AA}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25FE}\u{25FD}\u{25FB}\u{25FC}\u{25B6}\u{25C0}\u{1F1E6}-\u{1F1FF}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F201}\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}-\u{1F251}\u{3030}\u{303D}\u{3297}\u{3299}\u{203C}\u{2049}\u{2122}\u{2139}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{231A}-\u{231B}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2600}-\u{2604}\u{260E}\u{2611}\u{2614}-\u{2615}\u{2618}\u{261D}\u{2620}\u{2622}-\u{2623}\u{2626}\u{262A}\u{262E}-\u{262F}\u{2638}-\u{263A}\u{2640}\u{2642}\u{2648}-\u{2653}\u{2660}\u{2663}\u{2665}-\u{2666}\u{2668}\u{267B}\u{267F}\u{2692}-\u{2697}\u{2699}\u{269B}-\u{269C}\u{26A0}-\u{26A1}\u{26AA}-\u{26AB}\u{26B0}-\u{26B1}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26C8}\u{26CE}-\u{26CF}\u{26D1}\u{26D3}-\u{26D4}\u{26E9}-\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '').trim();
}

/**
 * Calculates the visual width of a string, accounting for multi-byte characters.
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
    const filteredLogs = logs.filter(log => !log.isManualStop && !(log.category || '').startsWith(SYSTEM_CATEGORY_PAGE_BREAK));
    if (filteredLogs.length === 0) return [];

    const adjustMinutes = parseInt(adjust);
    const adjustIntervalMs = (adjustMinutes && !isNaN(adjustMinutes)) ? adjustMinutes * 60 * 1000 : 0;

    let displayLogs = filteredLogs.map(log => ({
        startTime: log.startTime,
        endTime: log.endTime,
        category: log.category === SYSTEM_CATEGORY_IDLE ? (options.idleText || t('idle-category-log')) :
                  log.category === SYSTEM_CATEGORY_UNKNOWN ? t('category-unknown') : log.category,
        memo: log.memo
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
        let category = log.memo || log.category;
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

    const now = floorToMinute(Date.now());
    await stopTaskLogic(activeTask, false, now);

    // 同一時刻の「終了」マーカー（手動停止）があれば削除する
    // 性能最適化：全件取得(dbGetAll)を避け、Cursorを使用して直近のマーカーのみを検索
    const stopMarkers = await dbGetManualStopsAt(now);
    for (const marker of stopMarkers) {
        if (marker.id) {
            await dbDelete(STORE_LOGS, marker.id);
            if (marker.syncId) await recordDeletedSyncId(marker.syncId);
        }
    }

    const newLog = {
        syncId: generateUUID(),
        category: categoryName,
        startTime: now,
        endTime: null,
        resumableCategory: resumableCategory,
        color: color,
        tags: tags,
        updatedAt: Date.now()
    };

    const id = await dbAdd(STORE_LOGS, newLog);
    newLog.id = id;
    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_PAUSE_STATE, value: { ...newLog, isPaused: categoryName === SYSTEM_CATEGORY_IDLE } });
    return newLog;
}

export async function stopTaskLogic(activeTask, isManualStop = false, customEndTime = null) {
    if (!activeTask) return null;

    const endTime = customEndTime || floorToMinute(Date.now());

    if (activeTask.isPaused) {
        const idleLog = {
            ...activeTask,
            category: SYSTEM_CATEGORY_IDLE,
            endTime: endTime,
            isManualStop: false,
            updatedAt: Date.now()
        };
        delete idleLog.isPaused;

        // Cleanup: If duration is 0, delete it instead of saving
        if (idleLog.endTime <= idleLog.startTime) {
            if (idleLog.id) {
                await dbDelete(STORE_LOGS, idleLog.id);
                if (idleLog.syncId) await recordDeletedSyncId(idleLog.syncId);
            }
        } else {
            if (idleLog.id) {
                await dbPut(STORE_LOGS, idleLog);
            } else {
                await dbAdd(STORE_LOGS, idleLog);
            }
        }
    } else {
        // 通常の作業中の場合は、その作業を正常終了させる
        const taskToSave = { ...activeTask, endTime: endTime, isManualStop: false, updatedAt: Date.now() };

        // Cleanup: If duration is 0, delete it instead of saving
        if (taskToSave.endTime <= taskToSave.startTime) {
            if (taskToSave.id) {
                await dbDelete(STORE_LOGS, taskToSave.id);
                if (taskToSave.syncId) await recordDeletedSyncId(taskToSave.syncId);
            }
        } else {
            await dbPut(STORE_LOGS, taskToSave);
        }
    }

    await dbDelete(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);

    if (isManualStop) {
        // 停止ボタンが押された場合は、追加で停止マーカーを記録する
        // 重複（同じ時刻のマーカー）を避けるためのチェック
        // 性能最適化：全件取得(dbGetAll)を避け、Cursorを使用して直近のマーカーのみを検索
        const stopMarkers = await dbGetManualStopsAt(endTime);
        const isDuplicate = stopMarkers.length > 0;

        if (!isDuplicate) {
            const stopLog = {
                syncId: generateUUID(),
                category: SYSTEM_CATEGORY_IDLE,
                startTime: endTime,
                endTime: endTime,
                isManualStop: true,
                updatedAt: Date.now()
            };
            await dbAdd(STORE_LOGS, stopLog);
        }
    }
    return null;
}

export async function pauseTaskLogic(activeTask) {
    if (!activeTask || activeTask.category === SYSTEM_CATEGORY_IDLE || activeTask.isPaused) return activeTask;
    const lastCategory = activeTask.category;
    const now = floorToMinute(Date.now());
    await stopTaskLogic(activeTask, false, now);

    const pauseState = {
        syncId: generateUUID(),
        category: SYSTEM_CATEGORY_IDLE,
        startTime: now,
        resumableCategory: lastCategory,
        isPaused: true,
        updatedAt: Date.now()
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
    currentLog.updatedAt = Date.now();
    await dbPut(STORE_LOGS, currentLog);

    // Sync with pauseState if the updated log is the currently active task
    const pauseStateSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    if (pauseStateSetting?.value?.id === currentLog.id) {
        await dbPut(STORE_SETTINGS, {
            key: SETTING_KEY_PAUSE_STATE,
            value: { ...currentLog, isPaused: currentLog.category === SYSTEM_CATEGORY_IDLE }
        });
    }

    // Propagate changes to previous items as long as they are contiguous
    let prevIndex = index - 1;
    let lastOldStartTs = oldStartTs;
    let lastNewStartTs = currentNewTs;

    while (prevIndex >= 0) {
        const prevLog = sortedLogs[prevIndex];
        if (Math.abs(prevLog.endTime - lastOldStartTs) > CONTIGUITY_TOLERANCE_MS) break;

        const oldPrevStartTs = prevLog.startTime;
        prevLog.endTime = lastNewStartTs;

        if (prevLog.isManualStop) {
            prevLog.startTime = prevLog.endTime;
        }
        prevLog.updatedAt = Date.now();

        await dbPut(STORE_LOGS, prevLog);

        // Move to next (previous) item
        lastOldStartTs = oldPrevStartTs;
        lastNewStartTs = prevLog.startTime;
        prevIndex--;

        // If the item we just updated was NOT a stop marker,
        // its start time didn't change, so propagation stops here.
        if (!prevLog.isManualStop) break;
    }
}

/**
 * 履歴を分割します。(Splits a history log item into two: one for the first minute and another for the remaining time.)
 * @param {number} logId
 * @returns {Promise<boolean>} Success status
 */
export async function splitHistoryItem(logId) {
    const log = await dbGet(STORE_LOGS, logId);
    if (!log || log.isManualStop) return false;

    const durationMs = log.endTime ? (log.endTime - log.startTime) : (Date.now() - log.startTime);
    const splitIntervalMs = 60000; // 1 minute
    const minDuration = log.endTime ? 120000 : 60000;

    if (durationMs < minDuration) return false;

    const splitTs = log.startTime + splitIntervalMs;

    const newLog = JSON.parse(JSON.stringify(log));
    delete newLog.id;
    newLog.syncId = generateUUID();
    newLog.startTime = splitTs;
    newLog.updatedAt = Date.now();

    log.endTime = splitTs;
    log.updatedAt = Date.now();

    await dbPut(STORE_LOGS, log);
    const newId = await dbAdd(STORE_LOGS, newLog);
    newLog.id = newId;

    // If the splitted log was the active task (unlikely as we usually split confirmed logs,
    // but confirmed logs can be active task if it's paused/running), we might need to update pauseState.
    const pauseStateSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    if (pauseStateSetting?.value?.id === log.id || (newLog.endTime == null && pauseStateSetting?.value?.startTime === log.startTime)) {
        // The original task is now shorter. The rest is in the new log.
        // Usually, splitting a confirmed history implies it's in the past,
        // but if it's the active one, the new part becomes the active one.
        await dbPut(STORE_SETTINGS, {
            key: SETTING_KEY_PAUSE_STATE,
            value: { ...newLog, isPaused: newLog.category === SYSTEM_CATEGORY_IDLE }
        });
    }

    return true;
}

/**
 * Calculates the next execution time for an alarm.
 * @param {Object} alarm
 * @param {number[]} businessDays - [0, 1, ..., 6]
 * @param {number} nowTs - Current timestamp
 * @returns {number|null} Next execution timestamp or null
 */
export function calculateNextAlarmTime(alarm, businessDays, nowTs = Date.now()) {
    if (!alarm.enabled || !alarm.time) return null;

    const [hours, minutes] = alarm.time.split(':').map(Number);

    const isWorkingDay = (d) => businessDays.includes(d.getDay());

    const adjustDate = (date) => {
        if (isWorkingDay(date) || alarm.holidayAdjustment === 'none') {
            return date;
        }

        if (alarm.holidayAdjustment === 'skip') {
            return null;
        }

        let d = new Date(date);
        if (alarm.holidayAdjustment === 'prev_business_day') {
            // Guard: type3 (monthly_date) with day 1 cannot go back
            if (alarm.type === 'monthly_date' && alarm.dayOfMonth === 1 && d.getDate() === 1) {
                // Cannot go back before the 1st of the month.
                // Return null to skip this candidate and let the search continue to the next month.
                return null;
            }
            for (let i = 0; i < 7; i++) {
                d.setDate(d.getDate() - 1);
                if (isWorkingDay(d)) return d;
            }
        } else if (alarm.holidayAdjustment === 'next_business_day') {
            // Guard: type4 (monthly_end_relative) cannot go forward
            // Requirement says UI should prevent it.
            for (let i = 0; i < 7; i++) {
                d.setDate(d.getDate() + 1);
                if (isWorkingDay(d)) return d;
            }
        }
        return d;
    };

    // Candidate search
    if (alarm.type === 'daily' || alarm.type === 'daily_business' || alarm.type === 'weekly') {
        let current = new Date(nowTs);
        current.setHours(hours, minutes, 0, 0);

        // Try next 400 days
        for (let i = 0; i < 400; i++) {
            let matchesType = false;
            if (alarm.type === 'daily' || alarm.type === 'daily_business') {
                matchesType = true;
            } else if (alarm.type === 'weekly') {
                matchesType = alarm.daysOfWeek.includes(current.getDay());
            }

            if (matchesType) {
                const adjusted = adjustDate(current);
                if (adjusted && adjusted.getTime() > nowTs) {
                    return adjusted.getTime();
                }
            }
            current.setDate(current.getDate() + 1);
        }
    } else if (alarm.type === 'monthly_date' || alarm.type === 'monthly_end_relative') {
        let candidateMonth = new Date(nowTs);
        candidateMonth.setDate(1); // Avoid overflow when moving months

        // Try next 24 months
        for (let i = 0; i < 24; i++) {
            const year = candidateMonth.getFullYear();
            const month = candidateMonth.getMonth();
            const lastDay = new Date(year, month + 1, 0).getDate();

            let day;
            if (alarm.type === 'monthly_date') {
                day = Math.min(alarm.dayOfMonth, lastDay);
            } else {
                day = Math.max(1, lastDay - alarm.daysBeforeEnd);
            }

            let candidate = new Date(year, month, day, hours, minutes, 0, 0);
            const adjusted = adjustDate(candidate);
            if (adjusted && adjusted.getTime() > nowTs) {
                return adjusted.getTime();
            }
            candidateMonth.setMonth(candidateMonth.getMonth() + 1);
        }
    }

    return null;
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
    const syncId = log.syncId;

    await dbDelete(STORE_LOGS, logId);
    if (syncId) {
        await recordDeletedSyncId(syncId);
    }

    // Get current pause state ID once for efficiency
    const pauseStateSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    const pauseStateId = pauseStateSetting?.value?.id;

    // If the deleted log was the paused task, clear it from settings
    if (pauseStateId === logId) {
        await dbDelete(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    }

    // Propagation for deletion: update next items as long as they are contiguous
    let nextIndex = index + 1;
    let lastOldEndTs = oldEndTs;
    let lastNewStartTs = oldStartTs;

    while (nextIndex < sortedLogs.length) {
        const nextLog = sortedLogs[nextIndex];
        if (Math.abs(nextLog.startTime - lastOldEndTs) > CONTIGUITY_TOLERANCE_MS) break;

        const oldNextEndTs = nextLog.endTime;
        nextLog.startTime = lastNewStartTs;
        if (nextLog.isManualStop) {
            nextLog.endTime = lastNewStartTs;
        }
        nextLog.updatedAt = Date.now();

        await dbPut(STORE_LOGS, nextLog);

        // Sync with pauseState if the updated log is the active task
        if (pauseStateId === nextLog.id) {
            await dbPut(STORE_SETTINGS, {
                key: SETTING_KEY_PAUSE_STATE,
                value: { ...nextLog, isPaused: nextLog.category === SYSTEM_CATEGORY_IDLE }
            });
        }

        // Move to next item
        lastOldEndTs = oldNextEndTs;
        lastNewStartTs = nextLog.endTime;
        nextIndex++;

        // If the item we just updated was NOT a stop marker,
        // its end time didn't change, so propagation stops here.
        if (!nextLog.isManualStop) break;
    }
}
