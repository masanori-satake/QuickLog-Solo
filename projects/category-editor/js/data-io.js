/**
 * QL-Category Editor - Data IO Module
 */

import { SYSTEM_CATEGORY_PAGE_BREAK } from '../shared/js/utils.js';
import {
    validateCategorySchema, SCHEMA_KIND_CATEGORY, SCHEMA_VERSION_1_0,
    SCHEMA_TYPE_CATEGORY, SCHEMA_TYPE_PAGE_BREAK
} from '../shared/js/schema.js';

export function initDataIO(state, elements) {
    const { importBtn, exportBtn, codeViewEl } = elements;

    function t(key, params) {
        if (state.t) return state.t(key, params);
        return key;
    }

    function showToast(msg) {
        if (state.showToast) state.showToast(msg);
    }

    function getCategoryTags(cat) {
        if (!cat || !cat.tags) return [];
        return cat.tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    function updateCodeView() {
        const ndjson = state.categories.map(cat => {
            const isPageBreak = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);
            const entry = {
                kind: SCHEMA_KIND_CATEGORY,
                version: SCHEMA_VERSION_1_0,
                type: isPageBreak ? SCHEMA_TYPE_PAGE_BREAK : SCHEMA_TYPE_CATEGORY
            };
            if (!isPageBreak) {
                entry.name = cat.name;
                entry.color = cat.color;
                entry.tags = getCategoryTags(cat);
                entry.animation = cat.animation || 'default';
            }
            return JSON.stringify(entry);
        }).join('\n');
        codeViewEl.textContent = ndjson;
    }

    async function handleImport() {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;

            // Security: Limit clipboard text size (e.g., 1MB)
            if (text.length > 1024 * 1024) {
                showToast(t('toast-import-failed') + ' (Data too large)');
                return;
            }

            const lines = text.split('\n').filter(l => l.trim());

            // Security: Limit number of lines
            if (lines.length > 1000) {
                showToast(t('toast-import-failed') + ' (Too many items)');
                return;
            }
            const validItems = [];
            let errorCount = 0;

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (validateCategorySchema(data)) {
                        if (data.type === SCHEMA_TYPE_PAGE_BREAK) {
                            validItems.push({ name: `${SYSTEM_CATEGORY_PAGE_BREAK}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` });
                        } else {
                            validItems.push({
                                name: data.name,
                                color: data.color,
                                tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
                                animation: data.animation || 'default'
                            });
                        }
                    } else {
                        errorCount++;
                    }
                } catch {
                    errorCount++;
                }
            }

            if (validItems.length === 0 && lines.length > 0) {
                showToast(t('toast-import-failed'));
                return;
            }

            if (errorCount > 0) {
                if (!confirm(t('import-err-partial', { total: lines.length, errorCount, validCount: validItems.length }))) {
                    return;
                }
            }

            if (state.recordAction) state.recordAction();
            state.categories = validItems;
            state.selectedIndices = state.categories.length > 0 ? [0] : [];
            state.lastSelectedIndex = state.categories.length > 0 ? 0 : -1;
            if (state.renderCategoryList) state.renderCategoryList();
            if (state.renderDetail) state.renderDetail();
            if (state.renderGlobalTagBox) state.renderGlobalTagBox();
            updateCodeView();
            showToast(t('toast-import-success'));
        } catch (err) {
            console.error(err);
            if (err.name === 'NotAllowedError') {
                 console.warn('Clipboard access denied');
            } else {
                 showToast(t('toast-import-failed'));
            }
        }
    }

    async function handleExport() {
        if (state.categories.length === 0) {
            showToast(t('toast-no-categories'));
            return;
        }
        const ndjson = state.categories.map(cat => {
            const isPageBreak = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);
            const entry = {
                kind: SCHEMA_KIND_CATEGORY,
                version: SCHEMA_VERSION_1_0,
                type: isPageBreak ? SCHEMA_TYPE_PAGE_BREAK : SCHEMA_TYPE_CATEGORY
            };
            if (!isPageBreak) {
                entry.name = cat.name;
                entry.color = cat.color;
                entry.tags = cat.tags ? cat.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                entry.animation = cat.animation || 'default';
            }
            return JSON.stringify(entry);
        }).join('\n');

        try {
            await navigator.clipboard.writeText(ndjson);
            showToast(t('toast-export-success'));
        } catch (err) {
            console.error('Failed to copy categories:', err);
        }
    }

    importBtn.addEventListener('click', handleImport);
    exportBtn.addEventListener('click', handleExport);

    return {
        updateCodeView
    };
}
