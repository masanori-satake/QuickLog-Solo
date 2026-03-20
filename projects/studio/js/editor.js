/**
 * QL-Animation Studio - Editor Module
 */

export function initEditor(state, elements) {
    const {
        inputVars, inputSetup, inputDraw, inputInteraction,
        codeTabs, editors, toggleWrapBtn, showSearchBtn,
        searchBar, searchInput, replaceInput, btnReplace,
        btnReplaceAll, closeSearchBtn
    } = elements;

    // Internal state
    let isWordWrap = true;

    function handleKeyDown(e, ta) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
            ta.selectionStart = ta.selectionEnd = start + 2;
            updateHighlight(ta);
        } else if (e.key === 'Enter') {
            const start = ta.selectionStart;
            const line = ta.value.substring(0, start).split('\n').pop();
            const match = line.match(/^\s*/);
            if (match && match[0].length > 0) {
                e.preventDefault();
                const indent = '\n' + match[0];
                ta.value = ta.value.substring(0, start) + indent + ta.value.substring(start);
                ta.selectionStart = ta.selectionEnd = start + indent.length;
                updateHighlight(ta);
                updateGutter(ta);
            }
        } else if (['{', '[', '(', '"', "'"].includes(e.key)) {
            const pairs = { '{': '}', '[': ']', '(': ')', '"': '"', "'": "'" };
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            if (start === end) {
                e.preventDefault();
                ta.value = ta.value.substring(0, start) + e.key + pairs[e.key] + ta.value.substring(end);
                ta.selectionStart = ta.selectionEnd = start + 1;
                updateHighlight(ta);
            }
        }
    }

    function updateHighlight(ta) {
        const highlightEl = ta.parentElement.querySelector('.editor-highlight');
        if (!highlightEl) return;

        const code = ta.value;
        const lines = code.split('\n');

        const rules = [
            { regex: /\/\/.*/g, class: 'hl-comment' },
            { regex: /\/\*[\s\S]*?\*\//g, class: 'hl-comment' },
            { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, class: 'hl-string' },
            { regex: /\b(class|extends|export|default|static|this|new|if|else|for|while|return|function|let|const|var|async|await|try|catch|finally|throw)\b/g, class: 'hl-keyword' },
            { regex: /\b\d+\b/g, class: 'hl-number' },
            { regex: /\b(\w+)(?=\s*\()/g, class: 'hl-function' },
            { regex: /[{}[\]()]/g, class: 'hl-bracket' }
        ];

        highlightEl.replaceChildren();
        lines.forEach(line => {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'logical-line';
            if (!line) {
                lineDiv.textContent = '\u00A0';
                highlightEl.appendChild(lineDiv);
                return;
            }

            let parts = [{ text: line, isToken: false }];

            rules.forEach(rule => {
                const newParts = [];
                parts.forEach(part => {
                    if (part.isToken) {
                        newParts.push(part);
                        return;
                    }

                    let lastIndex = 0;
                    let match;
                    const regex = new RegExp(rule.regex); // Create new to reset lastIndex
                    while ((match = regex.exec(part.text)) !== null) {
                        if (match.index > lastIndex) {
                            newParts.push({ text: part.text.substring(lastIndex, match.index), isToken: false });
                        }
                        newParts.push({ text: match[0], isToken: true, className: rule.class });
                        lastIndex = regex.lastIndex;
                        if (!regex.global) break;
                        if (match.index === regex.lastIndex) regex.lastIndex++; // Avoid infinite loop
                    }
                    if (lastIndex < part.text.length) {
                        newParts.push({ text: part.text.substring(lastIndex), isToken: false });
                    }
                });
                parts = newParts;
            });

            parts.forEach(part => {
                if (part.isToken) {
                    const span = document.createElement('span');
                    span.className = part.className;
                    span.textContent = part.text;
                    lineDiv.appendChild(span);
                } else {
                    lineDiv.appendChild(document.createTextNode(part.text));
                }
            });
            highlightEl.appendChild(lineDiv);
        });
    }

    function updateGutter(ta) {
        const gutter = ta.closest('.editor-body').querySelector('.editor-gutter');
        if (!gutter) return;

        gutter.replaceChildren();
        updateHighlight(ta);

        const highlight = ta.parentElement.querySelector('.editor-highlight');
        const logicalLines = highlight.querySelectorAll('.logical-line');
        logicalLines.forEach((lineEl, idx) => {
            const numDiv = document.createElement('div');
            numDiv.textContent = idx + 1;
            numDiv.style.height = `${lineEl.offsetHeight}px`;
            numDiv.style.lineHeight = `${lineEl.offsetHeight}px`;
            numDiv.style.display = 'flex';
            numDiv.style.alignItems = 'flex-start';
            numDiv.style.justifyContent = 'flex-end';
            gutter.appendChild(numDiv);
        });
    }

    function syncScroll(ta) {
        const wrapper = ta.parentElement;
        const highlight = wrapper.querySelector('.editor-highlight');
        const gutter = ta.closest('.editor-body').querySelector('.editor-gutter');

        if (highlight) {
            highlight.scrollTop = ta.scrollTop;
            highlight.scrollLeft = ta.scrollLeft;
        }
        if (gutter) {
            gutter.scrollTop = ta.scrollTop;
        }
    }

    function handleReplace(all) {
        const activeTab = document.querySelector('.code-tab.active');
        const targetId = activeTab.getAttribute('data-target');
        const ta = document.getElementById(targetId).querySelector('textarea');
        if (!ta) return;

        const search = searchInput.value;
        const replace = replaceInput.value;
        if (!search) return;

        const code = ta.value;
        if (all) {
            ta.value = code.split(search).join(replace);
        } else {
            ta.value = code.replace(search, replace);
        }
        updateHighlight(ta);
        updateGutter(ta);
        if (state.markDirty) state.markDirty();
    }

    function updateAllHighlight() {
        [inputVars, inputSetup, inputDraw, inputInteraction].forEach(ta => updateHighlight(ta));
    }

    function updateAllGutter() {
        [inputVars, inputSetup, inputDraw, inputInteraction].forEach(ta => updateGutter(ta));
    }

    // Event Listeners
    [inputVars, inputSetup, inputDraw, inputInteraction].forEach(el => {
        el.addEventListener('input', () => {
            if (state.markDirty) state.markDirty();
            updateGutter(el);
            updateHighlight(el);
        });
        el.addEventListener('scroll', () => {
            syncScroll(el);
        });
        el.addEventListener('keydown', (e) => handleKeyDown(e, el));
    });

    codeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            codeTabs.forEach(t => t.classList.remove('active'));
            editors.forEach(e => e.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            const target = document.getElementById(targetId);
            target.classList.add('active');

            const textarea = target.querySelector('textarea');
            if (textarea) {
                updateHighlight(textarea);
                updateGutter(textarea);
                syncScroll(textarea);
            }
        });
    });

    toggleWrapBtn.addEventListener('click', () => {
        isWordWrap = !isWordWrap;
        toggleWrapBtn.classList.toggle('active', isWordWrap);
        document.querySelectorAll('.editor-textarea, .editor-highlight').forEach(el => {
            if (isWordWrap) {
                el.classList.remove('no-wrap');
            } else {
                el.classList.add('no-wrap');
            }
        });
        updateAllGutter();
    });

    showSearchBtn.addEventListener('click', () => {
        searchBar.classList.toggle('hidden');
        if (!searchBar.classList.contains('hidden')) {
            searchInput.focus();
        }
    });

    closeSearchBtn.addEventListener('click', () => {
        searchBar.classList.add('hidden');
    });

    btnReplace.addEventListener('click', () => handleReplace(false));
    btnReplaceAll.addEventListener('click', () => handleReplace(true));

    window.addEventListener('resize', () => {
        setTimeout(updateAllGutter, 50);
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!searchBar.classList.contains('hidden')) {
                searchBar.classList.add('hidden');
            }
        }
    });

    // Public methods
    return {
        updateAllHighlight,
        updateAllGutter
    };
}
