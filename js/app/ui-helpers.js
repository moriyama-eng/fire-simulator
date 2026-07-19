// ====================================================================
// js/app/ui-helpers.js
// UI helper functions
// Dependencies: i18n.js, core/params.js only (does not reference state.js)
// ====================================================================

import { t, setLanguage, getLanguage, formatCurrency } from '../i18n.js';
import { DEFAULTS, calcAutoDf } from '../core/params.js';

// ====================================================================
// Update the t-distribution degrees of freedom panel (i18n-compatible, module level)
// ====================================================================
export function updateDfPanel() {
    const dfToggle = document.getElementById('simDfToggle');
    const dfAutoDisplayWrapper = document.getElementById('dfAutoDisplayWrapper');
    const dfManualWrapper = document.getElementById('dfManualWrapper');
    const volatilityInput = document.getElementById('volatilityNum');
    if (!dfToggle) return;

    if (!dfToggle.checked) {
        // Fixed (unchecked)
        if (dfAutoDisplayWrapper) dfAutoDisplayWrapper.classList.add('hidden');
        if (dfManualWrapper) {
            dfManualWrapper.classList.remove('h-0', 'opacity-50', 'pointer-events-none');
            setTimeout(() => { dfManualWrapper.classList.add('opacity-100'); }, 10);
        }
    } else {
        // Auto (checked)
        if (dfAutoDisplayWrapper) dfAutoDisplayWrapper.classList.remove('hidden');
        if (dfManualWrapper) {
            dfManualWrapper.classList.add('h-0', 'opacity-50', 'pointer-events-none');
            dfManualWrapper.classList.remove('opacity-100');
        }
        // Update value
        if (volatilityInput && dfAutoDisplayWrapper) {
            const vol = parseFloat(volatilityInput.value) || 18.0;
            const dfVal = calcAutoDf(vol).toFixed(1);
            const wrappedDf = '<span id="autoDfDisplay" class="font-bold text-indigo-300">' + dfVal + '</span>';
            dfAutoDisplayWrapper.innerHTML = t('market.dfAutoDisplay', [wrappedDf]);
        }
    }
}

/**
 * Converts the values of cash buffer and monthly withdrawal amount according to the language.
 * @param {string} targetLang - 'ja' or 'en'
 */
export function convertCurrencyInputs(targetLang) {
    const cashInput = document.getElementById('initialCashBufferNum');
    const expenseInput = document.getElementById('monthlyExpenseNum');
    if (!cashInput || !expenseInput) return;

    // Get the current values (remove commas)
    let cashVal = parseFloat(cashInput.value.replace(/,/g, ''));
    let expenseVal = parseFloat(expenseInput.value.replace(/,/g, ''));
    if (isNaN(cashVal)) cashVal = 0;
    if (isNaN(expenseVal)) expenseVal = 0;

    // Get step, min, max
    let cashStep = parseFloat(cashInput.getAttribute('step') || '500');
    let expenseStep = parseFloat(expenseInput.getAttribute('step') || '5');
    let cashMin = parseFloat(cashInput.getAttribute('min') || '0');
    let expenseMin = parseFloat(expenseInput.getAttribute('min') || '0');
    let cashMax = parseFloat(cashInput.getAttribute('max') || '10000');
    let expenseMax = parseFloat(expenseInput.getAttribute('max') || '500');

    if (targetLang === 'en') {
        // Japanese → English (10,000 yen → dollar, ÷10)
        cashVal = cashVal / 10;
        expenseVal = expenseVal / 10;
        cashStep = cashStep / 10;
        expenseStep = expenseStep / 10;
        cashMin = cashMin / 10;
        expenseMin = expenseMin / 10;
        cashMax = cashMax / 10;
        expenseMax = expenseMax / 10;
    } else {
        // English → Japanese (dollar → 10,000 yen, ×10)
        cashVal = cashVal * 10;
        expenseVal = expenseVal * 10;
        cashStep = cashStep * 10;
        expenseStep = expenseStep * 10;
        cashMin = cashMin * 10;
        expenseMin = expenseMin * 10;
        cashMax = cashMax * 10;
        expenseMax = expenseMax * 10;
    }

    // Display format (no decimal if integer, otherwise display up to 10 digits removing trailing zeros)
    const formatNum = (val) => {
        if (Number.isInteger(val)) return val.toString();
        return val.toFixed(10).replace(/\.?0+$/, '');
    };

    cashInput.value = formatNum(cashVal).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    expenseInput.value = formatNum(expenseVal).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Update attributes
    cashInput.setAttribute('step', cashStep.toString());
    expenseInput.setAttribute('step', expenseStep.toString());
    cashInput.setAttribute('min', cashMin.toString());
    expenseInput.setAttribute('min', expenseMin.toString());
    cashInput.setAttribute('max', cashMax.toString());
    expenseInput.setAttribute('max', expenseMax.toString());

    // Fire change event (to update dirty state)
    cashInput.dispatchEvent(new Event('input', { bubbles: true }));
    expenseInput.dispatchEvent(new Event('input', { bubbles: true }));
}

