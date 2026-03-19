/**
 * QL-Category Editor - UI Module
 */

import { SYSTEM_CATEGORY_PAGE_BREAK, generateDuplicateName } from '../shared/js/utils.js';
import { animations as animationRegistry } from '../shared/js/animation_registry.js';

export function initUI(state, elements) {
    const {
        categoryListEl, detailSection, editNameInput, tagListEl,
        tagInput, colorPaletteEl, editAnimationSelect, previewNameEl,
        animInfoEl, animDescEl, animAuthorEl, addCategoryBtn,
        deleteSelectedBtn, addPageBreakBtn, newStartBtn, clearAllBtn
    } = elements;

    const COLORS = [
        'primary', 'secondary', 'tertiary', 'error', 'neutral', 'outline',
        'teal', 'green', 'yellow', 'orange', 'pink', 'indigo', 'brown', 'cyan'
    ];

    const COLOR_CODES = {
        primary: '#1976d2',
        secondary: '#7cb342',
        tertiary: '#8e24aa',
        error: '#d32f2f',
        neutral: '#546e7a',
        outline: '#9e9e9e',
        teal: '#0097a7',
        green: '#388e3c',
        yellow: '#fbc02d',
        orange: '#ffa000',
        pink: '#d81b60',
        indigo: '#5e35b1',
        brown: '#6d4c41',
        cyan: '#039be5'
    };

    function t(key, params) {
        if (state.t) return state.t(key, params);
        return key;
    }

    function renderCategoryList() {
        categoryListEl.innerHTML = '';
        state.categories.forEach((cat, idx) => {
            const item = document.createElement('div');
            const isPageBreak = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);
            item.className = 'category-item' + (isPageBreak ? ' page-break' : '') + (state.selectedIndices.includes(idx) ? ' active' : '');
            item.draggable = true;
            item.dataset.index = idx;

            const dragHandle = document.createElement('span');
            dragHandle.className = 'material-symbols-outlined drag-handle';
            dragHandle.textContent = 'drag_indicator';
            item.appendChild(dragHandle);

            if (isPageBreak) {
                const nameSpan = document.createElement('span');
                nameSpan.className = 'cat-name';
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined';
                icon.textContent = 'insert_page_break';
                nameSpan.appendChild(icon);
                nameSpan.appendChild(document.createTextNode(' ' + t('page-break-label')));
                item.appendChild(nameSpan);
            } else {
                const dot = document.createElement('span');
                dot.className = 'cat-dot';
                dot.style.backgroundColor = COLOR_CODES[cat.color || 'primary'];
                item.appendChild(dot);

                const nameSpan = document.createElement('span');
                nameSpan.className = 'cat-name';
                nameSpan.textContent = cat.name;
                nameSpan.title = cat.name;
                item.appendChild(nameSpan);
            }

            if (state.selectedIndices.length <= 1) {
                if (isPageBreak) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'icon-btn delete-item-btn';
                    const deleteIcon = document.createElement('span');
                    deleteIcon.className = 'material-symbols-outlined';
                    deleteIcon.textContent = 'delete';
                    deleteBtn.appendChild(deleteIcon);
                    deleteBtn.title = t('delete');
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (state.recordAction) state.recordAction();
                        state.categories.splice(idx, 1);
                        state.selectedIndices = state.selectedIndices.filter(i => i !== idx).map(i => i > idx ? i - 1 : i);
                        if (state.lastSelectedIndex === idx) state.lastSelectedIndex = -1;
                        else if (state.lastSelectedIndex > idx) state.lastSelectedIndex--;
                        renderCategoryList();
                        renderDetail();
                        if (state.updateCodeView) state.updateCodeView();
                    };
                    item.appendChild(deleteBtn);
                } else {
                    const moreBtn = document.createElement('button');
                    moreBtn.className = 'icon-btn more-item-btn';
                    const moreIcon = document.createElement('span');
                    moreIcon.className = 'material-symbols-outlined';
                    moreIcon.textContent = 'more_vert';
                    moreBtn.appendChild(moreIcon);
                    moreBtn.onclick = (e) => {
                        e.stopPropagation();
                        showCategoryMenu(e, idx);
                    };
                    item.appendChild(moreBtn);
                }
            }

            item.onclick = (e) => {
                if (e.ctrlKey || e.metaKey) {
                    if (state.selectedIndices.includes(idx)) {
                        state.selectedIndices = state.selectedIndices.filter(i => i !== idx);
                    } else {
                        state.selectedIndices.push(idx);
                        state.selectedIndices = [...new Set(state.selectedIndices)];
                    }
                    state.lastSelectedIndex = idx;
                } else if (e.shiftKey && state.lastSelectedIndex !== -1) {
                    const start = Math.min(state.lastSelectedIndex, idx);
                    const end = Math.max(state.lastSelectedIndex, idx);
                    const range = [];
                    for (let i = start; i <= end; i++) {
                        range.push(i);
                    }
                    state.selectedIndices = range;
                } else {
                    state.selectedIndices = [idx];
                    state.lastSelectedIndex = idx;
                }
                renderCategoryList();
                renderDetail();
            };

            item.ondragstart = () => {
                item.classList.add('dragging');
                const menu = document.querySelector('.category-menu');
                if (menu) menu.remove();
            };
            item.ondragend = () => item.classList.remove('dragging');

            categoryListEl.appendChild(item);
        });
    }

    function showCategoryMenu(e, idx) {
        const existingMenu = document.querySelector('.category-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'category-menu';

        const duplicateBtn = document.createElement('button');
        const duplicateIcon = document.createElement('span');
        duplicateIcon.className = 'material-symbols-outlined';
        duplicateIcon.textContent = 'content_copy';
        duplicateBtn.appendChild(duplicateIcon);
        duplicateBtn.appendChild(document.createTextNode(' ' + t('duplicate')));
        duplicateBtn.onclick = (event) => {
            event.stopPropagation();
            if (state.recordAction) state.recordAction();
            duplicateCategory(idx);
            menu.remove();
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete';
        const deleteIcon = document.createElement('span');
        deleteIcon.className = 'material-symbols-outlined';
        deleteIcon.textContent = 'delete';
        deleteBtn.appendChild(deleteIcon);
        deleteBtn.appendChild(document.createTextNode(' ' + t('delete')));
        deleteBtn.onclick = (event) => {
            event.stopPropagation();
            const cat = state.categories[idx];
            if (confirm(t('confirm-delete-category', { name: cat.name }))) {
                if (state.recordAction) state.recordAction();
                state.categories.splice(idx, 1);
                state.selectedIndices = state.selectedIndices.filter(i => i !== idx).map(i => i > idx ? i - 1 : i);
                if (state.lastSelectedIndex === idx) state.lastSelectedIndex = -1;
                else if (state.lastSelectedIndex > idx) state.lastSelectedIndex--;
                renderCategoryList();
                renderDetail();
                if (state.updateCodeView) state.updateCodeView();
            }
            menu.remove();
        };

        menu.appendChild(duplicateBtn);
        menu.appendChild(deleteBtn);

        document.body.appendChild(menu);
        const rect = e.currentTarget.getBoundingClientRect();
        menu.style.top = `${rect.bottom + window.scrollY}px`;
        menu.style.left = `${rect.right - menu.offsetWidth + window.scrollX}px`;
    }

    function duplicateCategory(idx) {
        const original = state.categories[idx];
        const newName = generateDuplicateName(original.name, state.categories.map(c => c.name));
        const newCat = { ...original, name: newName };

        state.categories.splice(idx + 1, 0, newCat);
        state.selectedIndices = [idx + 1];
        state.lastSelectedIndex = idx + 1;
        renderCategoryList();
        renderDetail();
        if (state.updateCodeView) state.updateCodeView();
    }

    function updateListItem(idx) {
        const item = categoryListEl.children[idx];
        if (!item) return;
        const cat = state.categories[idx];
        const nameEl = item.querySelector('.cat-name');
        if (nameEl) {
            nameEl.textContent = '';
            nameEl.title = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK) ? '' : cat.name;
            if (cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) {
                 const icon = document.createElement('span');
                 icon.className = 'material-symbols-outlined';
                 icon.textContent = 'insert_page_break';
                 nameEl.appendChild(icon);
                 nameEl.appendChild(document.createTextNode(' ' + t('page-break-label')));
            } else {
                 nameEl.textContent = cat.name;
            }
        }
    }

    function clearCategoryClasses(el) {
        if (!el) return;
        const classes = Array.from(el.classList).filter(c => c.startsWith('cat-'));
        classes.forEach(c => el.classList.remove(c));
    }

    function renderDetail() {
        try {
            const previewOverlay = document.getElementById('preview-overlay-base');
            const previewContainer = document.getElementById('preview-container');

            if (!previewOverlay || !previewContainer) return;

            clearCategoryClasses(previewOverlay);
            clearCategoryClasses(previewContainer);

            const labelTags = document.querySelector('label[for="tag-input"]');
            const labelTheme = document.querySelector('label[data-i18n="setting-theme"]');
            const labelAnimation = document.querySelector('label[for="edit-animation"]');

            const isMulti = state.selectedIndices.length > 1;
            if (labelTags) labelTags.textContent = t(isMulti ? 'tags-common' : 'tags');
            if (labelTheme) labelTheme.textContent = t(isMulti ? 'setting-theme-common' : 'setting-theme');
            if (labelAnimation) labelAnimation.textContent = t(isMulti ? 'setting-animation-by-category-common' : 'setting-animation-by-category');

            if (state.selectedIndices.length === 0) {
                detailSection.classList.add('hidden');
                previewNameEl.textContent = '';
                if (state.animationEngine) state.animationEngine.stop();
                animInfoEl.classList.add('hidden');
                previewOverlay.classList.remove('anim-active');
                previewContainer.classList.remove('anim-active');
                return;
            }

            if (state.selectedIndices.length > 1) {
                detailSection.classList.remove('hidden');
                const previewSection = document.querySelector('.preview-section');

                const firstIdx = state.selectedIndices[0];
                const firstCat = state.categories[firstIdx];
                const isFirstPageBreak = firstCat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);

                if (isFirstPageBreak) {
                    if (previewSection) previewSection.classList.add('hidden');
                    editAnimationSelect.disabled = true;
                } else {
                    if (previewSection) previewSection.classList.remove('hidden');
                    editAnimationSelect.disabled = false;
                }

                editNameInput.value = '';
                editNameInput.placeholder = `(${t('tags-common')})`;
                editNameInput.disabled = true;

                tagInput.disabled = isFirstPageBreak;
                renderTags();

                updateColorSelection(firstCat.color || 'primary');
                editAnimationSelect.value = firstCat.animation || 'default';

                colorPaletteEl.querySelectorAll('.color-option').forEach(opt => {
                    if (isFirstPageBreak) {
                        opt.classList.remove('selected');
                        opt.style.pointerEvents = 'none';
                        opt.style.opacity = '0.5';
                    } else {
                        opt.style.pointerEvents = 'auto';
                        opt.style.opacity = '1';
                    }
                });

                updateAnimationInfo();

                if (isFirstPageBreak) {
                    if (state.animationEngine) state.animationEngine.stop();
                } else {
                    previewNameEl.textContent = firstCat.name;
                    const color = firstCat.color || 'primary';
                    const animation = firstCat.animation || 'default';
                    const animActive = animation !== 'none';

                    if (animActive) {
                        previewOverlay.classList.add('anim-active');
                        previewOverlay.classList.add(`cat-${color}`);
                        previewContainer.classList.add('anim-active');
                    } else {
                        previewOverlay.classList.remove('anim-active');
                        previewContainer.classList.remove('anim-active');
                    }
                    if (state.updatePreview) state.updatePreview();
                }
                return;
            }

            const idx = state.selectedIndices[0];
            const cat = state.categories[idx];
            const isPageBreak = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);

            detailSection.classList.remove('hidden');
            const previewSection = document.querySelector('.preview-section');

            if (isPageBreak) {
                if (previewSection) previewSection.classList.add('hidden');
                editNameInput.value = t('page-break-label');
                editNameInput.placeholder = '';
                editNameInput.disabled = true;
                tagInput.disabled = true;
                editAnimationSelect.value = 'none';
                editAnimationSelect.disabled = true;

                tagListEl.innerHTML = '';
                colorPaletteEl.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('selected');
                    opt.style.pointerEvents = 'none';
                    opt.style.opacity = '0.5';
                });

                previewNameEl.textContent = `--- ${t('page-break-label')} ---`;
                previewOverlay.classList.remove('anim-active');
                previewContainer.classList.remove('anim-active');
                if (state.updatePreview) state.updatePreview();
                updateAnimationInfo();
                return;
            }

            if (previewSection) previewSection.classList.remove('hidden');
            editNameInput.disabled = false;
            editNameInput.placeholder = t('label-name');
            tagInput.disabled = false;
            editAnimationSelect.disabled = false;
            colorPaletteEl.querySelectorAll('.color-option').forEach(opt => {
                opt.style.pointerEvents = 'auto';
                opt.style.opacity = '1';
            });

            editNameInput.value = cat.name;
            previewNameEl.textContent = cat.name;
            renderTags();
            updateColorSelection(cat.color || 'primary');
            editAnimationSelect.value = cat.animation || 'default';
            updateAnimationInfo();

            const color = cat.color || 'primary';
            const animation = cat.animation || 'default';
            const animActive = animation !== 'none';

            if (animActive) {
                previewOverlay.classList.add('anim-active');
                previewOverlay.classList.add(`cat-${color}`);
                previewContainer.classList.add('anim-active');
            } else {
                previewOverlay.classList.remove('anim-active');
                previewContainer.classList.remove('anim-active');
            }

            if (state.updatePreview) state.updatePreview();
        } catch { }
    }

    function updateAnimationInfo() {
        const animId = editAnimationSelect.value;
        animInfoEl.classList.remove('hidden');

        if (!animId || animId === 'none') {
            animDescEl.textContent = '';
            animAuthorEl.innerHTML = '&nbsp;';
            return;
        }

        const effectiveId = animId === 'default' ? 'digital_rain' : animId;
        const anim = animationRegistry.find(a => a.id === effectiveId);

        if (anim && anim.metadata) {
            const desc = typeof anim.metadata.description === 'object' ?
                (anim.metadata.description[state.currentLang] || anim.metadata.description['en']) :
                anim.metadata.description;
            animDescEl.textContent = desc || '';

            const author = anim.metadata.author || t('anim-unknown-author');
            animAuthorEl.textContent = `${t('anim-author-label')}: ${author}`;
        } else {
            animDescEl.textContent = '';
            animAuthorEl.innerHTML = '&nbsp;';
        }
    }

    function getCategoryTags(cat) {
        if (!cat || !cat.tags) return [];
        return cat.tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    function updateCategoryTags(cat, tags) {
        if (!cat) return;
        cat.tags = tags.join(', ');
    }

    function renderTags() {
        tagListEl.innerHTML = '';
        if (state.selectedIndices.length === 0) return;

        let commonTags = [];
        if (state.selectedIndices.length === 1) {
            const idx = state.selectedIndices[0];
            commonTags = getCategoryTags(state.categories[idx]);
        } else {
            const tagSets = state.selectedIndices
                .map(idx => state.categories[idx])
                .filter(cat => !cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK))
                .map(cat => new Set(getCategoryTags(cat)));

            if (tagSets.length > 0) {
                const firstSet = tagSets[0];
                commonTags = Array.from(firstSet).filter(tag => tagSets.every(s => s.has(tag)));
                commonTags.sort((a, b) => a.localeCompare(b, state.currentLang));
            }
        }

        commonTags.forEach((tag) => {
            const pill = document.createElement('span');
            pill.className = 'tag-pill';

            const tagText = document.createElement('span');
            tagText.textContent = tag;
            pill.appendChild(tagText);

            const removeBtn = document.createElement('span');
            removeBtn.className = 'material-symbols-outlined tag-remove';
            removeBtn.textContent = 'close';
            pill.appendChild(removeBtn);

            removeBtn.onclick = (e) => {
                e.stopPropagation();
                if (state.recordAction) state.recordAction();
                state.selectedIndices.forEach(idx => {
                    const cat = state.categories[idx];
                    if (cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) return;
                    const tags = getCategoryTags(cat);
                    const filtered = tags.filter(t => t !== tag);
                    updateCategoryTags(cat, filtered);
                });
                renderTags();
                if (state.updateCodeView) state.updateCodeView();
            };
            tagListEl.appendChild(pill);
        });
    }

    function renderColorPalette() {
        colorPaletteEl.innerHTML = '';
        COLORS.forEach(color => {
            const opt = document.createElement('div');
            opt.className = 'color-option';
            opt.style.backgroundColor = COLOR_CODES[color];
            opt.dataset.color = color;

            const check = document.createElement('span');
            check.className = 'material-symbols-outlined';
            check.textContent = 'check';
            opt.appendChild(check);

            opt.onclick = () => {
                if (state.selectedIndices.length === 0) return;
                if (state.recordAction) state.recordAction();
                state.selectedIndices.forEach(idx => {
                    const cat = state.categories[idx];
                    if (!cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) {
                        cat.color = color;
                    }
                });
                renderDetail();
                renderCategoryList();
                if (state.updateCodeView) state.updateCodeView();
            };
            colorPaletteEl.appendChild(opt);
        });
    }

    function updateColorSelection(color) {
        colorPaletteEl.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.color === color);
        });
    }

    function populateAnimationOptions() {
        const currentVal = editAnimationSelect.value;
        editAnimationSelect.innerHTML = '';

        const noneOpt = document.createElement('option');
        noneOpt.value = 'none';
        noneOpt.textContent = t('anim-none');
        editAnimationSelect.appendChild(noneOpt);

        const defOpt = document.createElement('option');
        defOpt.value = 'default';
        defOpt.textContent = t('anim-default');
        editAnimationSelect.appendChild(defOpt);

        animationRegistry.forEach(anim => {
            if (anim.devOnly) return;
            const opt = document.createElement('option');
            opt.value = anim.id;
            opt.textContent = (typeof anim.metadata.name === 'object' ? (anim.metadata.name[state.currentLang] || anim.metadata.name['en']) : anim.metadata.name) || anim.id;
            editAnimationSelect.appendChild(opt);
        });

        if (currentVal) editAnimationSelect.value = currentVal;
    }

    // Event Listeners for UI
    addCategoryBtn.addEventListener('click', () => {
        if (state.recordAction) state.recordAction();
        const newCat = {
            name: 'New Category',
            color: 'primary',
            animation: 'default',
            tags: ''
        };
        state.categories.push(newCat);
        state.selectedIndices = [state.categories.length - 1];
        state.lastSelectedIndex = state.categories.length - 1;
        renderCategoryList();
        renderDetail();
        if (state.updateCodeView) state.updateCodeView();
        categoryListEl.scrollTop = categoryListEl.scrollHeight;
    });

    deleteSelectedBtn.addEventListener('click', () => {
        if (state.selectedIndices.length === 0) return;
        if (confirm(t('confirm-delete-selected', { count: state.selectedIndices.length }))) {
            if (state.recordAction) state.recordAction();
            const selectedSet = new Set(state.selectedIndices);
            state.categories = state.categories.filter((_, idx) => !selectedSet.has(idx));
            state.selectedIndices = [];
            state.lastSelectedIndex = -1;
            renderCategoryList();
            renderDetail();
            if (state.updateCodeView) state.updateCodeView();
        }
    });

    addPageBreakBtn.addEventListener('click', () => {
        if (state.recordAction) state.recordAction();
        const newPB = {
            name: `${SYSTEM_CATEGORY_PAGE_BREAK}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        state.categories.push(newPB);
        state.selectedIndices = [state.categories.length - 1];
        state.lastSelectedIndex = state.categories.length - 1;
        renderCategoryList();
        renderDetail();
        if (state.updateCodeView) state.updateCodeView();
        categoryListEl.scrollTop = categoryListEl.scrollHeight;
    });

    editNameInput.addEventListener('focus', () => {
        if (state.startInputRecording) state.startInputRecording();
    });

    editNameInput.addEventListener('blur', () => {
        if (state.commitInput) state.commitInput();
    });

    editNameInput.addEventListener('input', (e) => {
        if (state.selectedIndices.length !== 1) return;
        const idx = state.selectedIndices[0];
        const name = e.target.value;
        state.categories[idx].name = name;
        previewNameEl.textContent = name;
        updateListItem(idx);
        if (state.updateCodeView) state.updateCodeView();
    });

    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tag = tagInput.value.trim().replace(/,/g, '');
            if (tag && state.selectedIndices.length > 0) {
                if (state.recordAction) state.recordAction();
                state.selectedIndices.forEach(idx => {
                    const cat = state.categories[idx];
                    if (cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) return;

                    const currentTags = getCategoryTags(cat);
                    if (!currentTags.includes(tag)) {
                        currentTags.push(tag);
                        updateCategoryTags(cat, currentTags);
                    }
                });
                renderTags();
                if (state.updateCodeView) state.updateCodeView();
                tagInput.value = '';
            }
        }
    });

    editAnimationSelect.addEventListener('change', (e) => {
        if (state.selectedIndices.length === 0) return;
        if (state.recordAction) state.recordAction();
        const animation = e.target.value;
        state.selectedIndices.forEach(idx => {
            const cat = state.categories[idx];
            if (!cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) {
                cat.animation = animation;
            }
        });
        renderDetail();
        if (state.updateCodeView) state.updateCodeView();
    });

    editAnimationSelect.addEventListener('mouseenter', () => {
        updateAnimationInfo();
    });

    newStartBtn.addEventListener('click', () => {
        if (confirm(t('confirm-load-default'))) {
            if (state.recordAction) state.recordAction();
            if (state.loadDefaultCategories) state.loadDefaultCategories();
        }
    });

    clearAllBtn.addEventListener('click', () => {
        if (confirm(t('confirm-clear-all'))) {
            if (state.recordAction) state.recordAction();
            state.categories = [];
            state.selectedIndices = [];
            state.lastSelectedIndex = -1;
            renderCategoryList();
            renderDetail();
            if (state.updateCodeView) state.updateCodeView();
        }
    });

    // Drag and Drop
    let dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';

    categoryListEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.category-item.dragging');
        if (!dragging) return;

        const siblings = [...categoryListEl.querySelectorAll('.category-item:not(.dragging)')];
        let nextSibling = siblings.find(sibling => {
            return e.clientY <= sibling.getBoundingClientRect().top + sibling.getBoundingClientRect().height / 2;
        });

        if (nextSibling) {
            categoryListEl.insertBefore(dropIndicator, nextSibling);
        } else {
            categoryListEl.appendChild(dropIndicator);
        }
    });

    categoryListEl.addEventListener('dragleave', (e) => {
        if (e.target === categoryListEl && !categoryListEl.contains(e.relatedTarget)) {
            if (dropIndicator.parentNode) dropIndicator.remove();
        }
    });

    categoryListEl.addEventListener('drop', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.category-item.dragging');
        if (!dragging) return;

        if (dropIndicator.parentNode) {
            categoryListEl.insertBefore(dragging, dropIndicator);
            dropIndicator.remove();
        }

        const items = [...categoryListEl.querySelectorAll('.category-item')];
        const dragIdx = parseInt(dragging.dataset.index);
        const dragItem = state.categories[dragIdx];

        const newCategories = items.map(item => state.categories[parseInt(item.dataset.index)]);
        const prevSelectedItems = state.selectedIndices.map(i => state.categories[i]);

        if (state.recordAction) state.recordAction();
        state.categories = newCategories;
        state.selectedIndices = prevSelectedItems.map(item => state.categories.indexOf(item)).filter(i => i !== -1);
        state.lastSelectedIndex = state.categories.indexOf(dragItem);

        renderCategoryList();
        renderDetail();
        if (state.updateCodeView) state.updateCodeView();
    });

    return {
        renderCategoryList,
        renderDetail,
        renderColorPalette,
        populateAnimationOptions,
        getCategoryTags,
        COLOR_CODES
    };
}
