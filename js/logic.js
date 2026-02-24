import { dbAdd, dbPut } from './db.js';

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
    if (activeTask && activeTask.category === categoryName) return activeTask;

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

export async function stopTaskLogic(activeTask) {
    if (!activeTask) return null;
    const taskToSave = { ...activeTask, endTime: Date.now() };
    await dbPut('logs', taskToSave);
    return null;
}

export async function pauseTaskLogic(activeTask) {
    if (!activeTask || activeTask.category === '(待機)') return activeTask;
    const lastCategory = activeTask.category;
    await stopTaskLogic(activeTask);
    return await startTaskLogic('(待機)', null, lastCategory);
}