// ====================================================================
// Tooltip initialization (applies to all tooltips, both static and dynamic)
// ====================================================================
export function initTooltips() {
    const tooltipContainer = document.getElementById('tooltip-container');
    if (!tooltipContainer) return;

    document.querySelectorAll('.tooltip-container').forEach(trigger => {
        const tooltip = trigger.querySelector('.tooltip-text');
        if (!tooltip) return;

        // Move the tooltip body to the dedicated area directly under body (only if not already moved)
        if (tooltip.parentElement !== tooltipContainer) {
            tooltipContainer.appendChild(tooltip);
        }

        // Remove existing listeners before re-setting (prevents duplicates)
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

        // Save handlers so they can be removed later
        trigger._mouseEnterHandler = mouseEnterHandler;
        trigger._mouseLeaveHandler = mouseLeaveHandler;
        trigger._focusInHandler = mouseEnterHandler;  // focusin uses the same processing
        trigger._focusOutHandler = mouseLeaveHandler; // focusout uses the same processing

        trigger.addEventListener('mouseenter', mouseEnterHandler);
        trigger.addEventListener('mouseleave', mouseLeaveHandler);
        trigger.addEventListener('focusin', mouseEnterHandler);
        trigger.addEventListener('focusout', mouseLeaveHandler);
    });
}

// ====================================================================
// Initialization of hybrid inputs (numeric inputs with stepper buttons)
// ====================================================================
export function setupHybridInputs() {
    const buttons = document.querySelectorAll('.stepper-btn');

    // Determine the number of decimal places to display based on the attributes of each input field
    function getPrecision(input) {
        const stepAttr = input.getAttribute('step') || "1";
        // Use the real-time display value (remove commas)
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
        let isLongPress = false; // Flag for long press in progress (prevents overlap with click)

        const startIncrement = () => {
            isLongPress = true;
            updateValue();
            // Start continuous update after initial delay
            timeoutId = setTimeout(() => {
                intervalId = setInterval(updateValue, 50);
            }, 400); // Start continuous on 400ms long press
        };

        const stopIncrement = () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            // Delay clearing the flag to prevent conflict (double firing) with click event
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

            // Clamp with min, max
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

            // Prevent floating point rounding errors while maintaining the number of decimal places based on HTML attributes
            const precision = getPrecision(input);
            const formatted = val.toFixed(precision);

            if (input.classList.contains('formatted-number')) {
                const parts = formatted.split('.');
                parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                input.value = parts.join('.');
            } else {
                input.value = formatted;
            }

            // Fire event when value changes
            input.dispatchEvent(new Event('input', { bubbles: true }));
            // Notify via custom event because markInputChanged is defined in actions.js
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Register mouse touch events
        btn.addEventListener('mousedown', (e) => {
            // Respond to left click only
            if (e.button !== 0) return;
            e.preventDefault();
            startIncrement();
        });
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent default swipe etc.
            startIncrement();
        });

        btn.addEventListener('mouseup', stopIncrement);
        btn.addEventListener('mouseleave', stopIncrement);
        btn.addEventListener('touchend', stopIncrement);
        btn.addEventListener('touchcancel', stopIncrement);

        // Single increment/decrement via keyboard operation (Enter / Space)
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                updateValue();
            }
        });
    });

    // Add validation (clamp to within range) when each input field loses focus
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

    // getPrecision is in the local scope (closure), so it can also be called inside the blur handler
    function getPrecision(input) {
        const stepAttr = input.getAttribute('step') || "1";
        const currentValue = (input.value || "0").replace(/,/g, '');
        if (stepAttr.includes('.')) return stepAttr.split('.')[1].length;
        if (currentValue.includes('.')) return currentValue.split('.')[1].length;
        return 0;
    }
}
