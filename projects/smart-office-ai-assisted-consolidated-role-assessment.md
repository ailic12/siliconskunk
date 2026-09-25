# Smart Office — AI-Assisted Delivery and Consolidated-Role Assessment

Status: **Alternative planning scenario, 25 September 2026**  
Basis: [Smart Office phases and milestones](smart-office-phases-and-milestones.md), including its 436-person-day (PD) agentic reassessment and 26-week W1–W26 plan. The approved [HLD](../design/smart-office-hld.md) and [PoC selection](../poc/smart-office-poc-selection.md) remain the scope and acceptance baselines.  
Purpose: Reassess delivery effort when **one qualified person performs both cloud architect and delivery lead work**, AI assistants support implementation and test production, and a **part-time QA engineer evaluates AI output and verifies and validates the resulting system**.

## Assessment and staffing model

The resulting **working baseline is 389 PD**, compared with 436 PD in the source plan: **47 PD (about 11%) less**. Of this, 8 PD comes from removing duplicated architecture/delivery coordination and 39 PD from changing the QA operating model. This is a planning assumption, not a measured AI productivity gain. The source plan already credits AI assistance in backend and frontend estimates, so applying another blanket coding reduction would double-count that benefit.

| Work | Source plan | This scenario | How it is staffed |
|---|---:|---:|---|
| Cloud architect and delivery lead | 40 + 26 = 66 PD | **58 PD** | **One person** owns design decisions, delivery planning, dependencies, gates, evidence and handover. Combined effort still counts each day only once. |
| QA engineer | 83 PD | **44 PD** | **Part-time**, about 0.34 full-time equivalent (FTE) across 130 working days, with effort concentrated around PoC review and release gates. |
| Backend engineers | 135 PD | 135 PD | Senior-led engineering, including human review and execution of AI-assisted tests; at least two people are still needed for overlapping work. |
| Frontend engineer | 55 PD | 55 PD | Builds and reviews employee and admin journeys, with AI assistance already reflected in the source estimate. |
| Platform/DevOps engineer | 56 PD | 56 PD | Owns CI, environments, deployment, observability and recovery exercises. |
| UX/accessibility designer | 12 PD | 12 PD | Reviews usability and accessibility evidence at the relevant gates. |
| Security/privacy specialist | 29 PD | 29 PD | Reviews access, privacy, vulnerability evidence and release risks. |
| **Total** | **436 PD** | **389 PD** | **47 PD reduction**. |

AI assistants may draft code, migrations, test cases, fixtures, documentation and evidence summaries. Engineers remain responsible for reviewing changes, running tests against the real services, investigating failures and fixing defects. The QA engineer sets and samples the verification approach, challenges AI-produced assertions and expected results, runs or witnesses risk-based exploratory and end-to-end checks, and records validation findings against the HLD and PoC criteria. QA does not become the sole author or executor of all automated tests. Human owners retain architecture, security, acceptance and production approval decisions.

## Phase effort and gates

One PD is eight hours of one person's work. Columns are effort attributed to each phase; overlapping weeks do not add calendar time. Milestone IDs and target weeks follow the source plan.

| Phase | Weeks / gate | Architect + delivery lead, one person | Backend | Frontend | Platform | QA, part-time | UX | Security | Total PD |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0. Setup and decisions | W1–W2; M0.1–M0.3 | 9 | 2 | 1 | 8 | 1 | 0 | 5 | **26** |
| 1. PoC booking | W3–W5; M1.1–M1.2 | 5 | 18 | 5 | 2 | 4 | 0 | 1 | **35** |
| 2. PoC check-in/release | W5–W8; M2.1–M2.3 | 6 | 24 | 3 | 6 | 6 | 0 | 2 | **47** |
| 3. PoC notifications/review | W8–W10; M3.1–M3.3 | 5 | 11 | 2 | 3 | 5 | 0 | 1 | **27** |
| 4. Production foundation/journey | W11–W18; M4.1–M4.3 | 11 | 35 | 25 | 10 | 8 | 8 | 4 | **101** |
| 5. Production operations/integrations | W16–W23; M5.1–M5.4 | 11 | 38 | 15 | 12 | 9 | 2 | 6 | **93** |
| 6. Hardening/release/handover | W21–W26; M6.1–M6.4 | 11 | 7 | 4 | 15 | 11 | 2 | 10 | **60** |
| **Total** | **W1–W26** | **58** | **135** | **55** | **56** | **44** | **12** | **29** | **389** |

