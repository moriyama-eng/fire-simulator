// ====================================================================
// js/app/init.js
// All initialization processing inside DOMContentLoaded
// Dependencies: actions.js, charts.js, summary.js, ui-helpers.js,
//       state.js (not imported directly), i18n.js, core/url.js, etc.
// ====================================================================

import { applyQueryParams } from '../core/url.js';
import { setProgressCallback } from '../simulation-engine.js';
import { t, setLanguage, getLanguage } from '../i18n.js';
import { DEFAULTS } from '../core/params.js';
import {
    getIsResultDirty, getLastSimResult, getLastExecutedParams, getIsRunning,
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
// i18n related functions (no circular imports: managed in the local scope of init.js)
// ====================================================================
let isTranslating = false;
function applyTranslations() {
    if (isTranslating) return;
    isTranslating = true;
    try {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            el.innerHTML = t(el.getAttribute('data-i18n-html'));
        });
        document.querySelectorAll('[data-i18n-attr]').forEach(el => {
            const spec = el.getAttribute('data-i18n-attr').split(':');
            if (spec.length === 2) el.setAttribute(spec[0], t(spec[1]));
        });
        document.title = t('header.title');
    } finally {
        isTranslating = false;
    }
}

// MutationObserver: Guarantees translation of dynamically added elements (ES2020-independent)
var translationObserver = null;
function setupTranslationObserver() {
    if (translationObserver) translationObserver.disconnect();
    translationObserver = new MutationObserver(function (mutations) {
        var needsTranslation = false;
        for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    var node = mutation.addedNodes[j];
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.hasAttribute && node.hasAttribute('data-i18n')) {
                            needsTranslation = true;
                            break;
                        }
                        if (node.querySelector && node.querySelector('[data-i18n]')) {
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
function updateActiveLangButton() {
    const lang = getLanguage();
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
        if (btn.dataset.lang === lang) {
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.setAttribute('aria-pressed', 'false');
        }
    });
}

// ====================================================================
// Set up language switch buttons
// ====================================================================
function setupLangSwitcher() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
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
    setProgressCallback((progress) => {
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
                renderEmptySummaryCard(document.getElementById('cashBufferToggle')?.checked);
            }
            if (getAssetChart() && lastSimResult) {
                const isLog = document.getElementById('logScaleToggle')?.checked;
                renderAssetChart(lastSimResult, isLog);
                applyDownsideFocus(getAssetChart(), document.getElementById('downsideFocusAsset')?.checked);
            }
            if (getCashChart() && lastSimResult) {
                renderCashChart(lastSimResult);
                applyDownsideFocus(getCashChart(), document.getElementById('downsideFocusCash')?.checked);
            }
            if (getDdHistChart() && lastSimResult) renderDdCdfChart(lastSimResult);
            if (getUwHistChart() && lastSimResult) renderUwCdfChart(lastSimResult);
            // v2.3.0: Redraw new indicator charts on language switch
            if (getBelowInitChart() && lastSimResult) renderBelowInitCdfChart(lastSimResult);
            if (getSellChart() && lastSimResult) renderConsecutiveSellCdfChart(lastSimResult);
            import('../analysis-ui.js').then(AUI => AUI.renderAnalysisTab());
            // Redraw if comparison tab is open
            import('../comparison-ui.js').then(CUI => {
                const compTab = document.getElementById('comparisonTab');
                if (compTab && !compTab.classList.contains('hidden')) {
                    CUI.renderComparisonTab();
                }
            }).catch(() => {});
            updateActiveLangButton();
        });
    });

    // 7. Run button
    document.getElementById('runBtn').addEventListener('click', runMain);

    // 8. Log/linear scale toggle
    document.getElementById('logScaleToggle').addEventListener('change', onScaleToggle);

    // 9. X share button
    document.getElementById('shareXBtn').addEventListener('click', shareToX);

    // 10. Save image button
    document.getElementById('saveImageBtn').addEventListener('click', saveImage);

    // 11. Fluctuation model select linkage
    const modelSelect = document.getElementById('returnModelSelect');
    const tDistParams = document.getElementById('tDistParams');
    const updateModelPanel = () => {
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
    const dfToggle = document.getElementById('simDfToggle');
    const volatilityInput = document.getElementById('volatilityNum');

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
    const seedToggle = document.getElementById('seedToggle');
    const seedInputWrapper = document.getElementById('seedInputWrapper');
    const updateSeedPanel = () => {
        if (!seedToggle) return;
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
    const infToggle = document.getElementById('inflationModelToggle');
    const arParamsPanel = document.getElementById('arModelParams');

    const updateArPanel = () => {
        if (infToggle.checked) {
            arParamsPanel.classList.remove('opacity-50', 'pointer-events-none');
            arParamsPanel.classList.add('opacity-100');
        } else {
            arParamsPanel.classList.add('opacity-50', 'pointer-events-none');
            arParamsPanel.classList.remove('opacity-100');
        }
    };

    infToggle.addEventListener('change', updateArPanel);
    updateArPanel(); // Reflect initial load state

    // 15. Cash buffer toggle linkage (bidirectional)
    const cbToggle = document.getElementById('cashBufferToggle');
    const cbParamsPanel = document.getElementById('cashBufferParams');
    const cbInput = document.getElementById('initialCashBufferNum');

    // Function to update the grayed-out state of the panel
    const updateCbPanel = () => {
        if (cbToggle.checked) {
            cbParamsPanel.classList.remove('opacity-50', 'pointer-events-none');
            cbParamsPanel.classList.add('opacity-100');
        } else {
            cbParamsPanel.classList.add('opacity-50', 'pointer-events-none');
            cbParamsPanel.classList.remove('opacity-100');
        }
    };

    // When the toggle changes → update the input value
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

    // When the input value changes → update toggle state
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

    // 16. Spending guardrail toggle linkage
    const grToggle = document.getElementById('guardrailToggle');
    const grParamsPanel = document.getElementById('guardrailParams');

    const updateGrPanel = () => {
        if (grToggle.checked) {
            grParamsPanel.classList.remove('opacity-50', 'pointer-events-none');
            grParamsPanel.classList.add('opacity-100');
        } else {
            grParamsPanel.classList.add('opacity-50', 'pointer-events-none');
            grParamsPanel.classList.remove('opacity-100');
        }
    };

    grToggle.addEventListener('change', updateGrPanel);
    updateGrPanel();

    // 17. Initial rendering of summary card for un-executed state
    applyTranslations();
    updateActiveLangButton();  // Activate the button corresponding to the current language on initial display
    renderEmptySummaryCard(document.getElementById('cashBufferToggle').checked);

    // 18. Initial currency conversion according to language
    const initialLang = getLanguage();
    if (initialLang === 'en') {
        convertCurrencyInputs('en');
    }
    // In Japanese mode, the HTML default values (1,000 / 30) are used as is, so no additional processing is needed

    // 19. Add listeners to each input/select that update the un-executed summary or display a warning badge when parameters change
    // Exclude display control toggles (downsideFocusAsset, downsideFocusCash, logScaleToggle) (v1.8.3 fix)
    const simulationTabEl = document.getElementById('simulationTab');
    const inputsAndSelects = simulationTabEl
        ? simulationTabEl.querySelectorAll('input:not(#downsideFocusAsset):not(#downsideFocusCash):not(#logScaleToggle), select')
        : [];
    inputsAndSelects.forEach(el => {
        el.addEventListener('change', () => {
            if (!getLastSimResult()) {
                renderEmptySummaryCard(document.getElementById('cashBufferToggle').checked);
            } else {
                markInputChanged();
            }
        });
    });

    // 20. Downside focus toggle linkage
    const dfAsset = document.getElementById('downsideFocusAsset');
    const dfCash = document.getElementById('downsideFocusCash');
    if (dfAsset) {
        dfAsset.addEventListener('change', function () {
            const assetChart = getAssetChart();
            if (assetChart && getLastSimResult()) {
                applyDownsideFocus(assetChart, this.checked);
            }
        });
    }
    if (dfCash) {
        dfCash.addEventListener('change', function () {
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

    // 24. Tab switch processing
    const simTabBtn = document.getElementById('simTabBtn');
    const analysisTabBtn = document.getElementById('analysisTabBtn');
    const comparisonTabBtn = document.getElementById('comparisonTabBtn');
    const simulationTab = document.getElementById('simulationTab');
    const analysisTabContent = document.getElementById('analysisTab');
    const comparisonTabContent = document.getElementById('comparisonTab');

    // Unified tab switching function (ensures other tabs are hidden)
    function switchTab(activeBtn, activeContent) {
        // Deactivate all tab buttons
        [simTabBtn, analysisTabBtn, comparisonTabBtn].filter(Boolean).forEach(btn => {
            btn.classList.remove('active', 'text-indigo-300');
            btn.classList.add('text-slate-400');
            btn.setAttribute('aria-selected', 'false');
        });
        // Hide all tab content
        [simulationTab, analysisTabContent, comparisonTabContent].filter(Boolean).forEach(content => {
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
                if (!comparisonTabContent.dataset.initialized) {
                    // First time: initialize with the current simulation parameters
                    import('../params-accessor.js').then(PA => {
                        import('../comparison-state.js').then(CS => {
                            const simParams = PA.getCurrentSimParams();
                            const inputs = CS.createInputsFromSimParams(simParams);
                            CUI.initComparisonTab(inputs);
                            comparisonTabContent.dataset.initialized = 'true';
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
    const tabNavBar = document.querySelector('.tab-nav-bar');
    if (tabNavBar) {
        const sentinel = document.createElement('div');
        tabNavBar.parentNode.insertBefore(sentinel, tabNavBar);

        const observer = new IntersectionObserver(([entry]) => {
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
