// ====================================================================
// src/app/init.ts
// All initialization processing inside DOMContentLoaded
// Dependencies: actions.ts, charts.ts, summary.ts, ui-helpers.ts,
//       state.ts, i18n.ts, core/url.ts, etc.
// ====================================================================

import { applyQueryParams } from '../core/url.js';
import { setProgressCallback } from '../simulation-engine.js';
import { t, setLanguage, getLanguage } from '../i18n.js';
import { DEFAULTS } from '../core/params.js';
import {
    getLastSimResult, getLastExecutedParams, getIsRunning,
    getAssetChart, getCashChart, getDdHistChart, getUwHistChart, getBelowInitChart, getSellChart,
} from './state.js';
import {
    markInputChanged, runMain, saveImage, shareToX,
    openCompareTab, copySimUrl, syncBaseToAnalysisIfOpen,
} from './actions.js';
import {
    renderAssetChart, onScaleToggle,
    applyDownsideFocus,
    renderCashChart, renderDdCdfChart, renderUwCdfChart,
    renderBelowInitCdfChart, renderConsecutiveSellCdfChart,
} from './charts.js';
import { renderEmptySummaryCard, updateSummaryCard } from './summary.js';
import {
    initTooltips, setupHybridInputs, updateDfPanel, convertCurrencyInputs,
} from './ui-helpers.js';

// ====================================================================
// i18n related functions
// ====================================================================
let isTranslating = false;
function applyTranslations(): void {
    if (isTranslating) return;
    isTranslating = true;
    try {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = t(key);
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            if (key) el.innerHTML = t(key);
        });
        document.querySelectorAll('[data-i18n-attr]').forEach(el => {
            const attrVal = el.getAttribute('data-i18n-attr');
            if (attrVal) {
                const spec = attrVal.split(':');
                if (spec.length === 2 && spec[0] && spec[1]) {
                    el.setAttribute(spec[0], t(spec[1]));
                }
            }
        });
        document.title = t('header.title');
    } finally {
        isTranslating = false;
    }
}

// MutationObserver: Guarantees translation of dynamically added elements
let translationObserver: MutationObserver | null = null;
function setupTranslationObserver(): void {
    if (translationObserver) translationObserver.disconnect();
    translationObserver = new MutationObserver(function (mutations: MutationRecord[]) {
        let needsTranslation = false;
        for (let i = 0; i < mutations.length; i++) {
            const mutation = mutations[i];
            if (mutation && mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (let j = 0; j < mutation.addedNodes.length; j++) {
                    const node = mutation.addedNodes[j];
                    if (node && node.nodeType === Node.ELEMENT_NODE) {
                        const el = node as Element;
                        if (el.hasAttribute && el.hasAttribute('data-i18n')) {
                            needsTranslation = true;
                            break;
                        }
                        if (el.querySelector && el.querySelector('[data-i18n]')) {
                            needsTranslation = true;
                            break;
                        }
                    }
                }
            }
            if (needsTranslation) break;
        }
        if (needsTranslation) {
            applyTranslations();
        }
    });
    translationObserver.observe(document.body, { childList: true, subtree: true });
}

// ====================================================================
// Update the active state of language buttons
// ====================================================================
function updateActiveLangButton(): void {
    const lang = getLanguage();
    document.querySelectorAll('.lang-btn').forEach(node => {
        const btn = node as HTMLElement;
        const btnLang = btn.dataset.lang;
        btn.classList.toggle('active', btnLang === lang);
        if (btnLang === lang) {
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.setAttribute('aria-pressed', 'false');
        }
    });
}

// ====================================================================
// Set up language switch buttons
// ====================================================================
function setupLangSwitcher(): void {
    document.querySelectorAll('.lang-btn').forEach(node => {
        const btn = node as HTMLElement;
        btn.addEventListener('click', () => {
            const lang = btn.dataset.lang;
            if (lang === 'ja' || lang === 'en') {
                setLanguage(lang);
            }
        });
    });
}

