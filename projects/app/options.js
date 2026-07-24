/**
 * QuickLog-Solo: Options Page Script for Custom Animation
 */

import { putAnimationBlob, getAnimationBlob, deleteAnimationBlob } from './shared/js/idb_storage.js';

const getEl = (id) => document.getElementById(id);

// Simple internal translation dictionary for options page
const translations = {
    ja: {
        'options-title': 'カスタムアニメーション管理',
        'options-desc': '独自のアニメーションモジュール（.qlanim）を取り込んで、QuickLog-Solo の背景として設定・再生できます。',
        'status-current': '現在のカスタムアニメーション:',
        'section-import': 'インポート (登録)',
        'import-desc': '.qlanim ファイル、またはクリップボードから JSON テキストを登録します。',
        'btn-import-file': 'ファイルから読み込む',
        'btn-import-clip': 'クリップボードから貼り付け',
        'section-export': 'エクスポート (保存)',
        'export-desc': '現在保持しているカスタムアニメーションを出力します。',
        'btn-export-file': 'ファイルに保存',
        'btn-export-clip': 'クリップボードにコピー',
        'section-clear': '消去',
        'clear-desc': '保存されているカスタムアニメーションのデータを完全削除し、デフォルトに戻します。',
        'btn-clear': 'カスタムアニメーションを消去',
        'section-tools': '外部ツールへのリンク',
        'confirm-clear': '本当にカスタムアニメーションを完全に消去しますか？',
        'toast-imported': 'カスタムアニメーションをインポートしました！',
        'toast-copied': 'クリップボードにコピーしました！',
        'toast-deleted': '消去が完了しました。',
        'err-invalid-format': 'エラー: 不正な .qlanim フォーマットです。',
        'err-clipboard': 'クリップボードからの読み込みに失敗しました。アクセス権限を確認してください。',
        'err-parse': 'JSONのパースに失敗しました。不正なテキストです。'
    },
    en: {
        'options-title': 'Custom Animation Management',
        'options-desc': 'Import, save, and play your own custom animation modules (.qlanim) as background animations in QuickLog-Solo.',
        'status-current': 'Current Custom Animation:',
        'section-import': 'Import (Register)',
        'import-desc': 'Register from a .qlanim file or JSON text from the clipboard.',
        'btn-import-file': 'Load from File',
        'btn-import-clip': 'Paste from Clipboard',
        'section-export': 'Export (Save)',
        'export-desc': 'Output the currently held custom animation.',
        'btn-export-file': 'Save to File',
        'btn-export-clip': 'Copy to Clipboard',
        'section-clear': 'Clear',
        'clear-desc': 'Completely delete saved custom animation data and revert to default.',
        'btn-clear': 'Clear Custom Animation',
        'section-tools': 'Links to External Tools',
        'confirm-clear': 'Are you sure you want to completely clear the custom animation?',
        'toast-imported': 'Custom animation imported successfully!',
        'toast-copied': 'Copied to clipboard!',
        'toast-deleted': 'Cleared successfully.',
        'err-invalid-format': 'Error: Invalid .qlanim format.',
        'err-clipboard': 'Failed to read from clipboard. Please check permissions.',
        'err-parse': 'Failed to parse JSON. Invalid text.'
    }
};

let currentLang = 'ja';

function detectLanguage() {
    const lang = navigator.language || navigator.userLanguage;
    currentLang = (lang && lang.startsWith('ja')) ? 'ja' : 'en';
}

function applyLocalization() {
    detectLanguage();
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            el.textContent = translations[currentLang][key];
        }
    });
}

function showToast(message) {
    const toast = getEl('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Convert Base64 data URL to Blob
function base64ToBlob(base64Data, contentType = '') {
    const sliceSize = 1024;
    const parts = base64Data.split(',');
    const base64String = parts.length > 1 ? parts[1] : parts[0];
    const byteCharacters = atob(base64String);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

// Convert Blob to Base64 data URL
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Validate .qlanim package schema
function validateQlanim(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.format !== 'quicklog-animation-package') return false;
    if (typeof data.id !== 'string' || !data.id) return false;
    if (data.type !== 'js-module' && data.type !== 'gif-sprite') return false;
    if (!data.metadata || typeof data.metadata !== 'object') return false;
    if (!data.config || typeof data.config !== 'object') return false;
    if (!data.payload || typeof data.payload !== 'object') return false;

    if (data.type === 'js-module') {
        if (typeof data.payload.code !== 'string' || !data.payload.code) return false;
    } else if (data.type === 'gif-sprite') {
        if (typeof data.payload.imageData !== 'string' || !data.payload.imageData) return false;
        if (!data.payload.renderSpec || typeof data.payload.renderSpec !== 'object') return false;
    }
    return true;
}

// Save the imported qlanim package
async function saveCustomAnimation(data) {
    const { id, type, metadata, config, payload } = data;

    // Standard setting in storage sync: set activeAnimationId to the custom id
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        await chrome.storage.sync.set({ activeAnimationId: id });
    } else {
        localStorage.setItem('activeAnimationId', id);
    }

    // Tiering 2: Metadata index & payload code in local storage
    const custom_animation_metadata = { id, type, metadata, config };
    const localData = {
        custom_animation_metadata,
        [`custom_animation_code_${id}`]: payload.code || ''
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set(localData);
    } else {
        localStorage.setItem('custom_animation_metadata', JSON.stringify(custom_animation_metadata));
        if (payload.code) {
            localStorage.setItem(`custom_animation_code_${id}`, payload.code);
        }
    }

    // Tiering 3: Binary blob in IndexedDB if gif-sprite
    if (type === 'gif-sprite') {
        const mimeType = payload.imageData.match(/data:([^;]+);/)?.[1] || 'image/gif';
        const blob = base64ToBlob(payload.imageData, mimeType);
        await putAnimationBlob(id, blob);
    }

    updateStatusUI();
    showToast(translations[currentLang]['toast-imported']);
}

// Update the options UI state
async function updateStatusUI() {
    let metadata = null;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const res = await chrome.storage.local.get('custom_animation_metadata');
        metadata = res.custom_animation_metadata;
    } else {
        const raw = localStorage.getItem('custom_animation_metadata');
        if (raw) metadata = JSON.parse(raw);
    }

    const statusBox = getEl('status-box');
    const currentName = getEl('current-anim-name');
    const exportFileBtn = getEl('export-file-btn');
    const exportClipBtn = getEl('export-clip-btn');
    const clearBtn = getEl('clear-btn');

    if (metadata) {
        statusBox.classList.add('active');
        const name = typeof metadata.metadata.name === 'object'
            ? (metadata.metadata.name[currentLang] || metadata.metadata.name['en'] || metadata.id)
            : metadata.metadata.name;
        currentName.textContent = name || metadata.id;

        exportFileBtn.disabled = false;
        exportClipBtn.disabled = false;
        clearBtn.disabled = false;
    } else {
        statusBox.classList.remove('active');
        currentName.textContent = '-';

        exportFileBtn.disabled = true;
        exportClipBtn.disabled = true;
        clearBtn.disabled = true;
    }
}

