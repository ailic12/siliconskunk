# Smart Office — Team Cost Estimate

Status: **Indicative budget, 24 September 2026**.  
Basis: [436 person-day agentic delivery plan](smart-office-phases-and-milestones.md), including its role allocation and six-month schedule.  
**Planning rate: €800 per person-day (PD), applied equally to every role and seniority.** One PD is eight hours. This is a user-specified budgeting rate, not a market benchmark, payroll cost or vendor quote. Amounts exclude tax.

## Cost by role

| Role and indicative seniority | PD | Rate | Team cost |
|---|---:|---:|---:|
| Principal cloud architect | 40 | €800/PD | **€32,000** |
| Backend engineers, senior-led blend of senior + mid | 135 | €800/PD | **€108,000** |
| Senior frontend engineer | 55 | €800/PD | **€44,000** |
| Senior platform/DevOps engineer | 56 | €800/PD | **€44,800** |
| Senior QA engineer | 83 | €800/PD | **€66,400** |
| Senior UX/accessibility designer | 12 | €800/PD | **€9,600** |
| Senior security/privacy specialist | 29 | €800/PD | **€23,200** |
| Senior delivery lead | 26 | €800/PD | **€20,800** |
| **Baseline team total** | **436** | **€800/PD** | **€348,800** |

The backend effort exceeds one person's approximately 130 working days in six months, and its workstreams overlap. Plan for **at least two backend engineers** sharing the 135 PD. Other roles can be fractional; the schedule still needs roughly five active contributors during its busiest overlaps.

## Cost by phase

| Phase | Weeks | PD | Cost at €800/PD |
|---|---|---:|---:|
| 0. Setup and decisions | W1–W2 | 32 | €25,600 |
| 1. PoC booking (C1) | W3–W5 | 38 | €30,400 |
| 2. PoC release (C2) | W5–W8 | 51 | €40,800 |
| 3. PoC notifications and review (C3) | W8–W10 | 30 | €24,000 |
| **PoC subtotal** | **W1–W10** | **151** | **€120,800** |
| 4. Production foundation and employee journey | W11–W18 | 111 | €88,800 |
| 5. Production operations and integrations | W16–W23 | 104 | €83,200 |
| 6. Hardening, release and handover | W21–W26 | 70 | €56,000 |
| **Production subtotal** | **W11–W26** | **285** | **€228,000** |
| **Project baseline** | **W1–W26** | **436** | **€348,800** |

## Separate team and third-party budgets

The [third-party cost estimate](smart-office-third-party-cost-estimate.md) allows **$1,000–$3,000** for Azure infrastructure during the 26-week build (dev/test and the first 1–2 months of production-like infrastructure). For a comparable EUR budget, this section uses the [Banque de France's 23 September 2026 daily parity](https://www.banque-france.fr/en/statistics/rates-and-prices/exchange-rates-daily-parities-2026-09-23): **€1 = $1.1411**, so **$1 ≈ €0.87635**. The conversion is a planning snapshot; actual invoices may use a different rate and include bank fees or tax.

| Budget category for W1–W26 | Basis | EUR estimate |
|---|---|---:|
| **Team labor — baseline** | 436 PD × €800 | **€348,800** |
| **Team labor — 20% reserve** | 87.2 additional PD × €800 | **€69,760** |
| **Team labor — budget including reserve** | Labor only; no vendor charges | **€418,560** |
| **Third-party — priced Azure infrastructure** | $1,000–$3,000 converted at the rate above | **≈ €876–€2,629** |
| **Third-party — other vendors** | AI tooling, new licenses, real check-in provider and optional enterprise services | **Not yet quoted** |
| **Combined baseline of priced items** | Team baseline + Azure infrastructure | **≈ €349,676–€351,429** |
| **Combined planning budget of priced items** | Team with reserve + Azure infrastructure | **≈ €419,436–€421,189** |

After go-live, the Azure run-rate estimate is **$550–$900/month**, or about **€482–€789/month** at the same planning exchange rate. It is a future operating cost, not an extra six-month line item to add to the table above.

### Unpriced third-party commitments

| Item | HLD/context basis | Budget treatment |
|---|---|---|
| Approved AI agent seats or API usage | Agentic SDLC and approved-tool constraint C-07 | **Quote required** from the selected provider, including seats, model/API usage and spend cap. The combined total above excludes it. |
| Additional Microsoft 365/Entra licenses | Corporate identity and Graph notifications (FR-17/FR-18) | **Assumed already licensed**. Confirm user and sending identities; price any new licenses separately. |
| Production check-in vendor, badges or sensors | Vendor-neutral ingress (FR-19), production method open (Q-04) | **Quote required** after selecting the first real provider. The PoC uses simulated adapters. |
| Enterprise networking, WAF, support or stricter disaster recovery | Cloud choice N-01 and availability/RTO/RPO Q-08/Q-09 open | **Scope-dependent**; obtain an Azure calculator quote if required by client policy. |

The **third-party category is separate from the team category**. The combined figures are provided only for planning convenience. Because other vendor charges are unquoted, they are **priced-item totals, not an all-in procurement ceiling**.

## Reserve and exclusions

- **Team baseline:** 436 PD × €800 = **€348,800**.
- **20% labor reserve:** 87.2 PD × €800 = **€69,760**. The reserve is budget capacity, not part of the 436-PD baseline.
- **Team budget including reserve:** **€418,560**.
- **Effort uncertainty:** the delivery plan's rough-order 380–570 PD band would cost **€304,000–€456,000** at the same rate, before reserve. This band is an alternative effort scenario, not an additional line item to add to the baseline.
- **Other exclusions:** travel, VAT, procurement/legal work and post-go-live support staff are not included. The unpriced third-party commitments above also remain outside the combined range.

**Budget gate:** confirm whether €800/PD is a billable contractor rate or an internal loaded-cost assumption, and whether it includes vendor overhead. Reprice the remaining 285 production PD at the W10 PoC gate if accepted scope or effort changes.
