// ====================================================================
// js/app/init.js
// DOMContentLoaded 内の全初期化処理
// 依存: actions.js, charts.js, summary.js, ui-helpers.js,
//       state.js（直接インポートしない）, i18n.js, core/url.js 等
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
// i18n 周辺関数（循環インポートなし: init.js のローカルスコープで管理）
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

// MutationObserver: 動的に追加された要素の翻訳を保証する（ES2020非依存）
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
// 言語ボタンの active 状態を更新する
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
// 言語切り替えボタンのセットアップ
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
// DOMContentLoaded 内の全初期化処理
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. 進捗表示用コールバックを設定
    setProgressCallback((progress) => {
        const btn = document.getElementById('runBtn');
        if (!btn) return;
        btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>${t('button.running', [progress])}`;
        btn.style.background = `linear-gradient(to right, rgba(99, 102, 241, 0.8) ${progress}%, rgba(30, 41, 59, 1) ${progress}%)`;
    });

    // 2. ハイブリッド入力の初期化
    setupHybridInputs();

    // 3. 言語切り替えボタンのセットアップ
    setupLangSwitcher();

    // 4. 動的翻訳監視開始
    setupTranslationObserver();

    // 5. 初期翻訳適用
    applyTranslations();

    // 6. 言語変更イベントリスナー
    document.addEventListener('languageChanged', () => {
        // FIX-10: シミュレーション実行中（app.js本体 or 比較タブ）は言語切り替えをスキップ
        import('../comparison-state.js').then(CS => {
            if (getIsRunning() || CS.getIsRunning()) return;
            applyTranslations();
            updateDfPanel();
            // 言語切り替え時に通貨入力値を変換
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
            // v2.3.0: 新指標グラフの言語切り替え時再描画
            if (getBelowInitChart() && lastSimResult) renderBelowInitCdfChart(lastSimResult);
            if (getSellChart() && lastSimResult) renderConsecutiveSellCdfChart(lastSimResult);
            import('../analysis-ui.js').then(AUI => AUI.renderAnalysisTab());
            // 比較タブが開いている場合は再描画
            import('../comparison-ui.js').then(CUI => {
                const compTab = document.getElementById('comparisonTab');
                if (compTab && !compTab.classList.contains('hidden')) {
                    CUI.renderComparisonTab();
                }
            }).catch(() => {});
            updateActiveLangButton();
        });
    });

    // 7. 実行ボタン
    document.getElementById('runBtn').addEventListener('click', runMain);

    // 8. 対数/線形スケール切替
    document.getElementById('logScaleToggle').addEventListener('change', onScaleToggle);

    // 9. X共有ボタン
    document.getElementById('shareXBtn').addEventListener('click', shareToX);

    // 10. 画像保存ボタン
    document.getElementById('saveImageBtn').addEventListener('click', saveImage);

    // 11. 変動モデルセレクト連動
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

    // 12. 自由度 (自動/固定) トグル連動
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

    // 13. 乱数シード トグル連動
    const seedToggle = document.getElementById('seedToggle');
    const seedInputWrapper = document.getElementById('seedInputWrapper');
    const updateSeedPanel = () => {
        if (!seedToggle) return;
        if (!seedToggle.checked) {
            // 固定 (unchecked)
            seedInputWrapper.classList.remove('opacity-50', 'pointer-events-none');
            seedInputWrapper.classList.add('opacity-100');
        } else {
            // ランダム (checked)
            seedInputWrapper.classList.add('opacity-50', 'pointer-events-none');
            seedInputWrapper.classList.remove('opacity-100');
        }
    };
    if (seedToggle) {
        seedToggle.addEventListener('change', updateSeedPanel);
        updateSeedPanel();
    }

    // 14. インフレ変動モデル (AR-1) トグル連動
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
    updateArPanel(); // 初期ロード時の状態反映

    // 15. 現金バッファ トグル連動（双方向）
    const cbToggle = document.getElementById('cashBufferToggle');
    const cbParamsPanel = document.getElementById('cashBufferParams');
    const cbInput = document.getElementById('initialCashBufferNum');

    // パネルのグレーアウト状態を更新する関数
    const updateCbPanel = () => {
        if (cbToggle.checked) {
            cbParamsPanel.classList.remove('opacity-50', 'pointer-events-none');
            cbParamsPanel.classList.add('opacity-100');
        } else {
            cbParamsPanel.classList.add('opacity-50', 'pointer-events-none');
            cbParamsPanel.classList.remove('opacity-100');
        }
    };

    // トグルが変更されたとき → inputの値を更新する
    cbToggle.addEventListener('change', () => {
        if (cbToggle.checked) {
            // ONにした場合：デフォルト値に戻す（現在値が0の場合のみ）
            if (parseFloat(cbInput.value.replace(/,/g, '')) === 0) {
                cbInput.value = DEFAULTS.initialCashBuffer.toLocaleString('en-US');
                cbInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } else {
            // OFFにした場合：0に設定
            cbInput.value = '0';
            cbInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        updateCbPanel();
        // 未実行状態ならサマリカードを更新
        if (!getLastSimResult()) renderEmptySummaryCard(cbToggle.checked);
    });

    // inputの値が変更されたとき → トグル状態を更新する
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

    updateCbPanel(); // 初期ロード時の状態反映

    // 16. 支出ガードレール トグル連動
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

    // 17. 未実行状態の（未実行）サマリカードを初期描画
    applyTranslations();
    updateActiveLangButton();  // 初期表示時に現在の言語に対応するボタンをアクティブにする
    renderEmptySummaryCard(document.getElementById('cashBufferToggle').checked);

    // 18. 言語に応じた初期通貨変換
    const initialLang = getLanguage();
    if (initialLang === 'en') {
        convertCurrencyInputs('en');
    }
    // 日本語モードの場合は HTML のデフォルト値（1,000 / 30）がそのまま使用されるため、追加の処理は不要

    // 19. パラメータが変更されたら未実行サマリを更新または警告バッジを表示するリスナーを各input/selectに追加
    // 表示制御用のトグル（downsideFocusAsset, downsideFocusCash, logScaleToggle）は除外する (v1.8.3修正)
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

    // 20. ダウンサイドフォーカス トグル連動
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

    // 21. 比較タブボタンイベント
    const compareTabBtn = document.getElementById('openCompareTabBtn');
    if (compareTabBtn) {
        compareTabBtn.addEventListener('click', openCompareTab);
    }

    // 22. URLコピーボタンイベント
    const copySimUrlBtn = document.getElementById('copySimUrlBtn');
    if (copySimUrlBtn) {
        copySimUrlBtn.addEventListener('click', copySimUrl);
    }

    // 23. URLクエリパラメータの自動設定
    applyQueryParams(runMain);

    // 24. タブ切り替え処理
    const simTabBtn = document.getElementById('simTabBtn');
    const analysisTabBtn = document.getElementById('analysisTabBtn');
    const comparisonTabBtn = document.getElementById('comparisonTabBtn');
    const simulationTab = document.getElementById('simulationTab');
    const analysisTabContent = document.getElementById('analysisTab');
    const comparisonTabContent = document.getElementById('comparisonTab');

    // 統一的なタブ切り替え関数（他のタブを確実に非表示にする）
    function switchTab(activeBtn, activeContent) {
        // 全タブボタンを非アクティブ化
        [simTabBtn, analysisTabBtn, comparisonTabBtn].filter(Boolean).forEach(btn => {
            btn.classList.remove('active', 'text-indigo-300');
            btn.classList.add('text-slate-400');
            btn.setAttribute('aria-selected', 'false');
        });
        // 全タブコンテンツを非表示
        [simulationTab, analysisTabContent, comparisonTabContent].filter(Boolean).forEach(content => {
            content.classList.add('hidden');
        });
        // 指定タブのみアクティブ化
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
            // 比較タブを初めて開いたとき、またはすでに初期化済みの場合は再描画
            import('../comparison-ui.js').then(CUI => {
                if (!comparisonTabContent.dataset.initialized) {
                    // 初回：現在のシミュレーションパラメータで初期化
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

    // 25. タブバー固定（CSS sticky が効かない環境へのフォールバック）
    const tabNavBar = document.querySelector('.tab-nav-bar');
    if (tabNavBar) {
        const sentinel = document.createElement('div');
        tabNavBar.parentNode.insertBefore(sentinel, tabNavBar);

        const observer = new IntersectionObserver(([entry]) => {
            const isSticky = entry.intersectionRatio < 1;
            if (isSticky) {
                // 固定時の幅を確定させるために、元のサイズを取得
                const originalWidth = tabNavBar.offsetWidth;
                tabNavBar.style.position = 'fixed';
                tabNavBar.style.top = '0';
                tabNavBar.style.zIndex = '100';
                tabNavBar.style.width = originalWidth + 'px';
                // 左右中央揃えを維持
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

    // 26. ツールチップ初期化（静的要素用）
    initTooltips();
});