// Reconstruct the full .qlanim package for exporting
async function reconstructQlanim() {
    let metadata = null;
    let code = '';

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const res = await chrome.storage.local.get('custom_animation_metadata');
        metadata = res.custom_animation_metadata;
        if (metadata) {
            const codeRes = await chrome.storage.local.get(`custom_animation_code_${metadata.id}`);
            code = codeRes[`custom_animation_code_${metadata.id}`] || '';
        }
    } else {
        const raw = localStorage.getItem('custom_animation_metadata');
        if (raw) {
            metadata = JSON.parse(raw);
            code = localStorage.getItem(`custom_animation_code_${metadata.id}`) || '';
        }
    }

    if (!metadata) return null;

    const packageData = {
        format: 'quicklog-animation-package',
        formatVersion: '1.0',
        id: metadata.id,
        type: metadata.type,
        metadata: metadata.metadata,
        config: metadata.config,
        payload: {}
    };

    if (metadata.type === 'js-module') {
        packageData.payload.code = code;
    } else if (metadata.type === 'gif-sprite') {
        const blob = await getAnimationBlob(metadata.id);
        if (blob) {
            const dataUrl = await blobToBase64(blob);
            packageData.payload.imageData = dataUrl;
            packageData.payload.renderSpec = metadata.config.renderSpec || {};
        }
    }

    return packageData;
}

// Event Handlers
getEl('import-file-btn').addEventListener('click', () => {
    getEl('file-input').click();
});

getEl('file-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (validateQlanim(data)) {
                if (data.type === 'gif-sprite' && !data.config.renderSpec) {
                    data.config.renderSpec = data.payload.renderSpec;
                }
                await saveCustomAnimation(data);
            } else {
                alert(translations[currentLang]['err-invalid-format']);
            }
        } catch (err) {
            console.error(err);
            alert(translations[currentLang]['err-parse']);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
});

getEl('import-clip-btn').addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) return;
        const data = JSON.parse(text);
        if (validateQlanim(data)) {
            if (data.type === 'gif-sprite' && !data.config.renderSpec) {
                data.config.renderSpec = data.payload.renderSpec;
            }
            await saveCustomAnimation(data);
        } else {
            alert(translations[currentLang]['err-invalid-format']);
        }
    } catch (err) {
        console.error(err);
        alert(translations[currentLang]['err-clipboard']);
    }
});

getEl('export-file-btn').addEventListener('click', async () => {
    const data = await reconstructQlanim();
    if (!data) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.id}.qlanim`;
    a.click();
    URL.revokeObjectURL(url);
});

getEl('export-clip-btn').addEventListener('click', async () => {
    const data = await reconstructQlanim();
    if (!data) return;

    try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        showToast(translations[currentLang]['toast-copied']);
    } catch (err) {
        console.error(err);
    }
});

getEl('clear-btn').addEventListener('click', async () => {
    if (confirm(translations[currentLang]['confirm-clear'])) {
        let customId = '';
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const res = await chrome.storage.local.get('custom_animation_metadata');
            if (res.custom_animation_metadata) {
                customId = res.custom_animation_metadata.id;
            }
            await chrome.storage.local.remove([
                'custom_animation_metadata',
                `custom_animation_code_${customId}`
            ]);
            await chrome.storage.sync.remove('activeAnimationId');
        } else {
            const raw = localStorage.getItem('custom_animation_metadata');
            if (raw) {
                const metadata = JSON.parse(raw);
                customId = metadata.id;
            }
            localStorage.removeItem('custom_animation_metadata');
            localStorage.removeItem(`custom_animation_code_${customId}`);
            localStorage.removeItem('activeAnimationId');
        }

        if (customId) {
            await deleteAnimationBlob(customId);
        }

        updateStatusUI();
        showToast(translations[currentLang]['toast-deleted']);
    }
});

// Setup on load
document.addEventListener('DOMContentLoaded', () => {
    applyLocalization();
    updateStatusUI();
});
