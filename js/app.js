// ====================================================================
// グローバル状態管理
// ====================================================================
let globalSeed = 12345;
let assetChart = null;
let cashChart = null;
let ddHistChart = null;
let uwHistChart = null;
let lastSimResult = null;
let isRunning = false;

// ====================================================================
// コア数学関数（完全指定）
// ====================================================================
function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function randomNormal(rngFunc) {
    let u = 0, v = 0;
    while (u === 0) u = rngFunc();
    while (v === 0) v = rngFunc();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ====================================================================
// 入力パラメータのDOM取得とバリデーション
// ====================================================================
const DEFAULTS = {
    initialRiskAsset: 10000, initialCashBuffer: 1000, monthlyExpense: 30,
    expectedReturn: 10.0, volatility: 18.0, inflationRate: 2.0,
    simYears: 30, simPaths: 10000, drawdownTrigger: -20.0, drawdownReplenish: -5.0, replenishPace: 5.0,
    guardrailTrigger: -20.0, guardrailReduction: -20.0, guardrailRelease: -15.0
};

function safeNumber(val, fallback) {
    if (typeof val === 'string') val = val.replace(/,/g, '');
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
}

function getParams() {
    return {
        initialRiskAsset: safeNumber(document.getElementById('initialRiskAssetNum').value, DEFAULTS.initialRiskAsset) * 10000, // UIは億円単位、内部計算は万円
        initialCashBuffer: safeNumber(document.getElementById('initialCashBufferNum').value, DEFAULTS.initialCashBuffer),
        monthlyExpense: safeNumber(document.getElementById('monthlyExpenseNum').value, DEFAULTS.monthlyExpense),
        expectedReturn: safeNumber(document.getElementById('expectedReturnNum').value, DEFAULTS.expectedReturn),
        volatility: safeNumber(document.getElementById('volatilityNum').value, DEFAULTS.volatility),
        inflationRate: safeNumber(document.getElementById('inflationRateNum').value, DEFAULTS.inflationRate),
        simYears: safeNumber(document.getElementById('simYearsNum').value, DEFAULTS.simYears),
        simPaths: Math.max(1000, Math.min(100000, Math.round(safeNumber(document.getElementById('simPathsNum').value, DEFAULTS.simPaths)))),
        cashBufferToggle: document.getElementById('cashBufferToggle').checked,
        drawdownTrigger: Math.min(0, safeNumber(document.getElementById('drawdownTriggerNum').value, DEFAULTS.drawdownTrigger)),
        drawdownReplenish: Math.min(0, safeNumber(document.getElementById('drawdownReplenishNum').value, DEFAULTS.drawdownReplenish)),
        replenishPace: Math.max(0, safeNumber(document.getElementById('replenishPaceNum').value, DEFAULTS.replenishPace)),
        guardrailToggle: document.getElementById('guardrailToggle').checked,
        guardrailTrigger: Math.min(0, safeNumber(document.getElementById('guardrailTriggerNum').value, DEFAULTS.guardrailTrigger)),
        guardrailReduction: Math.min(0, safeNumber(document.getElementById('guardrailReductionNum').value, DEFAULTS.guardrailReduction)),
        guardrailRelease: Math.min(0, safeNumber(document.getElementById('guardrailReleaseNum').value, DEFAULTS.guardrailRelease)),
        useArInflation: document.getElementById('inflationModelToggle').checked,
        infVol: safeNumber(document.getElementById('infVolNum').value, 2.0),
        infAr: safeNumber(document.getElementById('infArNum').value, 0.5),
    };
}

// ====================================================================
// ステッパーUI (長押し対応) ロジック
// ====================================================================
function setupHybridInputs() {
    const buttons = document.querySelectorAll('.stepper-btn');

    // 各インプットフィールドの属性から小数点以下の表示桁数を判定する
    function getPrecision(input) {
        const stepAttr = input.getAttribute('step') || "1";
        const valueAttr = (input.getAttribute('value') || "0").replace(/,/g, '');

        // step属性文字列に '.' が含まれていればその桁数を優先
        if (stepAttr.includes('.')) {
            return stepAttr.split('.')[1].length;
        }
        // value属性に '.' が含まれていればその桁数を使用
        if (valueAttr.includes('.')) {
            return valueAttr.split('.')[1].length;
        }
        return 0; // 整数
    }

    buttons.forEach(btn => {
        let intervalId;
        let timeoutId;

        const startIncrement = () => {
            updateValue();
            // 最初の遅延後に連続更新開始
            timeoutId = setTimeout(() => {
                intervalId = setInterval(updateValue, 50);
            }, 400); // 400ms長押しで連続開始
        };

        const stopIncrement = () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
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

            // 値が変更されたらイベントを発火（フォーカス時に実行ボタン等と連携する場合に備え）
            input.dispatchEvent(new Event('input', { bubbles: true }));
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
        });
    });
}

