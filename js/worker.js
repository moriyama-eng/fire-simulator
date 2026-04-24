// ====================================================================
// コア数学関数（app.js から移植）
// ====================================================================
function splitmix32(seed) {
    return function () {
        seed |= 0;
        seed = seed + 0x9e3779b9 | 0;
        let t = seed ^ seed >>> 16;
        t = Math.imul(t, 0x21f0aaad);
        t = t ^ t >>> 15;
        t = Math.imul(t, 0x735a2d97);
        return ((t = t ^ t >>> 15) >>> 0);
    };
}

function xoshiro128ss(seed) {
    const sm = splitmix32(seed);
    let s0 = sm(), s1 = sm(), s2 = sm(), s3 = sm();
    return function () {
        const rotl = (x, k) => (x << k) | (x >>> (32 - k));
        const result = (Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0) / 4294967296.0;
        const t = s1 << 9;
        s2 ^= s0;
        s3 ^= s1;
        s1 ^= s2;
        s0 ^= s3;
        s2 ^= t;
        s3 = rotl(s3, 11);
        return result;
    }
}

// ====================================================================
// Box-Muller キャッシュ（ワーカースコープ）
// sin側の計算結果を保持して、重い数学処理を実質半分にする
// ====================================================================
let hasCachedNormal = false;
let cachedNormal = 0.0;

function randomNormal(rngFunc) {
    // キャッシュがあれば返してフラグをリセット
    if (hasCachedNormal) {
        hasCachedNormal = false;
        return cachedNormal;
    }
    // キャッシュがなければ乱数を2つ生成し、sin側をキャッシュ
    let u = 0, v = 0;
    while (u === 0) u = rngFunc();
    while (v === 0) v = rngFunc();

    const r = Math.sqrt(-2.0 * Math.log(u));
    const theta = 2.0 * Math.PI * v;

    // sin側をキャッシュし、フラグを立てる
    cachedNormal = r * Math.sin(theta);
    hasCachedNormal = true;

    // cos側を返す
    return r * Math.cos(theta);
}

function gammaRand(rngFunc, alpha) {
    if (alpha <= 0.0) return 0.0;
    let a = alpha;
    if (alpha < 1.0) {
        a = alpha + 1.0;
    }
    const d = a - 1.0 / 3.0;
    const c = 1.0 / Math.sqrt(9.0 * d);
    let v, x;
    while (true) {
        x = randomNormal(rngFunc);
        v = 1.0 + c * x;
        while (v <= 0.0) {
            x = randomNormal(rngFunc);
            v = 1.0 + c * x;
        }
        v = v * v * v;
        const u = rngFunc();
        const x2 = x * x;
        if (u < 1.0 - 0.0331 * x2 * x2) break;
        if (Math.log(u) < 0.5 * x2 + d * (1.0 - v + Math.log(v))) break;
    }
    let res = d * v;
    if (alpha < 1.0) {
        let u2 = rngFunc();
        while (u2 === 0) u2 = rngFunc();
        res *= Math.pow(u2, 1.0 / alpha);
    }
    return res;
}

function randomT(rngFunc, df) {
    const Z = randomNormal(rngFunc);
    const chi2 = 2.0 * gammaRand(rngFunc, df / 2.0);
    return Z / Math.sqrt(chi2 / df);
}

// ====================================================================
// 自由度の自動計算（app.js からコピー、UI用として元も残す）
// ====================================================================
function calcAutoDf(volatility) {
    if (volatility <= 0) return 30.0;
    let df = 5.0 - 0.1 * (volatility - 10.0);
    if (volatility < 10) df = 5.0;
    if (volatility > 30) df = 3.0;
    return Math.max(2.5, Math.min(30.0, df));
}