**PoC, Phases 0–3: 135 PD. Production, Phases 4–6: 254 PD.** The W10 PoC decision and W26 release/handover remain targets, subject to the capacity and decision checks below. The combined role has 9 PD in the first 10 working days, leaving little slack for unplanned setup decisions. Its Phase 4–6 allocations overlap, so the same person must sequence reviews, decision meetings and gate preparation; the table does not imply simultaneous full-time coverage in both phases.

### Verification and validation ownership

| Gate | AI-assisted and engineering work | Part-time QA contribution | Acceptance owner |
|---|---|---|---|
| W5 booking correctness | Backend produces and executes real-database conflict/race tests and reviews generated code and fixtures. | Check test oracles, repeat representative races and inspect failure evidence. | Combined architect/delivery lead records M1.2 evidence; client accepts PoC results at W10. |
| W8 release correctness | Backend/platform execute duplicate, late/out-of-order, idempotency and retry tests for both simulated adapters. | Review negative cases and independently reproduce high-risk release paths. | Combined role records M2.1–M2.3 evidence. |
| W10 PoC acceptance | Engineers produce reproducible suite results and demo artifacts for C1–C3. | Validate coverage against the selected PoC criteria, sample AI-generated test assertions and log gaps or defects. | Client product owner decides whether to proceed; combined role proposes any rebaseline. |
| W16–W23 production functionality | Engineers execute identity, office-scope, integration, timezone, notification, audit and lifecycle tests in CI and target environments. | Focus on cross-module, user-facing and failure-path validation; review defects and retests. | Client specialists decide open policies and participate in acceptance. |
| W24–W26 release readiness | Platform/backend execute load, recovery, rollback, vulnerability and end-to-end checks; security and UX review their domains. | Witness or independently sample critical evidence, perform exploratory acceptance checks and confirm defect closure. | Named human production approver authorizes deployment; operations accepts handover. |

The source plan's quality gates remain intact: all 19 functional requirements, nine business rules and applicable non-functional requirements require evidence; real-database concurrency, authorization, accessibility, failure/retry, privacy and recovery checks remain in scope. Agent-generated test volume alone is not acceptance evidence. The QA allocation assumes engineers carry routine automated verification and the client provides the separate participation described in [Client Involvement](../bid/client-involvement.md). The combined role cannot independently approve its own architecture or release: specialist security/UX review and the client's acceptance and production approval remain separate.

## Capacity, cost and uncertainty

Across 130 working days, 389 PD is **about 3.0 average delivery FTE**. QA's 44 PD is **about 1.7 days per week on average**, but its actual allocation should be booked around review gates. The 58-PD combined architect/delivery role is about **0.45 FTE** on average, with a near-full-time W1–W2 setup period. Backend's 135 PD still requires at least two engineers and parallel AI-assisted work; scheduling risk remains greatest in the W16–W18 and W21–W23 overlaps. Before committing to W26, check a week-by-week plan for the combined role, QA review slots and client decision turnaround.

At the [team cost estimate's](smart-office-team-cost-estimate.md) flat **€800/PD planning rate**, this scenario is **€311,200 baseline labor**. A separate **20% reserve is 77.8 PD / €62,240**, giving **466.8 PD / €373,440 labor budget including reserve** (approximately 467 PD when rounded to whole days). The difference from the source plan is **€37,600 baseline labor**, or **€45,120 including the same percentage reserve**. These are scenario calculations; the linked cost document still describes the original 436-PD baseline. Azure and other vendor charges remain separate and unchanged by this staffing assumption. AI tool seats/API use remain unquoted.

Reassess the 44-PD QA allowance and W26 date if AI-generated tests have weak assertions, defect/rework rates rise, independent validation is required by client policy, or QA must execute the full regression suite manually. Reassess the combined role if client decisions, architecture changes, vendor integration or release governance demand simultaneous attention. Rebaseline at M3.3 using accepted work, defects and review time; revisit again when production load, retention, availability, recovery and employee-lifecycle decisions are made. The original plan's **380–570 PD** rough-order range belongs to its 436-PD scenario and should not be presented as a measured uncertainty band for this new baseline.