// ====================================================================
// シミュレーションエンジン（チャンク非同期処理）
// ====================================================================
function runSimulation(params, userPercentiles) {
    if (!userPercentiles) userPercentiles = [10, 25, 50, 75, 90];
    return new Promise((resolve) => {
        const { initialRiskAsset, initialCashBuffer, monthlyExpense,
            expectedReturn, volatility, inflationRate,
            simYears, simPaths, drawdownTrigger, drawdownReplenish, replenishPace,
            cashBufferToggle, guardrailToggle, guardrailTrigger, guardrailReduction, guardrailRelease,
            useArInflation, infVol, infAr } = params;

        const totalMonths = simYears * 12;
        const dataLen = totalMonths + 1;

        const arithmeticReturn = expectedReturn / 100;
        const annualVol = volatility / 100;
        const adjustedAnnualDrift = Math.log(1 + arithmeticReturn) - (annualVol * annualVol) / 2;
        const monthlyDrift = adjustedAnnualDrift / 12;
        const monthlyVol = annualVol / Math.sqrt(12);

        const activeInitialCashBuffer = cashBufferToggle ? initialCashBuffer : 0;
        const ddThreshold = -Math.abs(drawdownTrigger / 100);
        const ddReplenishThreshold = -Math.abs(drawdownReplenish / 100);
        const triggerGR = guardrailTrigger / 100;
        const releaseGR = guardrailRelease / 100; // ガードレール解除閾値（発動閾値より緩い負値）

        const riskPaths = [];
        const cashPaths = [];
        const totalPaths = [];
        const ddPaths = [];
        const maxDdPerPath = new Float32Array(simPaths);
        const maxUwPerPath = new Float32Array(simPaths);
        for (let p = 0; p < simPaths; p++) {
            riskPaths.push(new Float32Array(dataLen));
            cashPaths.push(new Float32Array(dataLen));
            totalPaths.push(new Float32Array(dataLen));
            ddPaths.push(new Float32Array(dataLen));
        }

        let bankruptCount = 0;
        const CHUNK_SIZE = 100;
        let pathIndex = 0;

        function processChunk() {
            const end = Math.min(pathIndex + CHUNK_SIZE, simPaths);
            for (let p = pathIndex; p < end; p++) {
                let rng = mulberry32(globalSeed + p);
                let currentRiskAsset = initialRiskAsset;
                let currentCash = activeInitialCashBuffer;
                let highWaterMark = initialRiskAsset + currentCash;
                let bankrupt = false;
                let isReplenishMode = false;
                let isGuardrailActive = false;

                let currentUwMonths = 0;
                let maxUwMonths = 0;
                let maxDD = 0;

                riskPaths[p][0] = currentRiskAsset;
                cashPaths[p][0] = currentCash;
                totalPaths[p][0] = currentRiskAsset + currentCash;
                ddPaths[p][0] = 0; // 初期時点のドローダウンは0%

                let currentInfRate = inflationRate / 100; // 初期インフレ率は期待値
                let infMultiplier = 1.0;                  // 累積インフレ係数

                for (let t = 1; t <= totalMonths; t++) {
                    if (bankrupt) break;

                    // 毎月のインフレ計算 (AR-1モデル / 固定モデル)
                    if (useArInflation) {
                        const annualInfVol = infVol / 100;
                        const monthlyInfVol = annualInfVol / Math.sqrt(12);
                        const InfZ = randomNormal(rng);
                        const expectedLongTermInf = inflationRate / 100;
                        const C = (1 - infAr) * expectedLongTermInf;

                        // AR-1プロセス: 次月のインフレ率 = C + phi * 前月 + shock
                        currentInfRate = C + (infAr * currentInfRate) + (monthlyInfVol * InfZ);
                        // 今月のインフレ影響を乗算（対数空間で積算し固定モデルと対称性を持たせる）
                        infMultiplier *= Math.exp(currentInfRate / 12);
                    } else {
                        // 従来の固定インフレ複利計算
                        infMultiplier = Math.pow(1 + inflationRate / 100, t / 12);
                    }

                    let currentExpense = monthlyExpense * infMultiplier;
                    const currentBufferLimit = activeInitialCashBuffer * infMultiplier;
                    const Z = randomNormal(rng);
                    currentRiskAsset *= Math.exp(monthlyDrift + monthlyVol * Z);
                    const currentTotalAsset = currentRiskAsset + currentCash;
                    const safeHWM = Math.max(highWaterMark, 0.0001);
                    const currentDD = (currentTotalAsset - safeHWM) / safeHWM;

                    // ガードレール判定（発動閾値以下に悪化したら発動、終了閾値以上まで回復したら解除）
                    if (guardrailToggle) {
                        if (currentDD <= triggerGR) {
                            isGuardrailActive = true;
                        } else if (isGuardrailActive && currentDD >= releaseGR) {
                            // ガードレール終了閾値（releaseGR）を上回った場合に解除
                            isGuardrailActive = false;
                        }

                        if (isGuardrailActive) {
                            // guardrailReductionはマイナス（例：-20.0 => 1 - 0.20 = 0.8倍）
                            currentExpense *= (1 + guardrailReduction / 100);
                        }
                    }

                    // isReplenishMode の更新は取崩し後の eomAsset ベースで後述

                    if (cashBufferToggle && currentDD <= ddThreshold) {
                        currentCash -= currentExpense;
                    } else if (cashBufferToggle && isReplenishMode && currentCash < currentBufferLimit) {
                        const shortage = currentBufferLimit - currentCash;
                        const replenishAmount = Math.min(shortage, currentExpense * replenishPace);
                        const actualReplenish = Math.min(replenishAmount, currentRiskAsset);
                        currentRiskAsset -= actualReplenish;
                        currentCash += actualReplenish;
                        currentRiskAsset -= currentExpense;
                    } else {
                        currentRiskAsset -= currentExpense;
                    }

                    if (currentRiskAsset + currentCash <= 0.0001) {
                        currentRiskAsset = 0;
                        currentCash = 0;
                        bankrupt = true;
                        bankruptCount++;
                        riskPaths[p][t] = 0;
                        cashPaths[p][t] = 0;
                        totalPaths[p][t] = 0;
                        ddPaths[p][t] = -1.0;
                        maxDD = -1.0;
                        currentUwMonths += (totalMonths - t) + 1;
                        if (currentUwMonths > maxUwMonths) maxUwMonths = currentUwMonths;
                        break;
                    }
                    if (currentCash < 0) { currentRiskAsset += currentCash; currentCash = 0; }
                    if (currentRiskAsset < 0) { currentCash += currentRiskAsset; currentRiskAsset = 0; }

                    const eomAsset = currentRiskAsset + currentCash;
                    if (eomAsset >= highWaterMark) {
                        currentUwMonths = 0;
                        highWaterMark = eomAsset;
                        // 取崩し後に高値更新 → バッファ補充モードを開始（ドローダウン辺暌で補充終了邖値を下回ると終了）
                        isReplenishMode = true;
                    } else {
                        currentUwMonths++;
                        if (currentUwMonths > maxUwMonths) maxUwMonths = currentUwMonths;
                        // ドローダウンが補充終了閾値を下回ったら補充モードを終了
                        const replenishCheckDD = (eomAsset - Math.max(highWaterMark, 0.0001)) / Math.max(highWaterMark, 0.0001);
                        if (replenishCheckDD <= ddReplenishThreshold) {
                            isReplenishMode = false;
                        }
                    }

                    let eomDD = Math.min(0, (eomAsset - Math.max(highWaterMark, 0.0001)) / Math.max(highWaterMark, 0.0001));
                    if (eomDD < maxDD) maxDD = eomDD;

                    riskPaths[p][t] = currentRiskAsset;
                    cashPaths[p][t] = currentCash;
                    totalPaths[p][t] = eomAsset;
                    ddPaths[p][t] = eomDD; // ドローダウン率を蓄積
                }
                maxDdPerPath[p] = maxDD;
                maxUwPerPath[p] = maxUwMonths;
            }
            pathIndex = end;
            if (pathIndex < simPaths) {
                const progress = Math.round((pathIndex / simPaths) * 100);
                const btn = document.getElementById('runBtn');
                btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 計算中... ${progress}%`;
                btn.style.background = `linear-gradient(to right, rgba(99, 102, 241, 0.8) ${progress}%, rgba(30, 41, 59, 1) ${progress}%)`;

                setTimeout(processChunk, 0);
            } else {
                const btn = document.getElementById('runBtn');
                btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>  結果を集計描画中...`;
                btn.style.background = `linear-gradient(to right, rgba(99, 102, 241, 0.8) 100%, rgba(30, 41, 59, 1) 100%)`;

                setTimeout(() => {
                    resolve(aggregateResults(totalPaths, cashPaths, ddPaths, maxDdPerPath, maxUwPerPath, simPaths, dataLen, bankruptCount, userPercentiles));
                }, 50);
            }
        }
        processChunk();
    });
}

