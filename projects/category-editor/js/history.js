/**
 * QL-Category Editor - History Module
 */

export function initHistory(state, elements) {
    const { undoBtn, redoBtn } = elements;

    const HISTORY_LIMIT = 50;

    function recordAction() {
        if (state.commitInput) state.commitInput();
        const data = JSON.stringify(state.categories);

        if (state.historyStack.length > 0 && state.historyStack[state.historyStack.length - 1] === data) return;

        state.historyStack.push(data);
        if (state.historyStack.length > HISTORY_LIMIT) {
            state.historyStack.shift();
        }
        state.redoStack = [];
        updateHistoryButtons();
    }

    function clearHistory() {
        state.historyStack = [];
        state.redoStack = [];
        updateHistoryButtons();
    }

    function undo() {
        if (state.commitInput) state.commitInput();
        if (state.historyStack.length === 0) return;

        const currentState = JSON.stringify(state.categories);
        state.redoStack.push(currentState);

        const previousState = state.historyStack.pop();
        state.categories = JSON.parse(previousState);

        if (state.refreshUIAfterHistoryChange) state.refreshUIAfterHistoryChange();
    }

    function redo() {
        if (state.commitInput) state.commitInput();
        if (state.redoStack.length === 0) return;

        const currentState = JSON.stringify(state.categories);
        state.historyStack.push(currentState);

        const nextState = state.redoStack.pop();
        state.categories = JSON.parse(nextState);

        if (state.refreshUIAfterHistoryChange) state.refreshUIAfterHistoryChange();
    }

    function updateHistoryButtons() {
        undoBtn.disabled = state.historyStack.length === 0;
        redoBtn.disabled = state.redoStack.length === 0;
    }

    function startInputRecording() {
        if (state.isRecordingInput) return;
        state.isRecordingInput = true;
        state.inputInitialState = JSON.stringify(state.categories);
    }

    function commitInput() {
        if (!state.isRecordingInput) return;
        state.isRecordingInput = false;

        const currentState = JSON.stringify(state.categories);
        if (currentState !== state.inputInitialState) {
            state.historyStack.push(state.inputInitialState);
            if (state.historyStack.length > HISTORY_LIMIT) {
                state.historyStack.shift();
            }
            state.redoStack = [];
            updateHistoryButtons();
        }
        state.inputInitialState = null;
    }

    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    return {
        recordAction,
        clearHistory,
        undo,
        redo,
        updateHistoryButtons,
        startInputRecording,
        commitInput
    };
}
