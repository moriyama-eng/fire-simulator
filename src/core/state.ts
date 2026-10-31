// ====================================================================
// src/core/state.ts
// Dirty state management and button control
// Note: The warning badge on the summary card is handled by the markInputChanged wrapper in app/actions.ts.
//       Therefore, this module provides only basic flag operations and button control.
// ====================================================================

function getTooltipDirty(): string {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { __t?: (k: string) => string }).__t === 'function') {
        return (globalThis as unknown as { __t: (k: string) => string }).__t('button.tooltipDirty');
    }
    const lang = (typeof globalThis !== 'undefined' && globalThis.__currentLang) ? globalThis.__currentLang : 'ja';
    return lang === 'en'
        ? 'Simulation has not been run (recalculation required)'
        : '\u30b7\u30df\u30e5\u30ec\u30fc\u30b7\u30e7\u30f3\u672a\u5b9f\u884c\uff08\u518d\u8a08\u7b97\u304c\u5fc5\u8981\u3067\u3059\uff09';
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