// ====================================================================
// 結果集計（断面パーセンタイル計算）
// ====================================================================
// パーセンタイル入力のパース
function parsePercentiles() {
    const raw = document.getElementById('percentileInput').value;
    const parsed = raw.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0 && n < 100);
    if (parsed.length === 0) return [10, 30, 50, 70, 90];
    return [...new Set(parsed)].sort((a, b) => a - b);
}

function aggregateResults(totalPaths, cashPaths, ddPaths, maxDdPerPath, maxUwPerPath, simPaths, dataLen, bankruptCount, percentiles) {
    const totalPercentileData = percentiles.map(() => new Float32Array(dataLen));
    const cashPercentileData = percentiles.map(() => new Float32Array(dataLen));
    const ddPercentileData = percentiles.map(() => new Float32Array(dataLen));
    const sortBuffer = new Float32Array(simPaths);

    for (let t = 0; t < dataLen; t++) {
        for (let p = 0; p < simPaths; p++) sortBuffer[p] = totalPaths[p][t];
        sortBuffer.sort();
        for (let pi = 0; pi < percentiles.length; pi++) {
            const idx = Math.floor((percentiles[pi] / 100) * (sortBuffer.length - 1));
            totalPercentileData[pi][t] = sortBuffer[idx];
        }
        for (let p = 0; p < simPaths; p++) sortBuffer[p] = cashPaths[p][t];
        sortBuffer.sort();
        for (let pi = 0; pi < percentiles.length; pi++) {
            const idx = Math.floor((percentiles[pi] / 100) * (sortBuffer.length - 1));
            cashPercentileData[pi][t] = sortBuffer[idx];
        }
        // ドローダウンのパーセンタイル集計
        for (let p = 0; p < simPaths; p++) sortBuffer[p] = ddPaths[p][t];
        sortBuffer.sort();
        for (let pi = 0; pi < percentiles.length; pi++) {
            const idx = Math.floor((percentiles[pi] / 100) * (sortBuffer.length - 1));
            ddPercentileData[pi][t] = sortBuffer[idx];
        }
    }

    // 50パーセンタイルのインデックスを探す（なければ中央に最も近い値）
    let medianIdx = percentiles.indexOf(50);
    if (medianIdx === -1) medianIdx = Math.floor(percentiles.length / 2);

    const sortedMaxDd = Float32Array.from(maxDdPerPath).sort();
    const worst10Idx = Math.floor(0.10 * (simPaths - 1));
    const worst5Idx = Math.floor(0.05 * (simPaths - 1));
    const worst10MaxDd = sortedMaxDd[worst10Idx];
    const worst5MaxDd = sortedMaxDd[worst5Idx];

    const sortedMaxUw = Float32Array.from(maxUwPerPath).sort();
    const medianUwIdx = Math.floor(0.50 * (simPaths - 1));
    const medianMaxUw = sortedMaxUw[medianUwIdx];
    const worst10IdxUw = Math.floor(0.90 * (simPaths - 1));
    const worst10MaxUw = sortedMaxUw[worst10IdxUw];

    return {
        percentiles,
        totalPercentileData,
        cashPercentileData,
        ddPercentileData,
        successRate: ((simPaths - bankruptCount) / simPaths * 100),
        finalMedian: totalPercentileData[medianIdx][dataLen - 1],
        worst10MaxDd: worst10MaxDd,
        worst5MaxDd: worst5MaxDd,
        medianMaxUw: medianMaxUw,
        worst10MaxUw: worst10MaxUw,
        maxDdPerPath: maxDdPerPath,
        maxUwPerPath: maxUwPerPath,
        params: { simPaths: simPaths, totalMonths: dataLen - 1 },
        dataLen,
    };
}
// ====================================================================
// Chart.js 描画
// ====================================================================
// パーセンタイル値に応じた色を動的生成
const PERCENTILE_COLOR_MAP = {
    5: '#b71c1c', 10: '#e74c3c', 15: '#e57373', 20: '#ef6c00',
    25: '#f39c12', 30: '#ffa726', 35: '#ffca28', 40: '#66bb6a',
    45: '#42a5f5', 50: '#3498db', 55: '#29b6f6', 60: '#26c6da',
    65: '#26a69a', 70: '#66bb6a', 75: '#8dd36b', 80: '#43a047',
    85: '#388e3c', 90: '#2ecc71', 95: '#1b5e20'
};
function getPercentileColor(pct) {
    if (PERCENTILE_COLOR_MAP[pct]) return PERCENTILE_COLOR_MAP[pct];
    // フォールバック: 低赤(0)、高緑(120)のHSLグラデーション
    const hue = (pct / 100) * 120;
    return `hsl(${hue}, 70%, 50%)`;
}

