// ====================================================================
// src/core/state.ts
// Dirty state management and button control
// Note: The warning badge on the summary card is handled by the markInputChanged wrapper on the app.js side.
//       Therefore, this module provides only basic flag operations and button control.
// ====================================================================

function getTooltipDirty(): string {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { __t?: (k: string) => string }).__t === 'function') {
        return (globalThis as unknown as { __t: (k: string) => string }).__t('button.tooltipDirty');
    }
    const lang = (typeof globalThis !== 'undefined' && globalThis.__currentLang) ? globalThis.__currentLang : 'ja';
    return lang === 'en'
        ? 'Simulation has not been run (recalculation required)'
        : 'シミュレーション未実行（再計算が必要です）';
}

let isResultDirty = false;

export function getIsResultDirty(): boolean {
    return isResultDirty;
}

export function setDirty(value: boolean): void {
    isResultDirty = value;
}

export function markInputChanged(): void {
    setDirty(true);
    setButtonsEnabledForResult(false);
}

export function markResultClean(): void {
    setDirty(false);
    setButtonsEnabledForResult(true);
}

export function setButtonsEnabledForResult(enabled: boolean): void {
    if (typeof document === 'undefined') return;
    const btnIds = ['shareXBtn', 'saveImageBtn', 'openCompareTabBtn', 'copySimUrlBtn'];
    btnIds.forEach(id => {
        const btn = document.getElementById(id) as HTMLButtonElement | null;
        if (!btn) return;
        btn.disabled = !enabled;
        btn.title = enabled ? '' : getTooltipDirty();
    });
}
