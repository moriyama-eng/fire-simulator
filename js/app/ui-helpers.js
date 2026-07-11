// ====================================================================
// js/app/ui-helpers.js
// UI補助関数群
// 依存: i18n.js, core/params.js のみ（state.js は参照しない）
// ====================================================================

import { t, setLanguage, getLanguage, formatCurrency } from '../i18n.js';
import { DEFAULTS, calcAutoDf } from '../core/params.js';

// ====================================================================
// t分布自由度パネルの更新（i18n対応・モジュールレベル）
// ====================================================================
export function updateDfPanel() {
    const dfToggle = document.getElementById('simDfToggle');
    const dfAutoDisplayWrapper = document.getElementById('dfAutoDisplayWrapper');
    const dfManualWrapper = document.getElementById('dfManualWrapper');
    const volatilityInput = document.getElementById('volatilityNum');
    if (!dfToggle) return;

    if (!dfToggle.checked) {
        // 固定 (unchecked)
        if (dfAutoDisplayWrapper) dfAutoDisplayWrapper.classList.add('hidden');
        if (dfManualWrapper) {
            dfManualWrapper.classList.remove('h-0', 'opacity-50', 'pointer-events-none');
            setTimeout(() => { dfManualWrapper.classList.add('opacity-100'); }, 10);
        }
    } else {
        // 自動 (checked)
        if (dfAutoDisplayWrapper) dfAutoDisplayWrapper.classList.remove('hidden');
        if (dfManualWrapper) {
            dfManualWrapper.classList.add('h-0', 'opacity-50', 'pointer-events-none');
            dfManualWrapper.classList.remove('opacity-100');
        }
        // 値の更新
        if (volatilityInput && dfAutoDisplayWrapper) {
            const vol = parseFloat(volatilityInput.value) || 18.0;
            const dfVal = calcAutoDf(vol).toFixed(1);
            const wrappedDf = '<span id="autoDfDisplay" class="font-bold text-indigo-300">' + dfVal + '</span>';
            dfAutoDisplayWrapper.innerHTML = t('market.dfAutoDisplay', [wrappedDf]);
        }
    }
}

/**
 * 現金バッファと月間取崩し額の値を言語に応じて変換する
 * @param {string} targetLang - 'ja' または 'en'
 */
export function convertCurrencyInputs(targetLang) {
    const cashInput = document.getElementById('initialCashBufferNum');
    const expenseInput = document.getElementById('monthlyExpenseNum');
    if (!cashInput || !expenseInput) return;

    // 現在の値を取得（カンマ除去）
    let cashVal = parseFloat(cashInput.value.replace(/,/g, ''));
    let expenseVal = parseFloat(expenseInput.value.replace(/,/g, ''));
    if (isNaN(cashVal)) cashVal = 0;
    if (isNaN(expenseVal)) expenseVal = 0;

    // ステップ・min・max を取得
    let cashStep = parseFloat(cashInput.getAttribute('step') || '500');
    let expenseStep = parseFloat(expenseInput.getAttribute('step') || '5');
    let cashMin = parseFloat(cashInput.getAttribute('min') || '0');
    let expenseMin = parseFloat(expenseInput.getAttribute('min') || '0');
    let cashMax = parseFloat(cashInput.getAttribute('max') || '10000');
    let expenseMax = parseFloat(expenseInput.getAttribute('max') || '500');

    if (targetLang === 'en') {
        // 日本語 → 英語（万円 → ドル、÷10）
        cashVal = cashVal / 10;
        expenseVal = expenseVal / 10;
        cashStep = cashStep / 10;
        expenseStep = expenseStep / 10;
        cashMin = cashMin / 10;
        expenseMin = expenseMin / 10;
        cashMax = cashMax / 10;
        expenseMax = expenseMax / 10;
    } else {
        // 英語 → 日本語（ドル → 万円、×10）
        cashVal = cashVal * 10;
        expenseVal = expenseVal * 10;
        cashStep = cashStep * 10;
        expenseStep = expenseStep * 10;
        cashMin = cashMin * 10;
        expenseMin = expenseMin * 10;
        cashMax = cashMax * 10;
        expenseMax = expenseMax * 10;
    }

    // 表示用フォーマット（整数なら小数点なし、それ以外は最大10桁まで表示・末尾0除去）
    const formatNum = (val) => {
        if (Number.isInteger(val)) return val.toString();
        return val.toFixed(10).replace(/\.?0+$/, '');
    };

    cashInput.value = formatNum(cashVal).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    expenseInput.value = formatNum(expenseVal).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // 属性を更新
    cashInput.setAttribute('step', cashStep.toString());
    expenseInput.setAttribute('step', expenseStep.toString());
    cashInput.setAttribute('min', cashMin.toString());
    expenseInput.setAttribute('min', expenseMin.toString());
    cashInput.setAttribute('max', cashMax.toString());
    expenseInput.setAttribute('max', expenseMax.toString());

    // 変更イベントを発火（dirty状態更新のため）
    cashInput.dispatchEvent(new Event('input', { bubbles: true }));
    expenseInput.dispatchEvent(new Event('input', { bubbles: true }));
}