// X軸ラベル生成（インデックスのみ、tick callbackで年表示）
function generateLabels(dataLen) {
    const labels = [];
    for (let t = 0; t < dataLen; t++) labels.push(t);
    return labels;
}

// X軸 tick callback: 適切な年間隔でラベルを表示
function xTickCallback(value, index) {
    const totalMonths = this.chart.data.labels.length - 1;
    const totalYears = totalMonths / 12;
    let interval;
    if (totalYears <= 15) interval = 2;
    else if (totalYears <= 40) interval = 5;
    else interval = 10;
    if (index % (interval * 12) === 0) return `${Math.round(index / 12)}年`;
    return null;
}

// ツールチップのタイトル（経過年数を常に表示）
function tooltipTitleCallback(tooltipItems) {
    const index = tooltipItems[0].dataIndex;
    const year = Math.floor(index / 12);
    const month = index % 12;
    if (month === 0) return `経過 ${year}年`;
    return `経過 ${year}年${month}ヶ月`;
}

function renderAssetChart(result, isLogScale) {
    const { percentiles, totalPercentileData, dataLen } = result;
    const labels = generateLabels(dataLen);
    const ctx = document.getElementById('assetChartCanvas').getContext('2d');

    if (assetChart) { assetChart.destroy(); assetChart = null; }

    // データセットを降順（高パーセンタイル低）で作成
    const orderedPercentiles = [...percentiles].reverse();
    const datasets = orderedPercentiles.map((pct, idx) => {
        const origIdx = percentiles.indexOf(pct);
        const color = getPercentileColor(pct);
        let data;
        if (isLogScale) {
            data = Array.from(totalPercentileData[origIdx]).map(v => (v > 0 ? v : null));
        } else {
            data = Array.from(totalPercentileData[origIdx]);
        }

        // ファンチャート化: 一番上の線（パーセンタイル最高値）以外は、一つ上の線までをグラデーションで塗りつぶす
        const fillMode = (idx === 0) ? false : '-1';

        return {
            label: `${pct}％`,
            data: data,
            borderColor: color,
            backgroundColor: color + '26', // HEXアルファ (26=約15%の透明度で一律塗りつぶし)
            borderWidth: pct === 50 ? 2.5 : 1.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: fillMode,
            spanGaps: true,
        };
    });

    assetChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    bodyFont: { family: "'Courier New', Courier, monospace", size: 12 },
                    titleFont: { family: "'Inter', system-ui, sans-serif", size: 13 },
                    itemSort: function (a, b) {
                        return (b.parsed.y || 0) - (a.parsed.y || 0);
                    },
                    callbacks: {
                        title: tooltipTitleCallback,
                        label: function (context) {
                            const val = context.parsed.y;
                            const allItems = context.chart.tooltip.dataPoints;
                            // ラベル部分の最大文字数を算出（1桁vs2桁のパーセンタイル桁そろえ）
                            const maxLblLen = Math.max(...allItems.map(item => item.dataset.label.length));
                            const lbl = context.dataset.label.padStart(maxLblLen);
                            if (val === null || val === undefined) return `${lbl}:  億円`;
                            // 億円換算（小数第2位）
                            const oku = (val / 10000).toFixed(2);
                            // 数値部分の動的桁揃え
                            const maxLen = Math.max(...allItems.map(item => {
                                const v = item.parsed.y;
                                return (v !== null && v !== undefined) ? (v / 10000).toFixed(2).length : 1;
                            }));
                            return `${lbl}:${oku.padStart(maxLen + 1)} 億円`;
                        },
                    },
                },
                legend: {
                    labels: {
                        color: '#cbd5e1',
                        font: { size: 13 },
                        boxWidth: 16,
                        boxHeight: 2,
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        maxRotation: 0,
                        autoSkip: false,
                        callback: xTickCallback,
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                },
                y: {
                    type: isLogScale ? 'logarithmic' : 'linear',
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        callback: function (value) {
                            // 億円換算
                            const oku = value / 10000;
                            if (oku <= 0) return null;

                            // 対数スケール時: Y軸の表示桁幅（オーダー）による動的間引きアルゴリズム
                            const chart = this.chart;
                            const isLog = chart.options.scales.y.type === 'logarithmic';
                            if (isLog) {
                                // 現在のY軸の最小値最大値から表示桁幅を算出
                                const yMin = chart.scales.y.min || 1000;
                                const yMax = chart.scales.y.max || 100000;
                                const minOrder = Math.floor(Math.log10(yMin / 10000));
                                const maxOrder = Math.floor(Math.log10(yMax / 10000));
                                const orderRange = Math.max(1, maxOrder - minOrder + 1);

                                const exponent = Math.floor(Math.log10(oku));
                                const mantissa = oku / Math.pow(10, exponent);

                                // 桁幅の種類が4つ以上なら、間引きを強化して10の累乗(mantissa=1)のみ表示
                                if (orderRange >= 4) {
                                    if (Math.abs(mantissa - 1) > 0.05) return null;
                                } else {
                                    // 1, 2, 4, 6 に変更して重なりを解消
                                    const allowed = [1, 2, 4, 6];
                                    const isAllowed = allowed.some(a => Math.abs(mantissa - a) < 0.05);
                                    if (!isAllowed) return null;
                                }
                            }

                            if (oku >= 100) return `${Math.round(oku).toLocaleString('ja-JP')} 億円`;
                            if (oku >= 1) return `${oku.toLocaleString('ja-JP', { maximumFractionDigits: 1 })} 億円`;
                            return `${(value).toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 万円`;
                        },
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                    title: { display: false },
                },
            },
        },
    });
}

