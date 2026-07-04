// ====================================================================
// js/core/state.js
// dirty 状態管理とボタン制御
// 注意: サマリーカードの警告バッジは app.js 側の markInputChanged ラッパーで処理する。
//       そのため、このモジュールは基本的なフラグ操作とボタン制御のみを提供する。
// ====================================================================

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
        btn.title = enabled ? '' : '入力条件が変更されました。再度シミュレーションを実行してください。';
    });
}