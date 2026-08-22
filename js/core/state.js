// ====================================================================
// js/core/state.js
// Dirty state management and button control
// Note: The warning badge on the summary card is handled by the markInputChanged wrapper on the app.js side.
//       Therefore, this module provides only basic flag operations and button control.
// ====================================================================

import { t } from '../i18n.js';

let isResultDirty = false;

export function getIsResultDirty() { return isResultDirty; }

export function setDirty(value) {
    isResultDirty = value;
}

export function markInputChanged() {
    setDirty(true);
    setButtonsEnabledForResult(false);
}

export function markResultClean() {
    setDirty(false);
    setButtonsEnabledForResult(true);
}

export function setButtonsEnabledForResult(enabled) {
    const btnIds = ['shareXBtn', 'saveImageBtn', 'openCompareTabBtn', 'copySimUrlBtn'];
    btnIds.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !enabled;
        btn.title = enabled ? '' : t('button.tooltipDirty');
    });
}