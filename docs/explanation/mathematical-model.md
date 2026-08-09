# Mathematical Model

This document explains the stochastic equations used by the FIRE Monte Carlo Simulator.
All equations are cross-referenced to `js/core/simulation.js`.

## 1. Asset Update (Log-Normal Model)

At each monthly time step `t`, risk assets evolve as:

$$S_{t} = S_{t-1} \times \exp(\mu_m + \sigma_m Z_t)$$

where `Z_t` is a standard-normal random variable, and:

$$\mu_m = \frac{\mu_{\text{annual}}}{12}, \quad \sigma_m = \frac{\sigma_{\text{annual}}}{\sqrt{12}}$$

In code (`js/core/simulation.js`):
```javascript
currentRiskAsset *= Math.exp(monthlyDrift + monthlyVol * Z);
```

## 2. Ito Drift Adjustment (Volatility Drag)

The input parameter `expectedReturn` is treated as the **arithmetic mean** annual return `μ_arith`.
The simulation converts it to the **geometric drift** (Ito-corrected drift) to ensure the simulation is
unbiased in the log-normal sense:

$$\mu_{\text{annual}} = \ln(1 + \mu_{\text{arith}}) - \frac{\sigma_{\text{annual}}^2}{2}$$

In code:
```javascript
const adjustedAnnualDrift = Math.log(1 + arithmeticReturn) - (annualVol * annualVol) / 2;
const monthlyDrift = adjustedAnnualDrift / 12;
```

This subtraction of \\(\sigma^2/2\\) is the **volatility drag** correction.

Over a **12-month horizon**, the expected simple (arithmetic) return equals the input `expectedReturn`:

$$E\!\left[\frac{S_{t+12}}{S_t}\right] - 1 = \mu_{\text{arith}}$$

To see why: the 12-month log-return is \\(\mu_{\text{annual}} + \sigma_{\text{annual}} Z\\) where \\(Z \sim \mathcal{N}(0,1)\\).
By the log-normal expectation formula:

$$E\!\left[\exp\!\left(\mu_{\text{annual}} + \sigma_{\text{annual}} Z\right)\right]
= \exp\!\left(\mu_{\text{annual}} + \frac{\sigma_{\text{annual}}^2}{2}\right)
= \exp\!\left(\ln(1+\mu_{\text{arith}})\right) = 1 + \mu_{\text{arith}}$$

Three distinct growth rates arise from this parameterization:

| Growth rate | Formula | Notes |
|---|---|---|
| **Arithmetic (input)** | \\(\mu_{\text{arith}} = \texttt{expectedReturn}/100\\) | Input parameter; expectation of gross annual return |
| **Log-drift (annual)** | \\(\mu_{\text{annual}} = \ln(1+\mu_{\text{arith}}) - \sigma^2/2\\) | Used as annual drift in the model; also the median log-return |
| **Geometric / median** | \\((1+\mu_{\text{arith}})\cdot e^{-\sigma^2/2} - 1 \approx \mu_{\text{arith}} - \sigma^2/2\\) | Actual compound growth rate; lower than arithmetic by volatility drag (exact: \\(\times e^{-\sigma^2/2}\\); approx valid for small \\(r, \sigma\\)) |

The drift adjustment does not eliminate volatility drag — it ensures the *arithmetic expectation* of the gross annual return equals \\(1 + \mu_{\text{arith}}\\), which is the intended input semantics of `expectedReturn`.

## 3. Log-t Distribution Model

When `useTDistribution: true`, the normal draw `Z_t` is replaced with a scaled Student-t draw:

$$Z_t = \frac{T_\nu}{\sqrt{\nu / (\nu - 2)}}, \quad \nu > 2$$

This rescaling normalizes the distribution to unit variance, keeping the same drift/volatility
parameterization as the log-normal model while introducing heavier tails (fat-tail risk).

In code:
```javascript
const tRand = rngs.tRand(simDf);
Z = tRand / Math.sqrt(simDf / (simDf - 2));
```

The degrees of freedom `simDf = simDfManual ? simDfNum : calcAutoDf(volatility)`.

## 4. AR-1 Inflation Model

When `useArInflation: true`, the monthly inflation rate follows a mean-reverting AR-1 process:

$$r_{\inf,t} = C + \rho \cdot r_{\inf,t-1} + \sigma_{\inf,m} \cdot Z_{\inf,t}$$

where:
- \(C = (1 - \rho) \cdot \bar{r}_{\inf}\) — intercept ensuring reversion to the long-run mean \(\bar{r}_{\inf}\)
- \(\rho\) = `infAr` — AR coefficient (persistence of inflation shocks; 0 = random, 0.9 = highly persistent)
- \(\sigma_{\inf,m} = \sigma_{\inf,\text{annual}} / \sqrt{12}\)
- \(\bar{r}_{\inf}\) = `inflationRate / 100`

In code:
```javascript
const C = (1 - infAr) * expectedLongTermInf;
currentInfRate = C + (infAr * currentInfRate) + (monthlyInfVol * InfZ);
infMultiplier *= Math.exp(currentInfRate / 12);
```

## 5. Monthly Processing Order

Each month is processed in this sequence:

1. Update inflation rate and multiplier
2. Apply market return to risk assets
3. Execute spending (withdrawal) — source depends on guardrail/cash-buffer state from the prior month
4. Confirm post-spending total assets
5. Evaluate thresholds (bankruptcy, guardrail, cash-buffer switching, drawdown) — results apply next month

For full details, see [About Simulation Decision Timing](./decision-timing.md).