// ====================================================================
// ツールチップ初期化（静的・動的を問わず全てのツールチップに適用）
// ====================================================================
export function initTooltips() {
    const tooltipContainer = document.getElementById('tooltip-container');
    if (!tooltipContainer) return;

    document.querySelectorAll('.tooltip-container').forEach(trigger => {
        const tooltip = trigger.querySelector('.tooltip-text');
        if (!tooltip) return;

        // ツールチップ本体を body 直下の専用領域に移動（まだ移動していない場合のみ）
        if (tooltip.parentElement !== tooltipContainer) {
            tooltipContainer.appendChild(tooltip);
        }

        // 既存のリスナーを削除してから再設定（重複防止）
        const removeListeners = () => {
            trigger.removeEventListener('mouseenter', trigger._mouseEnterHandler);
            trigger.removeEventListener('mouseleave', trigger._mouseLeaveHandler);
            trigger.removeEventListener('focusin', trigger._focusInHandler);
            trigger.removeEventListener('focusout', trigger._focusOutHandler);
        };
        removeListeners();

        const positionTooltip = () => {
            const triggerRect = trigger.getBoundingClientRect();
            const tooltipHeight = tooltip.offsetHeight;
            const tooltipWidth = tooltip.offsetWidth;
            const viewportWidth = window.innerWidth;

            let left = triggerRect.left + triggerRect.width / 2;
            const tooltipMargin = 16;
            const tooltipRight = left + tooltipWidth / 2;
            if (tooltipRight > viewportWidth - tooltipMargin) {
                left = viewportWidth - tooltipWidth / 2 - tooltipMargin;
            }
            const tooltipLeft = left - tooltipWidth / 2;
            if (tooltipLeft < tooltipMargin) {
                left = tooltipWidth / 2 + tooltipMargin;
            }

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${triggerRect.top - tooltipHeight - tooltipMargin}px`;
            tooltip.style.transform = 'translateX(-50%)';
        };

        const mouseEnterHandler = () => {
            positionTooltip();
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
            window.addEventListener('scroll', positionTooltip);
        };
        const mouseLeaveHandler = () => {
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
            window.removeEventListener('scroll', positionTooltip);
        };

        // ハンドラを保存して後で削除できるようにする
        trigger._mouseEnterHandler = mouseEnterHandler;
        trigger._mouseLeaveHandler = mouseLeaveHandler;
        trigger._focusInHandler = mouseEnterHandler;  // focusin は同じ処理
        trigger._focusOutHandler = mouseLeaveHandler; // focusout は同じ処理

        trigger.addEventListener('mouseenter', mouseEnterHandler);
        trigger.addEventListener('mouseleave', mouseLeaveHandler);
        trigger.addEventListener('focusin', mouseEnterHandler);
        trigger.addEventListener('focusout', mouseLeaveHandler);
    });
}

// ====================================================================
// ハイブリッド入力（ステッパーボタン付き数値入力）の初期化
// ====================================================================
export function setupHybridInputs() {
    const buttons = document.querySelectorAll('.stepper-btn');

    // 各インプットフィールドの属性から小数点以下の表示桁数を判定する
    function getPrecision(input) {
        const stepAttr = input.getAttribute('step') || "1";
        // リアルタイムの画面表示値を使用（カンマ除去）
        const currentValue = (input.value || "0").replace(/,/g, '');

        if (stepAttr.includes('.')) {
            return stepAttr.split('.')[1].length;
        }
        if (currentValue.includes('.')) {
            return currentValue.split('.')[1].length;
        }
        return 0;
    }

    buttons.forEach(btn => {
        let intervalId;
        let timeoutId;
        let isLongPress = false; // 長押し中フラグ（clickとの重複防止）

        const startIncrement = () => {
            isLongPress = true;
            updateValue();
            // 最初の遅延後に連続更新開始
            timeoutId = setTimeout(() => {
                intervalId = setInterval(updateValue, 50);
            }, 400); // 400ms長押しで連続開始
        };

        const stopIncrement = () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            // clickイベントとの競合（二重発火）を防ぐため、フラグクリアを遅延させる
            setTimeout(() => {
                isLongPress = false;
            }, 50);
        };

        const updateValue = () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;

            let val = Number(input.value.replace(/,/g, ''));
            const step = Number(input.getAttribute('step')) || 1;
            const min = Number(input.getAttribute('min'));
            const max = Number(input.getAttribute('max'));
            const isIncrement = btn.classList.contains('increment');

            if (isIncrement) {
                val += step;
            } else {
                val -= step;
            }

            // min, max でクランプ
            let clamped = false;
            if (val < min) { val = min; clamped = true; }
            if (val > max) { val = max; clamped = true; }

            if (clamped) {
                const container = input.closest('.stepper-value-container');
                if (container) {
                    container.classList.add('ring-2', 'ring-rose-500', 'ring-offset-2', 'ring-offset-slate-900', 'transition-all', 'duration-300');
                    setTimeout(() => {
                        container.classList.remove('ring-2', 'ring-rose-500');
                        setTimeout(() => container.classList.remove('ring-offset-2', 'ring-offset-slate-900', 'transition-all', 'duration-300'), 300);
                    }, 500);
                } else {
                    input.classList.add('ring-2', 'ring-rose-500');
                    setTimeout(() => input.classList.remove('ring-2', 'ring-rose-500'), 500);
                }
            }

            // 浮動小数点の丸め誤差を防ぎ、かつHTML属性に基づく表示桁数を維持する
            const precision = getPrecision(input);
            const formatted = val.toFixed(precision);

            if (input.classList.contains('formatted-number')) {
                const parts = formatted.split('.');
                parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                input.value = parts.join('.');
            } else {
                input.value = formatted;
            }

            // 値が変更されたらイベントを発火
            input.dispatchEvent(new Event('input', { bubbles: true }));
            // markInputChanged は actions.js で定義されているため、カスタムイベントで通知
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // マウスタッチイベントの登録
        btn.addEventListener('mousedown', (e) => {
            // 左クリックのみ反応
            if (e.button !== 0) return;
            e.preventDefault();
            startIncrement();
        });
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // デフォルトのスワイプ等を防ぐ
            startIncrement();
        });

        btn.addEventListener('mouseup', stopIncrement);
        btn.addEventListener('mouseleave', stopIncrement);
        btn.addEventListener('touchend', stopIncrement);
        btn.addEventListener('touchcancel', stopIncrement);

        // キーボード操作 (Enter / Space) による単発増減
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                updateValue();
            }
        });
    });

    // 各インプットフィールドにフォーカスが外れた時のバリデーション（範囲内にクランプ）を追加
    document.querySelectorAll('.stepper-input').forEach(input => {
        input.addEventListener('blur', () => {
            let val = Number(input.value.replace(/,/g, ''));
            if (!Number.isFinite(val)) {
                val = Number(input.getAttribute('min')) || 0;
            }
            const min = Number(input.getAttribute('min'));
            const max = Number(input.getAttribute('max'));
            const step = Number(input.getAttribute('step')) || 1;

            let clamped = false;
            if (val < min) { val = min; clamped = true; }
            if (val > max) { val = max; clamped = true; }

            if (clamped) {
                const container = input.closest('.stepper-value-container');
                if (container) {
                    container.classList.add('ring-2', 'ring-rose-500', 'ring-offset-2', 'ring-offset-slate-900', 'transition-all', 'duration-300');
                    setTimeout(() => {
                        container.classList.remove('ring-2', 'ring-rose-500');
                        setTimeout(() => container.classList.remove('ring-offset-2', 'ring-offset-slate-900', 'transition-all', 'duration-300'), 300);
                    }, 500);
                } else {
                    input.classList.add('ring-2', 'ring-rose-500');
                    setTimeout(() => input.classList.remove('ring-2', 'ring-rose-500'), 500);
                }
            }

            const precision = getPrecision(input);
            const formatted = val.toFixed(precision);

            if (input.classList.contains('formatted-number')) {
                const parts = formatted.split('.');
                parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                input.value = parts.join('.');
            } else {
                input.value = formatted;
            }
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    // getPrecision はローカルスコープ（クロージャ）に閉じているので blur ハンドラ内でも呼べる
    function getPrecision(input) {
        const stepAttr = input.getAttribute('step') || "1";
        const currentValue = (input.value || "0").replace(/,/g, '');
        if (stepAttr.includes('.')) return stepAttr.split('.')[1].length;
        if (currentValue.includes('.')) return currentValue.split('.')[1].length;
        return 0;
    }
}
