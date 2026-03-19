/**
 * QL-Animation Studio - IO Module
 */

export function initIO(state, elements) {
    const {
        downloadBtn, uploadBtn, uploadInput, prBtn, prModal,
        closePrBtns, metaName, metaAuthor, metaDesc, configRewindable,
        configMode, configExclusionStrategy, inputVars, inputSetup,
        inputDraw, inputInteraction
    } = elements;

    function getMsg(key) {
        if (state.getMsg) return state.getMsg(key);
        return key;
    }

    function buildModuleCode() {
        const baseUrl = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
        const animationBaseUrl = `${baseUrl}/shared/js/animation_base.js`;

        const escapeJSString = (str) => {
            return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        };

        const indentCode = (code, spaces) => {
            if (!code || !code.trim()) return '';
            return code.split('\n').map(line => ' '.repeat(spaces) + line).join('\n').trimStart();
        };

        if (state.saveCurrentMetaData) state.saveCurrentMetaData();

        return `import { AnimationBase } from '${animationBaseUrl}';

export default class CustomAnimation extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: ${JSON.stringify(state.metaData.name, null, 8).trimStart()},
        description: ${JSON.stringify(state.metaData.description, null, 8).trimStart()},
        author: "${escapeJSString(metaAuthor.value)}",
        rewindable: ${configRewindable.checked}
    };

    config = {
        mode: '${configMode.value}',
        exclusionStrategy: '${configExclusionStrategy.value}'
    };

    ${indentCode(inputVars.value, 4)}

    ${indentCode(inputSetup.value, 4)}

    ${indentCode(inputDraw.value, 4)}

    ${indentCode(inputInteraction.value, 4)}
}`;
    }

    function downloadAnimation() {
        let code = buildModuleCode();
        code = code.replace(/import\s*{\s*AnimationBase\s*}\s*from\s*['"].*\/js\/animation_base\.js['"]/, "import { AnimationBase } from '../animation_base.js'");
        const blob = new Blob([code], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${metaName.value.toLowerCase().replace(/\s+/g, '_') || 'animation'}.js`;
        a.click();
        URL.revokeObjectURL(url);
        state.isDirty = false;
        if (state.showToast) state.showToast(getMsg('toast-downloaded-js'));
    }

    function handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            if (file.name.endsWith('.json')) {
                try {
                    const data = JSON.parse(content);
                    state.metaData.name = typeof data.name === 'object' ? { ...data.name } : { en: data.name || '' };
                    state.metaData.description = typeof data.description === 'object' ? { ...data.description } : { en: data.description || '' };
                    if (state.loadCurrentMetaData) state.loadCurrentMetaData();
                    metaAuthor.value = data.author || '';
                    configMode.value = data.mode || 'canvas';
                    configExclusionStrategy.value = data.exclusionStrategy || 'mask';
                    configRewindable.checked = !!data.rewindable;
                    if (state.updateTapeControlState) state.updateTapeControlState();
                    inputVars.value = data.vars || '';
                    inputSetup.value = data.setup || '';
                    inputDraw.value = data.draw || '';
                    inputInteraction.value = data.interaction || '';
                    state.isDirty = false;
                    if (state.showToast) state.showToast(getMsg('toast-loaded-json'));
                    if (state.updateAllHighlight) state.updateAllHighlight();
                    if (state.updateAllGutter) state.updateAllGutter();
                } catch {
                    if (state.showToast) state.showToast(getMsg('toast-invalid-json'));
                }
            } else if (file.name.endsWith('.js')) {
                if (state.parseAndPopulate) state.parseAndPopulate(content, { name: 'Imported', description: '', author: '' });
                state.isDirty = false;
                if (state.showToast) state.showToast(getMsg('toast-loaded-js'));
                if (state.updateAllHighlight) state.updateAllHighlight();
                if (state.updateAllGutter) state.updateAllGutter();
            }
        };
        reader.readAsText(file);
    }

    // Event Listeners
    downloadBtn.addEventListener('click', downloadAnimation);
    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', handleUpload);
    prBtn.addEventListener('click', () => prModal.classList.remove('hidden'));
    closePrBtns.forEach(btn => btn.addEventListener('click', () => prModal.classList.add('hidden')));
    prModal.addEventListener('click', (e) => {
        if (e.target === prModal) {
            prModal.classList.add('hidden');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!prModal.classList.contains('hidden')) {
                prModal.classList.add('hidden');
            }
        }
    });

    return {
        buildModuleCode
    };
}