function renderCashChart(result) {
    const { percentiles, cashPercentileData, dataLen } = result;
    const labels = generateLabels(dataLen);
    const ctx = document.getElementById('cashChartCanvas').getContext('2d');

    if (cashChart) { cashChart.destroy(); cashChart = null; }

    // データセットを降順（高パーセンタイル低）で作成
    const orderedPercentiles = [...percentiles].reverse();
    const datasets = orderedPercentiles.map((pct, idx) => {
        const origIdx = percentiles.indexOf(pct);
        const color = getPercentileColor(pct);
        const fillMode = (idx === 0) ? false : '-1';

        return {
            label: `${pct}％`,
            data: Array.from(cashPercentileData[origIdx]),
            borderColor: color,
            backgroundColor: color + '26',
            borderWidth: pct === 50 ? 2.5 : 1.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: fillMode,
            spanGaps: true,
        };
    });

    cashChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    bodyFont: { family: "'Courier New', Courier, monospace", size: 12 },
                    titleFont: { family: "'Inter', system-ui, sans-serif", size: 13 },
                    itemSort: function (a, b) {
                        return (b.parsed.y || 0) - (a.parsed.y || 0);
                    },
                    callbacks: {
                        title: tooltipTitleCallback,
                        label: function (context) {
                            const val = context.parsed.y;
                            const allItems = context.chart.tooltip.dataPoints;
                            const maxLblLen = Math.max(...allItems.map(item => item.dataset.label.length));
                            const lbl = context.dataset.label.padStart(maxLblLen);
                            if (val === null || val === undefined) return `${lbl}:  万円`;

                            const formattedVal = Math.round(val).toLocaleString('ja-JP');
                            const maxLen = Math.max(...allItems.map(item => {
                                const v = item.parsed.y;
                                return (v !== null && v !== undefined) ? Math.round(v).toLocaleString('ja-JP').length : 1;
                            }));
                            return `${lbl}:${formattedVal.padStart(maxLen + 1)} 万円`;
                        },
                    },
                },
                legend: {
                    labels: {
                        color: '#cbd5e1',
                        font: { size: 13 },
                        boxWidth: 16,
                        boxHeight: 2,
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        maxRotation: 0,
                        autoSkip: false,
                        callback: xTickCallback,
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                },
                y: {
                    type: 'linear',
                    min: 0,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        callback: function (value) {
                            if (value >= 10000) return `${(value / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })} 億円`;
                            return `${value.toLocaleString('ja-JP')} 万円`;
                        },
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                    title: { display: false },
                },
            },
        },
    });
}

// ====================================================================
// 近似曲線（PDF）描画用ヘルパー関数
// ====================================================================
function smoothArray(data, windowSize) {
    const result = new Array(data.length).fill(0);
    const half = Math.floor(windowSize / 2);
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = -half; j <= half; j++) {
            if (i + j >= 0 && i + j < data.length) {
                sum += data[i + j];
                count++;
            }
        }
        result[i] = sum / count;
    }
    return result;
}

function renderDdCdfChart(result) {
    const { maxDdPerPath, params } = result;

    // 最大ドローダウン（マイナス値）の配列を昇順ソート
    const sortedDd = Float32Array.from(maxDdPerPath).sort();
    const simPaths = params.simPaths;

    // 同一X座標(-100%での破綻など)に対する「垂直な壁」の発生を防ぐため、Mapで一意化して最大の発生確率を残す
    const pointsMap = new Map();
    const step = Math.max(1, Math.floor(simPaths / 1000));

    for (let i = 0; i < simPaths; i += step) {
        let pct = sortedDd[i] * 100;
        if (pct < -100) pct = -100;
        if (pct > 0) pct = 0;
        // 小数第1位で丸めて一意化
        pct = Math.round(pct * 10) / 10;
        // 昇順イテレーションのため同XならY（累積確率）が上書きされて最大のものが残る
        pointsMap.set(pct, (i + 1) / simPaths * 100);
    }

    // 横軸0% (縦軸100%) の点を強制的に追加してグラフが0%まで伸びるようにする
    if (!pointsMap.has(0)) {
        pointsMap.set(0, 100);
    }

    // Mapから配列に戻してXの昇順でソート（Mapは挿入順なので念のため再ソート）
    const points = Array.from(pointsMap.entries())
        .map(([x, y]) => ({ x, y }))
        .sort((a, b) => a.x - b.x);

    const ctx = document.getElementById('ddHistCanvas').getContext('2d');
    if (ddHistChart) { ddHistChart.destroy(); }

    ddHistChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: '発生確率',
                data: points,
                borderColor: '#f43f5e',
                backgroundColor: 'rgba(244, 63, 94, 0.2)',
                tension: 0.1,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    bodyFont: { family: "'Courier New', Courier, monospace", size: 12 },
                    titleFont: { family: "'Inter', system-ui, sans-serif", size: 13 },
                    callbacks: {
                        title: () => '最大ドローダウン 発生確率',
                        label: function (context) {
                            if (context.parsed.x === -100) {
                                return '総資産が枯渇する確率: ' + context.parsed.y.toFixed(1) + '%';
                            }
                            return '最大ドローダウンが ' + context.parsed.x.toFixed(1) + '% より悪化する確率: ' + context.parsed.y.toFixed(1) + '%';
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: '最大ドローダウン', color: '#94a3b8' },
                    min: -100,
                    max: 0,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        callback: function (value) { return value + "%"; }
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        stepSize: 20,
                        callback: function (value) { return value + "%"; }
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                    title: { display: false }
                }
            }
        }
    });
}

