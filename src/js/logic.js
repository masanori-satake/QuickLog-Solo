import { dbAdd, dbPut, dbDelete, STORE_LOGS, STORE_SETTINGS, SETTING_KEY_PAUSE_STATE } from './db.js';
import { SYSTEM_CATEGORY_IDLE } from './utils.js';

export function formatDuration(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return {
        hours,
        minutes,
        seconds,
        toString: () => `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
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
            return formatAsCsv(items);
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

function prepareReportItems(logs, options) {
    const { emoji } = options;
    return logs.filter(l => !l.isManualStop).map(l => {
        let category = l.category;
        if (l.category === '__IDLE__') {
            category = options.idleText || '(待機)';
        }
        if (emoji === 'remove') {
            category = stripEmojis(category);
        }

        const start = new Date(l.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const end = l.endTime ? new Date(l.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const durMs = l.endTime ? l.endTime - l.startTime : 0;
        const durText = l.endTime ? formatLogDuration(durMs) : '';

        return { start, end, category, durText };
    });
}

function formatAsCsv(items) {
    let csv = 'startTime,endTime,category,duration\n';
    items.forEach(item => {
        csv += `${item.start},${item.end},"${item.category.replace(/"/g, '""')}",${item.durText}\n`;
    });
    return csv;
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

export async function stopTaskLogic(activeTask, isManualStop = false) {
    if (!activeTask) return null;

    const now = Date.now();

    if (activeTask.isPaused) {
        const idleLog = {
            ...activeTask,
            category: SYSTEM_CATEGORY_IDLE,
            endTime: now,
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
        const taskToSave = { ...activeTask, endTime: now, isManualStop: false };
        await dbPut(STORE_LOGS, taskToSave);
    }

    if (isManualStop) {
        // 停止ボタンが押された場合は、追加で停止マーカーを記録する
        const stopLog = {
            category: SYSTEM_CATEGORY_IDLE,
            startTime: now,
            endTime: now,
            isManualStop: true
        };
        await dbAdd(STORE_LOGS, stopLog);
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
 * Aggregates time by category and tags for a given set of logs.
 */
export function aggregateTimeByCategoryAndTags(logs, options = {}) {
    const { idleText = '(待機)' } = options;
    const catAgg = {};
    const tagAgg = {};

    logs.forEach(l => {
        const dur = (l.endTime - l.startTime) / 60000;
        let category = l.category;
        if (category === SYSTEM_CATEGORY_IDLE) {
            category = idleText;
        }
        catAgg[category] = (catAgg[category] || 0) + dur;

        const tagStr = l.tags || '';
        if (tagStr) {
            const tags = tagStr.split(',').map(t => t.trim()).filter(Boolean);
            tags.forEach(tag => {
                tagAgg[tag] = (tagAgg[tag] || 0) + dur;
            });
        }
    });

    let text = "";
    for (const cat in catAgg) {
        text += `${cat} | ${Math.round(catAgg[cat])} min\n`;
    }

    if (Object.keys(tagAgg).length > 0) {
        text += "\n---\n";
        const sortedTags = Object.keys(tagAgg).sort();
        sortedTags.forEach(tag => {
            text += `#${tag} | ${Math.round(tagAgg[tag])} min\n`;
        });
    }

    return text;
}