// ====================================================================
// メインスレッドからの計算要求ハンドラ
// ====================================================================
self.onmessage = function (e) {
    const { params, pathsCount, seedOffset, dataLen } = e.data;

    // シミュレーションに必要な派生変数を事前計算・初期化
    const {
        initialRiskAsset, initialCashBuffer, monthlyExpense,
        expectedReturn, volatility, inflationRate,
        simYears, drawdownTrigger, drawdownReplenish, replenishPace,
        cashBufferToggle, guardrailToggle, guardrailTrigger, guardrailReduction, guardrailRelease,
        useArInflation, infVol, infAr,
        useTDistribution, simDfManual, simDfNum,
        seedNum
    } = params;

    const totalMonths = simYears * 12;
    const EPSILON = 1.0; // ゼロ除算防止および破産判定用の微小値（円単位, W1）

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

    const simDf = simDfManual ? simDfNum : calcAutoDf(volatility);

    // フラットな1次元 Float32Array を確保（pathsCount * dataLen）
    const totals = new Float32Array(pathsCount * dataLen);
    const cashes = new Float32Array(pathsCount * dataLen);
    const dds = new Float32Array(pathsCount * dataLen);
    // パスごとの最大値（長さ pathsCount）
    const maxDds = new Float32Array(pathsCount);
    const maxUws = new Float32Array(pathsCount);

    let bankruptCount = 0;

    // ====================================================================
    // パスごとの計算ループ
    // ====================================================================
    for (let p = 0; p < pathsCount; p++) {
        // パス間の独立性を担保するため、各パス先頭で必ずキャッシュをクリア
        hasCachedNormal = false;

        // シードオフセットを組み合わせてパスごとに独立した乱数列を生成
        let rng = xoshiro128ss(seedNum + seedOffset + p);

        let currentRiskAsset = initialRiskAsset;
        let currentCash = activeInitialCashBuffer;
        let highWaterMark = initialRiskAsset + currentCash;
        let bankrupt = false;
        let isReplenishMode = false;
        // 翌月反映フラグ（初期値はfalse、初月はデフォルト動作）
        let useCashNextMonth = false;
        let isGuardrailActive = false;

        let currentUwMonths = 0;
        let maxUwMonths = 0;
        let maxDD = 0;

        // 初期値を1次元インデックスに書き込む
        const baseIdx = p * dataLen;
        totals[baseIdx] = currentRiskAsset + currentCash;
        cashes[baseIdx] = currentCash;
        dds[baseIdx] = 0; // 初期時点のドローダウンは0%

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

            // ----- 1. 市場リターン適用 -----
            let Z;
            if (useTDistribution) {
                const tRand = randomT(rng, simDf);
                Z = tRand / Math.sqrt(simDf / (simDf - 2));
            } else {
                Z = randomNormal(rng);
            }
            currentRiskAsset *= Math.exp(monthlyDrift + monthlyVol * Z);

            // ----- 2. インフレ反映後の支出額を計算 -----
            let currentExpense = monthlyExpense * infMultiplier;
            const currentBufferLimit = activeInitialCashBuffer * infMultiplier;

            // 前月の支出後判定で決定したガードレール状態を適用（当月の支出に反映）
            if (isGuardrailActive) {
                // guardrailReductionはマイナス（例：-20.0 => 1 - 0.20 = 0.8倍）
                currentExpense *= (1 + guardrailReduction / 100);
            }

            // ----- 3. 支出の実行（前月の支出後判定で決定した useCashNextMonth を使用）-----
            if (cashBufferToggle && useCashNextMonth) {
                // 現金バッファから支出
                currentCash -= currentExpense;
            } else if (cashBufferToggle && isReplenishMode && currentCash < currentBufferLimit) {
                // 補充モード中で現金が不足していれば補充
                const shortage = currentBufferLimit - currentCash;
                const replenishAmount = Math.min(shortage, currentExpense * replenishPace);
                const actualReplenish = Math.min(replenishAmount, currentRiskAsset);
                currentRiskAsset -= actualReplenish;
                currentCash += actualReplenish;
                // 支出はリスク資産から
                currentRiskAsset -= currentExpense;
            } else {
                // 通常はリスク資産から支出
                currentRiskAsset -= currentExpense;
            }

            // 資産が負になった場合の補正（破綻処理）
            if (currentRiskAsset + currentCash <= EPSILON) {
                currentRiskAsset = 0;
                currentCash = 0;
                bankrupt = true;
                bankruptCount++;
                const idx = baseIdx + t;
                totals[idx] = 0;
                cashes[idx] = 0;
                dds[idx] = -1.0;
                maxDD = -1.0;
                currentUwMonths += (totalMonths - t) + 1;
                if (currentUwMonths > maxUwMonths) maxUwMonths = currentUwMonths;
                break;
            }
            if (currentCash < 0) { currentRiskAsset += currentCash; currentCash = 0; }
            if (currentRiskAsset < 0) { currentCash += currentRiskAsset; currentRiskAsset = 0; }

            // ----- 4. 支出後総資産 (EOM Asset) の確定 -----
            const eomAsset = currentRiskAsset + currentCash;
            const safeHWM = Math.max(highWaterMark, EPSILON);
            const eomDD = Math.min(0, (eomAsset - safeHWM) / safeHWM);

            // ----- 5. 支出後総資産を基準にすべての判定を実施（翌月用フラグ更新）-----
            // 5-1. 現金バッファ使用判定（翌月の支出元を決定）
            useCashNextMonth = cashBufferToggle && (eomDD <= ddThreshold);

            // 5-2. ガードレール発動/解除判定（翌月の支出額に反映）
            if (guardrailToggle) {
                if (eomDD <= triggerGR) {
                    isGuardrailActive = true;
                } else if (isGuardrailActive && eomDD >= releaseGR) {
                    // ガードレール終了閾値（releaseGR）を上回った場合に解除
                    isGuardrailActive = false;
                }
            }

            // 5-3. 高値更新・停滞期間・補充モード開始判定
            if (eomAsset >= highWaterMark) {
                currentUwMonths = 0;
                highWaterMark = eomAsset;
                isReplenishMode = true;  // 高値更新で補充モード開始
            } else {
                currentUwMonths++;
                if (currentUwMonths > maxUwMonths) maxUwMonths = currentUwMonths;
                // 補充モード終了判定：支出後DDが補充終了閾値を下回ったら終了
                if (eomDD <= ddReplenishThreshold) {
                    isReplenishMode = false;
                }
            }

            // 5-4. 最大ドローダウン更新
            if (eomDD < maxDD) maxDD = eomDD;

            // ----- 6. 記録 -----
            const idx = baseIdx + t;
            totals[idx] = eomAsset;
            cashes[idx] = currentCash;
            dds[idx] = eomDD; // ドローダウン率を蓄積
        }
        maxDds[p] = maxDD;
        maxUws[p] = maxUwMonths;

        // 進捗を100パスごとに間引いてメインスレッドへ通知（キューを溢れさせない）
        if (p % 100 === 0) {
            self.postMessage({ type: "progress", completed: p });
        }
    }

    // 全パス完了後、ArrayBufferの所有権をゼロコピー転送でメインスレッドへ移譲
    self.postMessage(
        {
            type: "complete",
            totalsBuffer: totals.buffer,
            cashesBuffer: cashes.buffer,
            ddsBuffer: dds.buffer,
            maxDdsBuffer: maxDds.buffer,
            maxUwsBuffer: maxUws.buffer,
            bankruptCount: bankruptCount
        },
        [totals.buffer, cashes.buffer, dds.buffer, maxDds.buffer, maxUws.buffer]
    );
};
