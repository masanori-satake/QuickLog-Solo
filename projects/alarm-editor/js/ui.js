import { t } from '../shared/js/i18n.js';
import { SYSTEM_CATEGORY_PAGE_BREAK } from '../shared/js/utils.js';

export function initUI(state, elements) {
    const {
        alarmListEl, emptyStateEl, detailFormEl,
        alarmIdEl, enabledToggle, timeInput, confirmToggle,
        messageInput, actionSelect, catGroupEl, categorySelect,
        typeSelect, weeklyContainer, monthlyDateContainer, monthlyEndContainer,
        weeklyChipsEl, dayOfMonthInput, daysBeforeEndInput,
        holidayAdjSelect, adjDescEl, businessDaysContainer,
        undoBtn, redoBtn, alarmResetBtn
    } = elements;

    function renderBusinessDays() {
        businessDaysContainer.replaceChildren();
        // Sunday-start: 0,1,2,3,4,5,6
        [0, 1, 2, 3, 4, 5, 6].forEach(day => {
            const label = t('day-' + day);

            const chip = document.createElement('button');
            chip.className = 'filter-chip' + (state.businessDays.includes(day) ? ' active' : '');
            if (day === 0) chip.classList.add('sunday');
            if (day === 6) chip.classList.add('saturday');
            chip.textContent = label;

            chip.onclick = () => {
                if (state.businessDays.includes(day)) {
                    if (state.businessDays.length > 1) {
                        state.businessDays = state.businessDays.filter(d => d !== day);
                    } else {
                        if (state.showToast) state.showToast(t('alert-business-days-min'));
                        return;
                    }
                } else {
                    state.businessDays.push(day);
                    state.businessDays.sort((a, b) => a - b);
                }
                renderBusinessDays();
                if (state.onSettingsChange) state.onSettingsChange();
            };
            businessDaysContainer.appendChild(chip);
        });
    }

    function renderAlarmList() {
        alarmListEl.replaceChildren();

        let unnamedCounter = 1;
        state.alarms.forEach((alarm, i) => {
            const item = document.createElement('div');
            item.className = 'alarm-item';
            item.draggable = true;

            const dragHandle = document.createElement('span');
            dragHandle.className = 'material-symbols-outlined drag-handle';
            dragHandle.textContent = 'drag_indicator';
            dragHandle.setAttribute('data-i18n-title', 'tooltip-drag-handle');
            item.dataset.id = alarm.id;
            item.dataset.index = i;

            if (state.selectedAlarmId === alarm.id) {
                item.classList.add('active');
            }

            const time = document.createElement('span');
            time.className = 'alarm-time';
            time.textContent = alarm.time;

            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined alarm-icon';
            icon.textContent = getAlarmTypeIcon(alarm.type);

            const msg = document.createElement('span');
            msg.className = 'alarm-msg';
            let alarmName = alarm.message;
            if (!alarmName) {
                alarmName = t('alarm-label-default-name', { index: unnamedCounter });
                unnamedCounter++;
            }
            msg.textContent = alarmName;

            const statusIcon = document.createElement('span');
            statusIcon.className = 'material-symbols-outlined alarm-status-icon';
            statusIcon.textContent = 'notifications';
            if (!alarm.enabled) {
                statusIcon.classList.add('disabled');
            }

            item.appendChild(dragHandle);
            item.appendChild(time);
            item.appendChild(icon);
            item.appendChild(msg);
            item.appendChild(statusIcon);

            item.onclick = () => {
                state.selectedAlarmId = alarm.id;
                renderAlarmList();
                renderDetail();
            };

            // Drag and Drop
            item.ondragstart = handleDragStart;
            item.ondragover = handleDragOver;
            item.ondrop = handleDrop;
            item.ondragend = handleDragEnd;

            alarmListEl.appendChild(item);
        });
    }

    let dragSrcEl = null;

    function handleDragStart(e) {
        dragSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.index);
        this.classList.add('dragging');
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDrop(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        if (dragSrcEl && dragSrcEl !== this) {
            const fromIndex = parseInt(dragSrcEl.dataset.index);
            const toIndex = parseInt(this.dataset.index);
            if (state.onReorder) state.onReorder(fromIndex, toIndex);
        }
        return false;
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
    }

    function getAlarmTypeIcon(type) {
        switch (type) {
            case 'daily': return 'today';
            case 'daily_business': return 'work';
            case 'weekly': return 'calendar_view_week';
            case 'monthly_date': return 'calendar_month';
            case 'monthly_end_relative': return 'event_repeat';
            default: return 'notifications';
        }
    }

    function renderDetail() {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (!alarm) {
            emptyStateEl.classList.remove('hidden');
            detailFormEl.classList.add('hidden');
            return;
        }

        emptyStateEl.classList.add('hidden');
        detailFormEl.classList.remove('hidden');

        // Calculate dynamic name for the header
        let unnamedCounter = 1;
        let alarmName = '';
        for (const a of state.alarms) {
            if (a.id === alarm.id) {
                alarmName = a.message || t('alarm-label-default-name', { index: unnamedCounter });
                break;
            }
            if (!a.message) unnamedCounter++;
        }
        alarmIdEl.textContent = alarmName;

        enabledToggle.checked = alarm.enabled;
        timeInput.value = alarm.time;
        confirmToggle.checked = alarm.requireConfirmation;
        messageInput.value = alarm.message || '';

        populateSelect(actionSelect, ['none', 'stop', 'pause', 'start'], 'alarm-action-', alarm.action);
        catGroupEl.classList.toggle('hidden', alarm.action !== 'start');
        if (alarm.action === 'start') {
            categorySelect.replaceChildren();
            state.categories.filter(c => !c.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)).forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.textContent = cat.name;
                if (alarm.actionCategory === cat.name) opt.selected = true;
                categorySelect.appendChild(opt);
            });
        }

        populateSelect(typeSelect, ['daily', 'daily_business', 'weekly', 'monthly_date', 'monthly_end_relative'], 'alarm-type-', alarm.type);

        weeklyContainer.classList.toggle('hidden', alarm.type !== 'weekly');
        monthlyDateContainer.classList.toggle('hidden', alarm.type !== 'monthly_date');
        monthlyEndContainer.classList.toggle('hidden', alarm.type !== 'monthly_end_relative');

        if (alarm.type === 'weekly') renderWeeklyChips(alarm);
        dayOfMonthInput.value = alarm.dayOfMonth || 1;
        daysBeforeEndInput.value = alarm.daysBeforeEnd || 0;

        renderHolidayAdjustment(alarm);
    }

    function populateSelect(select, values, prefix, current) {
        select.replaceChildren();
        values.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = t(prefix + val);
            if (val === current) opt.selected = true;
            select.appendChild(opt);
        });
    }

    function renderHolidayAdjustment(alarm) {
        holidayAdjSelect.replaceChildren();
        const isDaily = alarm.type === 'daily' || alarm.type === 'daily_business';
        holidayAdjSelect.disabled = isDaily;

        const options = ['none', 'prev_business_day', 'next_business_day', 'skip'];
        options.forEach(val => {
            // Guardrails
            if (val === 'prev_business_day' && alarm.type === 'monthly_date' && alarm.dayOfMonth === 1) return;
            if (val === 'next_business_day' && alarm.type === 'monthly_end_relative') return;
            if (isDaily && val !== 'none') return;

            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = t('alarm-adj-' + val);
            if (alarm.holidayAdjustment === val) opt.selected = true;
            holidayAdjSelect.appendChild(opt);
        });
        adjDescEl.textContent = t('alarm-adj-desc-' + alarm.holidayAdjustment);
    }

    // Set up listeners
    enabledToggle.onchange = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm) {
            alarm.enabled = enabledToggle.checked;
            renderAlarmList();
            if (state.onAlarmChange) state.onAlarmChange(alarm);
        }
    };

    alarmResetBtn.onclick = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm && state.onAlarmReset) {
            state.onAlarmReset(alarm);
        }
    };
    timeInput.onchange = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm) {
            alarm.time = timeInput.value;
            renderAlarmList();
            if (state.onAlarmChange) state.onAlarmChange(alarm);
        }
    };
    confirmToggle.onchange = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm) {
            alarm.requireConfirmation = confirmToggle.checked;
            if (state.onAlarmChange) state.onAlarmChange(alarm);
        }
    };
    messageInput.onchange = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm) {
            alarm.message = messageInput.value.trim();
            renderAlarmList();
            if (state.onAlarmChange) state.onAlarmChange(alarm);
        }
    };
    actionSelect.onchange = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm) {
            alarm.action = actionSelect.value;
            renderDetail();
            if (state.onAlarmChange) state.onAlarmChange(alarm);
        }
    };
    categorySelect.onchange = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm) {
            alarm.actionCategory = categorySelect.value;
            if (state.onAlarmChange) state.onAlarmChange(alarm);
        }
    };
    typeSelect.onchange = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm) {
            alarm.type = typeSelect.value;
            // Apply guardrails to holiday adjustment
            if (alarm.type === 'monthly_date' && alarm.dayOfMonth === 1 && alarm.holidayAdjustment === 'prev_business_day') {
                alarm.holidayAdjustment = 'none';
            }
            if (alarm.type === 'monthly_end_relative' && alarm.holidayAdjustment === 'next_business_day') {
                alarm.holidayAdjustment = 'none';
            }
            if ((alarm.type === 'daily' || alarm.type === 'daily_business') && alarm.holidayAdjustment !== 'none') {
                alarm.holidayAdjustment = 'none';
            }
            renderAlarmList();
            renderDetail();
            if (state.onAlarmChange) state.onAlarmChange(alarm);
        }
    };
    dayOfMonthInput.onchange = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm) {
            alarm.dayOfMonth = parseInt(dayOfMonthInput.value) || 1;
            if (alarm.type === 'monthly_date' && alarm.dayOfMonth === 1 && alarm.holidayAdjustment === 'prev_business_day') {
                alarm.holidayAdjustment = 'none';
            }
            renderDetail();
            if (state.onAlarmChange) state.onAlarmChange(alarm);
        }
    };
    daysBeforeEndInput.onchange = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm) {
            alarm.daysBeforeEnd = parseInt(daysBeforeEndInput.value) || 0;
            renderDetail();
            if (state.onAlarmChange) state.onAlarmChange(alarm);
        }
    };
    holidayAdjSelect.onchange = () => {
        const alarm = state.alarms.find(a => a.id === state.selectedAlarmId);
        if (alarm) {
            alarm.holidayAdjustment = holidayAdjSelect.value;
            renderDetail();
            if (state.onAlarmChange) state.onAlarmChange(alarm);
        }
    };

    function renderWeeklyChips(alarm) {
        weeklyChipsEl.replaceChildren();
        [0, 1, 2, 3, 4, 5, 6].forEach(day => {
            const label = t('day-' + day);
            const chip = document.createElement('button');
            chip.className = 'filter-chip' + (alarm.daysOfWeek.includes(day) ? ' active' : '');
            if (day === 0) chip.classList.add('sunday');
            if (day === 6) chip.classList.add('saturday');
            chip.textContent = label;
            chip.onclick = () => {
                if (alarm.daysOfWeek.includes(day)) {
                    alarm.daysOfWeek = alarm.daysOfWeek.filter(d => d !== day);
                } else {
                    alarm.daysOfWeek.push(day);
                    alarm.daysOfWeek.sort((a, b) => a - b);
                }
                renderWeeklyChips(alarm);
                if (state.onAlarmChange) state.onAlarmChange(alarm);
            };
            weeklyChipsEl.appendChild(chip);
        });
    }

    function updateHistoryButtons(history) {
        undoBtn.disabled = !history.canUndo();
        redoBtn.disabled = !history.canRedo();
        undoBtn.onclick = () => {
            if (history.undo() && state.onHistoryChange) {
                state.onHistoryChange();
            }
        };
        redoBtn.onclick = () => {
            if (history.redo() && state.onHistoryChange) {
                state.onHistoryChange();
            }
        };
    }

    return {
        renderBusinessDays,
        renderAlarmList,
        renderDetail,
        updateHistoryButtons
    };
}