function renderUwCdfChart(result) {
    const { maxUwPerPath, params } = result;

    // 最長停滞期間（プラス値）の配列を昇順ソート
    const sortedUw = Float32Array.from(maxUwPerPath).sort();
    const simPaths = params.simPaths;

    const points = [];
    // 横軸0年 (縦軸100%) の点を強制的に先頭に追加
    points.push({ x: 0, y: 100 });

    // UIの負荷軽減のための間引き幅（約1000点）
    const step = Math.max(1, Math.floor(simPaths / 1000));

    for (let i = 0; i < simPaths; i += step) {
        let mo = sortedUw[i];
        if (points.length > 0 && points[points.length - 1].x === mo) {
            // 超過確率なので、同一月数の場合は「最初の登場（最も高いY）」が数学的に正しい P(X >= mo) となるため、Yは上書き「しない」
        } else {
            points.push({ x: mo, y: (simPaths - i) / simPaths * 100 });
        }
    }
    // 最後の点（一番停滞期間が長かったケース）を確実に拾う
    if ((simPaths - 1) % step !== 0) {
        let mo = sortedUw[simPaths - 1];
        if (points.length > 0 && points[points.length - 1].x === mo) {
            // 同一X回避
        } else {
            points.push({ x: mo, y: 1 / simPaths * 100 });
        }
    }

    const ctx = document.getElementById('uwHistCanvas').getContext('2d');
    if (uwHistChart) { uwHistChart.destroy(); }

    uwHistChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: '発生確率',
                data: points,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                tension: 0.1,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    bodyFont: { family: "'Courier New', Courier, monospace", size: 12 },
                    titleFont: { family: "'Inter', system-ui, sans-serif", size: 13 },
                    callbacks: {
                        title: () => '最長停滞期間 発生確率',
                        label: function (context) {
                            const totalMo = Math.round(context.parsed.x);
                            const y = Math.floor(totalMo / 12);
                            const m = totalMo % 12;
                            let str = "";
                            if (y > 0) str += y + "年";
                            if (m > 0) str += m + "ヶ月";
                            if (y === 0 && m === 0) str = "0年";

                            return '最長停滞期間が ' + str + ' 以上続く確率: ' + context.parsed.y.toFixed(1) + '%';
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: '最長停滞期間', color: '#94a3b8' },
                    min: 0,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        stepSize: 60, // 5年(60ヵ月)刻みに統一
                        callback: function (value) {
                            return (value / 12) + '年';
                        }
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        stepSize: 20,
                        callback: function (value) { return value + "%"; }
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                    title: { display: false }
                }
            }
        }
    });
}

