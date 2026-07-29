/**
 * Simple Undo/Redo history stack
 */
export function initHistory(state) {
    const historyStack = [];
    const redoStack = [];
    const MAX_HISTORY = 50;

    function record() {
        const snapshot = JSON.stringify({
            alarms: state.alarms,
            businessDays: state.businessDays
        });

        if (historyStack.length > 0 && historyStack[historyStack.length - 1] === snapshot) {
            return;
        }

        historyStack.push(snapshot);
        if (historyStack.length > MAX_HISTORY) historyStack.shift();
        redoStack.length = 0;
    }

    function undo() {
        if (historyStack.length <= 1) return;

        const current = historyStack.pop();
        redoStack.push(current);

        const prev = historyStack[historyStack.length - 1];
        const data = JSON.parse(prev);

        state.alarms = data.alarms;
        state.businessDays = data.businessDays;
        return true;
    }

    function redo() {
        if (redoStack.length === 0) return;

        const next = redoStack.pop();
        historyStack.push(next);

        const data = JSON.parse(next);
        state.alarms = data.alarms;
        state.businessDays = data.businessDays;
        return true;
    }

    function canUndo() {
        return historyStack.length > 1;
    }

    function canRedo() {
        return redoStack.length > 0;
    }

    return { record, undo, redo, canUndo, canRedo };
}