// ====================================================================
// All initialization processing inside DOMContentLoaded
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Set up progress display callback
    setProgressCallback((progress: number) => {
        const btn = document.getElementById('runBtn');
        if (!btn) return;
        btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>${t('button.running', [progress])}`;
        btn.style.background = `linear-gradient(to right, rgba(99, 102, 241, 0.8) ${progress}%, rgba(30, 41, 59, 1) ${progress}%)`;
    });

    // 2. Initialize hybrid inputs
    setupHybridInputs();

    // 3. Set up language switch buttons
    setupLangSwitcher();

    // 4. Start dynamic translation monitoring
    setupTranslationObserver();

    // 5. Apply initial translations
    applyTranslations();

    // 6. Language change event listener
    document.addEventListener('languageChanged', () => {
        // Skip language switching while simulation is running (main app or comparison tab)
        import('../comparison-state.js').then(CS => {
            if (getIsRunning() || CS.getIsRunning()) return;
            applyTranslations();
            updateDfPanel();
            // Convert currency inputs on language switch
            convertCurrencyInputs(getLanguage());
            const lastSimResult = getLastSimResult();
            const lastExecutedParams = getLastExecutedParams();
            if (lastSimResult && lastExecutedParams) {
                updateSummaryCard(lastSimResult, lastExecutedParams);
            } else {
                const cbToggle = document.getElementById('cashBufferToggle') as HTMLInputElement | null;
                renderEmptySummaryCard(cbToggle ? cbToggle.checked : false);
            }
            if (getAssetChart() && lastSimResult) {
                const logToggle = document.getElementById('logScaleToggle') as HTMLInputElement | null;
                const isLog = logToggle ? logToggle.checked : false;
                renderAssetChart(lastSimResult, isLog);
                const dfAsset = document.getElementById('downsideFocusAsset') as HTMLInputElement | null;
                applyDownsideFocus(getAssetChart(), dfAsset ? dfAsset.checked : false);
            }
            if (getCashChart() && lastSimResult) {
                renderCashChart(lastSimResult);
                const dfCash = document.getElementById('downsideFocusCash') as HTMLInputElement | null;
                applyDownsideFocus(getCashChart(), dfCash ? dfCash.checked : false);
            }
            if (getDdHistChart() && lastSimResult) renderDdCdfChart(lastSimResult);
            if (getUwHistChart() && lastSimResult) renderUwCdfChart(lastSimResult);
            // Redraw additional indicator charts on language switch
            if (getBelowInitChart() && lastSimResult) renderBelowInitCdfChart(lastSimResult);
            if (getSellChart() && lastSimResult) renderConsecutiveSellCdfChart(lastSimResult);
            import('../analysis-ui.js').then(AUI => {
                if (typeof document !== 'undefined') AUI.renderAnalysisTab();
            }).catch(() => {});
            // Redraw if comparison tab is open
            import('../comparison-ui.js').then(CUI => {
                if (typeof document !== 'undefined') {
                    const compTab = document.getElementById('comparisonTab');
                    if (compTab && !compTab.classList.contains('hidden')) {
                        CUI.renderComparisonTab();
                    }
                }
            }).catch(() => {});
            updateActiveLangButton();
        });
    });

    // 7. Run button
    const runBtn = document.getElementById('runBtn');
    if (runBtn) runBtn.addEventListener('click', runMain);

    // 8. Log/linear scale toggle
    const logScaleToggle = document.getElementById('logScaleToggle');
    if (logScaleToggle) logScaleToggle.addEventListener('change', onScaleToggle);

    // 9. X share button
    const shareXBtn = document.getElementById('shareXBtn');
    if (shareXBtn) shareXBtn.addEventListener('click', shareToX);

    // 10. Save image button
    const saveImageBtn = document.getElementById('saveImageBtn');
    if (saveImageBtn) saveImageBtn.addEventListener('click', saveImage);

    // 11. Fluctuation model select linkage
    const modelSelect = document.getElementById('returnModelSelect') as HTMLSelectElement | null;
    const tDistParams = document.getElementById('tDistParams');
    const updateModelPanel = (): void => {
        if (!modelSelect || !tDistParams) return;
        if (modelSelect.value === 'log-t') {
            tDistParams.classList.remove('opacity-50', 'pointer-events-none', 'hidden');
            tDistParams.classList.add('opacity-100');
        } else {
            tDistParams.classList.add('opacity-50', 'pointer-events-none', 'hidden');
            tDistParams.classList.remove('opacity-100');
        }
    };
    if (modelSelect) {
        modelSelect.addEventListener('change', updateModelPanel);
        updateModelPanel();
    }

    // 12. Degrees of freedom (auto/fixed) toggle linkage
    const dfToggle = document.getElementById('simDfToggle') as HTMLInputElement | null;
    const volatilityInput = document.getElementById('volatilityNum') as HTMLInputElement | null;

    if (dfToggle && volatilityInput) {
        dfToggle.addEventListener('change', updateDfPanel);
        volatilityInput.addEventListener('input', () => {
            if (dfToggle.checked) {
                updateDfPanel();
            }
        });
        updateDfPanel();
    }

    // 13. Random seed toggle linkage
    const seedToggle = document.getElementById('seedToggle') as HTMLInputElement | null;
    const seedInputWrapper = document.getElementById('seedInputWrapper');
    const updateSeedPanel = (): void => {
        if (!seedToggle || !seedInputWrapper) return;
        if (!seedToggle.checked) {
            // Fixed (unchecked)
            seedInputWrapper.classList.remove('opacity-50', 'pointer-events-none');
            seedInputWrapper.classList.add('opacity-100');
        } else {
            // Random (checked)
            seedInputWrapper.classList.add('opacity-50', 'pointer-events-none');
            seedInputWrapper.classList.remove('opacity-100');
        }
    };
    if (seedToggle) {
        seedToggle.addEventListener('change', updateSeedPanel);
        updateSeedPanel();
    }

    // 14. Inflation fluctuation model (AR-1) toggle linkage
    const infToggle = document.getElementById('inflationModelToggle') as HTMLInputElement | null;
    const arParamsPanel = document.getElementById('arModelParams');

    const updateArPanel = (): void => {
        if (!infToggle || !arParamsPanel) return;
        if (infToggle.checked) {
            arParamsPanel.classList.remove('opacity-50', 'pointer-events-none');
            arParamsPanel.classList.add('opacity-100');
        } else {
            arParamsPanel.classList.add('opacity-50', 'pointer-events-none');
            arParamsPanel.classList.remove('opacity-100');
        }
    };

    if (infToggle) {
        infToggle.addEventListener('change', updateArPanel);
        updateArPanel(); // Reflect initial load state
    }

    // 15. Cash buffer toggle linkage (bidirectional)
    const cbToggle = document.getElementById('cashBufferToggle') as HTMLInputElement | null;
    const cbParamsPanel = document.getElementById('cashBufferParams');
    const cbInput = document.getElementById('initialCashBufferNum') as HTMLInputElement | null;

    // Function to update the grayed-out state of the panel
    const updateCbPanel = (): void => {
        if (!cbToggle || !cbParamsPanel) return;
        if (cbToggle.checked) {
            cbParamsPanel.classList.remove('opacity-50', 'pointer-events-none');
            cbParamsPanel.classList.add('opacity-100');
        } else {
            cbParamsPanel.classList.add('opacity-50', 'pointer-events-none');
            cbParamsPanel.classList.remove('opacity-100');
        }
    };

    if (cbToggle && cbInput) {
        // When the toggle changes -> update the input value
        cbToggle.addEventListener('change', () => {
            if (cbToggle.checked) {
                // When turned ON: restore to default value (only if the current value is 0)
                if (parseFloat(cbInput.value.replace(/,/g, '')) === 0) {
                    cbInput.value = DEFAULTS.initialCashBuffer.toLocaleString('en-US');
                    cbInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else {
                // When turned OFF: set to 0
                cbInput.value = '0';
                cbInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            updateCbPanel();
            // Update summary card if not yet executed
            if (!getLastSimResult()) renderEmptySummaryCard(cbToggle.checked);
        });

        // When the input value changes -> update toggle state
        cbInput.addEventListener('input', () => {
            const val = parseFloat(cbInput.value.replace(/,/g, ''));
            if (val === 0) {
                if (cbToggle.checked) {
                    cbToggle.checked = false;
                    updateCbPanel();
                }
            } else {
                if (!cbToggle.checked) {
                    cbToggle.checked = true;
                    updateCbPanel();
                }
            }
            if (!getLastSimResult()) renderEmptySummaryCard(cbToggle.checked);
        });

        updateCbPanel(); // Reflect initial load state
    }

    // 16. Spending guardrail toggle linkage
    const grToggle = document.getElementById('guardrailToggle') as HTMLInputElement | null;
    const grParamsPanel = document.getElementById('guardrailParams');

    const updateGrPanel = (): void => {
        if (!grToggle || !grParamsPanel) return;
        if (grToggle.checked) {
            grParamsPanel.classList.remove('opacity-50', 'pointer-events-none');
            grParamsPanel.classList.add('opacity-100');
        } else {
            grParamsPanel.classList.add('opacity-50', 'pointer-events-none');
            grParamsPanel.classList.remove('opacity-100');
        }
    };

    if (grToggle) {
        grToggle.addEventListener('change', updateGrPanel);
        updateGrPanel();
    }

    // 17. Initial rendering of summary card for un-executed state
    applyTranslations();
    updateActiveLangButton();  // Activate the button corresponding to the current language on initial display
    const initialCbToggle = document.getElementById('cashBufferToggle') as HTMLInputElement | null;
    renderEmptySummaryCard(initialCbToggle ? initialCbToggle.checked : false);

    // 18. Initial currency conversion according to language
    const initialLang = getLanguage();
    if (initialLang === 'en') {
        convertCurrencyInputs('en');
    }

    // 19. Add listeners to each input/select that update the un-executed summary or display a warning badge when parameters change
    // Exclude display control toggles (downsideFocusAsset, downsideFocusCash, logScaleToggle)
    const simulationTabEl = document.getElementById('simulationTab');
    const inputsAndSelects = simulationTabEl
        ? simulationTabEl.querySelectorAll('input:not(#downsideFocusAsset):not(#downsideFocusCash):not(#logScaleToggle), select')
        : [];
    inputsAndSelects.forEach(el => {
        el.addEventListener('change', () => {
            if (!getLastSimResult()) {
                const cb = document.getElementById('cashBufferToggle') as HTMLInputElement | null;
                renderEmptySummaryCard(cb ? cb.checked : false);
            } else {
                markInputChanged();
            }
        });
    });

    // 20. Downside focus toggle linkage
    const dfAsset = document.getElementById('downsideFocusAsset') as HTMLInputElement | null;
    const dfCash = document.getElementById('downsideFocusCash') as HTMLInputElement | null;
    if (dfAsset) {
        dfAsset.addEventListener('change', function (this: HTMLInputElement) {
            const assetChart = getAssetChart();
            if (assetChart && getLastSimResult()) {
                applyDownsideFocus(assetChart, this.checked);
            }
        });
    }
    if (dfCash) {
        dfCash.addEventListener('change', function (this: HTMLInputElement) {
            const cashChart = getCashChart();
            if (cashChart && getLastSimResult()) {
                applyDownsideFocus(cashChart, this.checked);
            }
        });
    }

    // 21. Comparison tab button event
    const compareTabBtn = document.getElementById('openCompareTabBtn');
    if (compareTabBtn) {
        compareTabBtn.addEventListener('click', openCompareTab);
    }

    // 22. URL copy button event
    const copySimUrlBtn = document.getElementById('copySimUrlBtn');
    if (copySimUrlBtn) {
        copySimUrlBtn.addEventListener('click', copySimUrl);
    }

    // 23. Automatic setting of URL query parameters
    applyQueryParams(runMain);
    document.documentElement.classList.remove('app-loading');

    // 24. Tab switch processing
    const simTabBtn = document.getElementById('simTabBtn');
    const analysisTabBtn = document.getElementById('analysisTabBtn');
    const comparisonTabBtn = document.getElementById('comparisonTabBtn');
    const simulationTab = document.getElementById('simulationTab');
    const analysisTabContent = document.getElementById('analysisTab');
    const comparisonTabContent = document.getElementById('comparisonTab');

    // Unified tab switching function (ensures other tabs are hidden)
    function switchTab(activeBtn: HTMLElement | null, activeContent: HTMLElement | null): void {
        // Deactivate all tab buttons
        [simTabBtn, analysisTabBtn, comparisonTabBtn].filter((b): b is HTMLElement => Boolean(b)).forEach(btn => {
            btn.classList.remove('active', 'text-indigo-300');
            btn.classList.add('text-slate-400');
            btn.setAttribute('aria-selected', 'false');
        });
        // Hide all tab content
        [simulationTab, analysisTabContent, comparisonTabContent].filter((c): c is HTMLElement => Boolean(c)).forEach(content => {
            content.classList.add('hidden');
        });
        // Activate only the specified tab
        if (activeBtn) {
            activeBtn.classList.add('active', 'text-indigo-300');
            activeBtn.classList.remove('text-slate-400');
            activeBtn.setAttribute('aria-selected', 'true');
        }
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }
    }

    if (simTabBtn) {
        simTabBtn.addEventListener('click', () => {
            switchTab(simTabBtn, simulationTab);
        });
    }
    if (analysisTabBtn) {
        analysisTabBtn.addEventListener('click', () => {
            switchTab(analysisTabBtn, analysisTabContent);
            syncBaseToAnalysisIfOpen();
        });
    }
    if (comparisonTabBtn) {
        comparisonTabBtn.addEventListener('click', () => {
            switchTab(comparisonTabBtn, comparisonTabContent);
            // When first opening the comparison tab, or if already initialized, re-render
            import('../comparison-ui.js').then(CUI => {
                if (comparisonTabContent && !comparisonTabContent.dataset.initialized) {
                    // First time: initialize with the current simulation parameters
                    import('../params-accessor.js').then(PA => {
                        import('../comparison-state.js').then(CS => {
                            const simParams = PA.getCurrentSimParams();
                            const inputs = CS.createInputsFromSimParams(simParams);
                            CUI.initComparisonTab(inputs);
                            if (comparisonTabContent) {
                                comparisonTabContent.dataset.initialized = 'true';
                            }
                        });
                    });
                } else {
                    CUI.renderComparisonTab();
                }
            }).catch(e => console.error('comparison-ui load error', e));
        });
    }
    import('../analysis-ui.js').then(AUI => { AUI.setupAnalysisEventDelegation(); })
        .catch(e => console.error('analysis-ui load error', e));

    // 25. Tab bar pinning (fallback for environments where CSS sticky doesn't work)
    const tabNavBar = document.querySelector('.tab-nav-bar') as HTMLElement | null;
    if (tabNavBar && tabNavBar.parentNode) {
        const sentinel = document.createElement('div');
        tabNavBar.parentNode.insertBefore(sentinel, tabNavBar);

        const observer = new IntersectionObserver(([entry]) => {
            if (!entry) return;
            const isSticky = entry.intersectionRatio < 1;
            if (isSticky) {
                // Get the original size to determine the width when pinned
                const originalWidth = tabNavBar.offsetWidth;
                tabNavBar.style.position = 'fixed';
                tabNavBar.style.top = '0';
                tabNavBar.style.zIndex = '100';
                tabNavBar.style.width = originalWidth + 'px';
                // Maintain horizontal center alignment
                tabNavBar.style.left = '50%';
                tabNavBar.style.transform = 'translateX(-50%)';
            } else {
                tabNavBar.style.position = '';
                tabNavBar.style.top = '';
                tabNavBar.style.zIndex = '';
                tabNavBar.style.width = '';
                tabNavBar.style.left = '';
                tabNavBar.style.transform = '';
            }
        }, { threshold: [1] });

        observer.observe(sentinel);
    }

    // 26. Tooltip initialization (for static elements)
    initTooltips();
});