// ====================================================================
// サマリーカード生成（全パラメータとKPIの表示）
// ====================================================================
function updateSummaryCard(result, params) {
    const container = document.getElementById('summaryCardContainer');

    // パラメータのパース (UI表示用)
    const initialAssetOku = (params.initialRiskAsset / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
    const monthlyExpenseMan = params.monthlyExpense.toLocaleString('ja-JP');
    const successRate = result.successRate.toFixed(1);
    const medianOku = (result.finalMedian / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

    // インフレモデルの表記を決定
    const infModelText = params.useArInflation ? `AR-1変動 (${params.inflationRate}%, Vol:${params.infVol}%)` : `固定 (${params.inflationRate}%)`;

    // 成功率に応じたステータスカラー
    let statusGrad = 'from-emerald-500/20 to-teal-500/5';
    let statusText = 'text-emerald-400';
    let statusIcon = '';
    if (result.successRate < 80) {
        statusGrad = 'from-rose-500/20 to-red-500/5';
        statusText = 'text-rose-400';
        statusIcon = '';
    } else if (result.successRate < 90) {
        statusGrad = 'from-amber-500/20 to-orange-500/5';
        statusText = 'text-amber-400';
        statusIcon = '';
    }

    container.innerHTML = `
        <div class="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div class="absolute inset-0 bg-gradient-to-br ${statusGrad} opacity-30"></div>
            <div class="relative z-10">
                <div class="flex items-center justify-between mb-5 border-b border-white/10 pb-3">
                    <h3 class="text-sm font-bold tracking-widest text-slate-100 drop-shadow-sm">シミュレーション結果 サマリ</h3>
                    <span id="uiExecTime" class="text-xs text-slate-300 font-medium">${new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Left: KPIs -->
                    <div class="flex flex-col justify-center items-start lg:border-r border-white/10 lg:pr-6 space-y-4">
                        <div class="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <p class="text-xs text-slate-200 font-semibold uppercase tracking-widest mb-1 flex justify-between">
                                <span>FIRE 成功率</span>
                            </p>
                            <p class="text-4xl font-extrabold ${statusText} drop-shadow-md">
                                ${successRate}<span class="text-xl ml-1">%</span>
                            </p>
                        </div>
                        <div class="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <p class="text-xs text-slate-200 font-semibold uppercase tracking-widest mb-1">最終総資産 中央値</p>
                            <p class="text-3xl font-bold text-blue-300 drop-shadow-md">
                                ${medianOku}<span class="text-xl ml-1">億円</span>
                            </p>
                        </div>
                    </div>
                    
                    <!-- Right: Parameters -->
                    <div class="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 text-sm content-center">
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">初期リスク資産</p>
                            <p class="font-bold text-white text-base">${(params.initialRiskAsset / 10000).toLocaleString('ja-JP')} 億円</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">初期現金バッファ</p>
                            <p class="font-bold text-white text-base">${params.cashBufferToggle ? params.initialCashBuffer.toLocaleString('ja-JP') + ' 万円' : '<span class="text-slate-500">0 万円</span>'}</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">初期月間取崩し額</p>
                            <p class="font-bold text-white text-base">${params.monthlyExpense.toLocaleString('ja-JP')} 万円</p>
                        </div>

                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">期待リターン / ボラ</p>
                            <p class="font-bold text-white text-base">${params.expectedReturn.toFixed(1)}% / ${params.volatility.toFixed(1)}%</p>
                        </div>
                        <div class="space-y-1 shrink-0 col-span-2 sm:col-span-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">期待インフレ率</p>
                            <p class="font-bold text-white text-base">${infModelText}</p>
                        </div>
                        <div class="space-y-1 col-span-2 sm:col-span-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">シミュレーション年数 / 回数</p>
                            <p class="font-bold text-white text-base">${params.simYears} 年 / ${(params.simPaths).toLocaleString('ja-JP')} 回</p>
                        </div>
                        
                        <div class="space-y-1 col-span-2 sm:col-span-3 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">現金バッファ設定</p>
                            <div class="font-bold text-slate-100 text-xs sm:text-sm space-y-0.5">
                                ${params.cashBufferToggle ? `
                                 <p><span class="text-slate-400">取崩し判定：</span>ドローダウン ${params.drawdownTrigger}%</p>
                                 <p><span class="text-slate-400">補充開始：</span>総資産最高値更新</p>
                                 <p><span class="text-slate-400">補充終了：</span>ドローダウン ${params.drawdownReplenish}%以下に悪化</p>
                                 <p><span class="text-slate-400">補充ペース：</span>月間取崩し額の${params.replenishPace}倍</p>
                                 ` : `<p class="text-slate-500">OFF</p>`}
                            </div>
                        </div>
                        
                        <div class="space-y-1 col-span-2 sm:col-span-3 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">支出ガードレール設定</p>
                            <div class="font-bold text-slate-100 text-xs sm:text-sm">
                                ${params.guardrailToggle
            ? `<p><span class="text-slate-400">ガードレール発動：</span>ドローダウン ${params.guardrailTrigger}%以下に悪化</p>
                                       <p><span class="text-slate-400">ガードレール終了：</span>ドローダウン ${params.guardrailRelease}%以上まで回復</p>
                                       <p><span class="text-slate-400">発動時の支出調整率：</span>${params.guardrailReduction}%（月間取崩し額に適用）</p>`
            : `<p class="text-slate-500">OFF</p>`}
                            </div>
                        </div>
        </div>
    `;

    // フェードイン表示
    container.classList.remove('hidden');
    // reflow
    void container.offsetWidth;
    container.classList.add('opacity-100');
}

// ====================================================================
// 未実行状態のサマリカード描画
// ====================================================================
function renderEmptySummaryCard(cbChecked = false) {
    const container = document.getElementById('summaryCardContainer');
    if (!container) return;

    const params = getParams();
    const infModelText = document.getElementById('inflationModelToggle').checked
        ? `AR-1変動 (ボラ ${params.infVol.toFixed(1)}%, AR ${params.infAr.toFixed(1)})`
        : '固定 (0%)';

    container.innerHTML = `
        <div class="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div class="absolute inset-0 bg-slate-800/20 opacity-30"></div>
            <div class="relative z-10">
                <div class="flex items-center justify-between mb-5 border-b border-white/10 pb-3">
                    <h3 class="text-sm font-bold tracking-widest text-slate-100 drop-shadow-sm">シミュレーション結果 サマリ</h3>
                    <span class="text-xs text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">未実行</span>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Left: KPIs (Empty State) -->
                    <div class="flex flex-col justify-center items-start lg:border-r border-white/10 lg:pr-6 space-y-4">
                        <div class="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <p class="text-xs text-slate-200 font-semibold uppercase tracking-widest mb-1 flex justify-between">
                                <span>FIRE 成功率</span>
                            </p>
                            <p class="text-4xl font-extrabold text-slate-500 drop-shadow-md">
                                -<span class="text-xl ml-1">%</span>
                            </p>
                        </div>
                        <div class="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <p class="text-xs text-slate-200 font-semibold uppercase tracking-widest mb-1">最終総資産 中央値</p>
                            <p class="text-3xl font-bold text-slate-500 drop-shadow-md">
                                -<span class="text-xl ml-1">億円</span>
                            </p>
                        </div>
                    </div>
                    
                    <!-- Right: Parameters (Empty State) -->
                    <div class="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 text-sm content-center opacity-70">
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">初期リスク資産</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">初期現金バッファ</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">初期月間取崩し額</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>

                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">期待リターン / ボラ</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="space-y-1 shrink-0 col-span-2 sm:col-span-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">期待インフレ率</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="space-y-1 col-span-2 sm:col-span-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">シミュレーション年数 / 回数</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        
                        ${cbChecked ? `
                        <div class="space-y-1 col-span-2 sm:col-span-3 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">現金バッファ設定</p>
                            <div class="font-bold text-slate-500 text-xs sm:text-sm">
                                <p>-</p>
                            </div>
                        </div>` : `
                        <div class="space-y-1 col-span-2 sm:col-span-3 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">現金バッファ設定</p>
                            <div class="font-bold text-slate-500 text-xs sm:text-sm">
                                <p>-</p>
                            </div>
                        </div>`}
                        
                        <div class="space-y-1 col-span-2 sm:col-span-3 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide">支出ガードレール設定</p>
                            <div class="font-bold text-slate-500 text-xs sm:text-sm">
                                <p>-</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.classList.remove('hidden');
    void container.offsetWidth;
    container.classList.add('opacity-100');
}

// ====================================================================
// メイン実行関数
// ====================================================================
async function runMain() {
    if (isRunning) return;
    isRunning = true;

    const runBtn = document.getElementById('runBtn');
    runBtn.disabled = true;

    globalSeed = Date.now() >>> 0;
    await new Promise(r => requestAnimationFrame(r));

    try {
        const params = getParams();

        // バリデーション：ガードレール終了閾値が発動閾値より小さい場合は発動閾値と同値に補正
        if (params.guardrailToggle && params.guardrailRelease < params.guardrailTrigger) {
            params.guardrailRelease = params.guardrailTrigger;
            const releaseInput = document.getElementById('guardrailReleaseNum');
            if (releaseInput) releaseInput.value = params.guardrailTrigger.toFixed(1);
        }
        const percentiles = parsePercentiles();
        const result = await runSimulation(params, percentiles);
        lastSimResult = result;

        const isLogScale = document.getElementById('logScaleToggle').checked;
        renderAssetChart(result, isLogScale);
        renderCashChart(result);
        renderDdCdfChart(result);
        renderUwCdfChart(result);
        updateSummaryCard(result, params);
        setTimeout(() => {
            document.getElementById('summaryCardContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        // 共有ボタンの有効化
        const shareXBtn = document.getElementById('shareXBtn');
        const saveImageBtn = document.getElementById('saveImageBtn');
        if (shareXBtn && shareXBtn.disabled) {
            shareXBtn.disabled = false;
            shareXBtn.removeAttribute('title');
        }
        if (saveImageBtn && saveImageBtn.disabled) {
            saveImageBtn.disabled = false;
            saveImageBtn.removeAttribute('title');
        }
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = 'シミュレーション開始';
        runBtn.style.background = '';
        isRunning = false;
    }
}

// ====================================================================
// 対数/線形スケール切替（再計算なし、グラフ再描画のみ）
// ====================================================================
function onScaleToggle() {
    if (!lastSimResult) return;
    const isLogScale = document.getElementById('logScaleToggle').checked;
    renderAssetChart(lastSimResult, isLogScale);
}



// ====================================================================
// 画像キャプチャ（PNG保存）ロジック
// ====================================================================
async function saveImage() {
    if (!lastSimResult || isRunning) return;
    const btn = document.getElementById('saveImageBtn');
    const originalHtml = btn.innerHTML;

    try {
        // ボタンをローディング状態に
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>画像生成中...`;

        const params = getParams();

        // 1. キャプチャ用DOM（シミュレーション条件）にデータを反映
        const uiExecTime = document.getElementById('uiExecTime');
        if (uiExecTime) {
            document.getElementById('capExecTime').textContent = "実行日時: " + uiExecTime.textContent;
        }
        document.getElementById('capRiskAsset').textContent = (params.initialRiskAsset / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '億円';
        document.getElementById('capCash').textContent = params.initialCashBuffer.toLocaleString('ja-JP') + '万円';
        document.getElementById('capExpense').textContent = params.monthlyExpense.toLocaleString('ja-JP') + '万円';
        document.getElementById('capReturnVol').textContent = params.expectedReturn.toFixed(1) + '% / ' + params.volatility.toFixed(1) + '%';
        document.getElementById('capInf').textContent = params.inflationRate.toFixed(1) + '%';
        document.getElementById('capYears').textContent = params.simYears + '年';

        // ガードレール状態を反映（ON/OFFのみ表示）
        document.getElementById('capGuardrail').textContent = params.guardrailToggle ? 'ON' : 'OFF';

        // キャプチャ用DOM（シミュレーション結果）にデータを反映
        document.getElementById('capSuccess').textContent = lastSimResult.successRate.toFixed(1) + '%';
        document.getElementById('capMedian').textContent = (lastSimResult.finalMedian / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '億円';

        // 2. グラフ画像を転写（スマホでもPC表示のアスペクト比を維持するため一時的に固定サイズへ変更）
        const chartCanvas = document.getElementById('assetChartCanvas');
        if (!chartCanvas) throw new Error("グラフ要素が見つかりませんでした (assetChartCanvas not found)");

        const chartContainer = chartCanvas.parentElement;
        const chartCard = chartContainer.parentElement;

        const origCardOverflow = chartCard.style.overflow;
        const origWidth = chartContainer.style.width;
        const origHeight = chartContainer.style.height;

        chartCard.style.overflow = 'hidden';
        chartContainer.style.width = '1000px';
        chartContainer.style.height = '600px';

        // 画像出力用にフォントサイズを一時的に拡大
        if (assetChart) {
            // ツールチップを強制的に非表示にする
            assetChart.tooltip.setActiveElements([], { x: 0, y: 0 });

            const origLegendSize = assetChart.options.plugins.legend.labels.font.size;
            const origXTickSize = assetChart.options.scales.x.ticks.font.size;
            const origYTickSize = assetChart.options.scales.y.ticks.font.size;

            // 保存用にフォントサイズを極限まで拡大 (1080px幅に対して他項目と調和するサイズ)
            assetChart.options.plugins.legend.labels.font.size = 38;
            assetChart.options.scales.x.ticks.font.size = 34;
            assetChart.options.scales.y.ticks.font.size = 34;

            assetChart.resize();
            assetChart.update('none');

            await new Promise(r => requestAnimationFrame(r));
            await new Promise(r => setTimeout(r, 200));

            const chartDataUrl = chartCanvas.toDataURL('image/png', 1.0);

            // サイズとフォントを元に戻す
            assetChart.options.plugins.legend.labels.font.size = origLegendSize;
            assetChart.options.scales.x.ticks.font.size = origXTickSize;
            assetChart.options.scales.y.ticks.font.size = origYTickSize;

            chartContainer.style.width = origWidth;
            chartContainer.style.height = origHeight;
            chartCard.style.overflow = origCardOverflow;

            assetChart.resize();
            assetChart.update('none');

            const capImg = document.getElementById('capChartImg');
            if (!capImg) throw new Error("プレビュー用の画像要素が見つかりませんでした (capChartImg not found)");
            capImg.src = chartDataUrl;
        }

        await new Promise(r => setTimeout(r, 300));

        // 3. html2canvasでオフスクリーンコンテナをキャプチャ
        const container = document.getElementById('captureContainer');
        if (!container) throw new Error("書き出し用のテンプレートが見つかりませんでした (captureContainer not found)");

        // スマホ等のビューポートによる影響を最小化するため、一時的にスクロール位置をリセット（念のため）
        const origScrollX = window.scrollX;
        const origScrollY = window.scrollY;
        window.scrollTo(0, 0);

        const canvas = await html2canvas(container, {
            scale: 2, // 高解像度化のために2倍に設定
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#0f172a", // 背景色を明示的に指定
            logging: false,
            width: 1080,
            height: 1350,
            windowWidth: 1080,
            windowHeight: 1350,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
        });

        window.scrollTo(origScrollX, origScrollY); // 元に戻す

        // 4. ダウンロード実行
        const url = canvas.toDataURL('image/png', 1.0);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/[^0-9]/g, '');
        a.download = `FIRE_Sim_Result_${dateStr}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (err) {
        console.error("画像保存エラーの詳細:", err);
        alert("画像の生成に失敗しました。シミュレーション完了後に実行してください。\n\n詳細: " + err.message);
    } finally {
        // ボタン状態の復元
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ====================================================================
// イベント登録
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupHybridInputs();
    document.getElementById('runBtn').addEventListener('click', runMain);
    document.getElementById('logScaleToggle').addEventListener('change', onScaleToggle);

    // X共有ボタン画像保存ボタンのイベント登録
    document.getElementById('shareXBtn').addEventListener('click', shareToX);
    document.getElementById('saveImageBtn').addEventListener('click', saveImage);

    // インフレ変動モデル (AR-1) トグル連動
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

    // 現金バッファ トグル連動（双方向）
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
        if (!lastSimResult) renderEmptySummaryCard(cbToggle.checked);
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
        if (!lastSimResult) renderEmptySummaryCard(cbToggle.checked);
    });

    updateCbPanel(); // 初期ロード時の状態反映

    // 支出ガードレール トグル連動
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

    // 初期状態の（未実行）サマリカードを描画
    renderEmptySummaryCard(document.getElementById('cashBufferToggle').checked);

    // パラメータが変更されたら未実行サマリを更新するリスナーを各inputに追加
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            if (!lastSimResult) {
                renderEmptySummaryCard(document.getElementById('cashBufferToggle').checked);
            }
        });
    });
});
