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

export function getAnimationState(startTime, now = Date.now()) {
    const elapsed = now - startTime;
    const msInMinute = elapsed % 60000;
    const minuteCount = Math.floor(elapsed / 60000);
    const percent = (msInMinute / 60000) * 100;

    if (minuteCount % 2 === 0) {
        return { type: 'even', inset: `inset(0 0 0 ${100 - percent}%)` };
    } else {
        return { type: 'odd', inset: `inset(0 ${percent}% 0 0)` };
    }
}

export async function startTaskLogic(categoryName, activeTask, resumableCategory = null) {
    if (activeTask && activeTask.category === categoryName && !activeTask.isPaused) return activeTask;

    await stopTaskLogic(activeTask);

    const newLog = {
        category: categoryName,
        startTime: Date.now(),
        endTime: null,
        resumableCategory: resumableCategory
    };

    const id = await dbAdd(STORE_LOGS, newLog);
    newLog.id = id;
    return newLog;
}

export async function stopTaskLogic(activeTask, isManualStop = false) {
    if (!activeTask) return null;

    if (activeTask.isPaused) {
        const idleLog = {
            ...activeTask,
            category: SYSTEM_CATEGORY_IDLE,
            endTime: Date.now(),
            isManualStop: isManualStop
        };
        delete idleLog.isPaused;

        if (idleLog.id) {
            await dbPut(STORE_LOGS, idleLog);
        } else {
            await dbAdd(STORE_LOGS, idleLog);
        }

        await dbDelete(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
        return null;
    }

    const now = Date.now();
    // 通常の作業中の場合は、その作業を正常終了させる
    const taskToSave = { ...activeTask, endTime: now, isManualStop: false };
    await dbPut(STORE_LOGS, taskToSave);

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
