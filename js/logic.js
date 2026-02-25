import { dbAdd, dbPut, dbDelete } from './db.js';
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

    const id = await dbAdd('logs', newLog);
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
            await dbPut('logs', idleLog);
        } else {
            await dbAdd('logs', idleLog);
        }

        await dbDelete('settings', 'pauseState');
        return null;
    }

    const taskToSave = { ...activeTask, endTime: Date.now(), isManualStop: isManualStop };
    await dbPut('logs', taskToSave);
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
    const id = await dbAdd('logs', pauseState);
    pauseState.id = id;
    await dbPut('settings', { key: 'pauseState', value: pauseState });
    return pauseState;
}
