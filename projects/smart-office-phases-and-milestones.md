# Smart Office — Project Phases and Milestones

Status: **Proposed delivery plan**  
Basis: [approved HLD, Revision 3](../design/smart-office-hld.md) and [approved Camp PoC selection, Revision 1](../poc/smart-office-poc-selection.md).  
Scope: Camp PoC followed by the complete target solution. This plan does not change either approved baseline. The relative six-month timeline below needs a calendar start date and named owners. The indicative effort estimate is a cloud architect's planning view, not a delivery commitment.

The **Candidate** column uses the IDs in the PoC selection's §2: **C1** booking, **C2** automatic release, **C3** notifications (selected); **C4** view/cancel, **C5** admin/audit, **C6** multi-office/timezone and **C7** corporate sign-in (not selected as standalone PoC functionalities). “Foundation” and “cross-cutting” identify work that is not itself a candidate. A candidate ID on a production milestone is traceability to the selection analysis, not an expansion of PoC scope.

## Phase 0 — Delivery setup and decisions

**Goal:** Make implementation choices explicit and establish a repeatable working environment.

| Milestone | Candidate | Completion evidence |
|---|---|---|
| M0.1 PoC implementation brief agreed | C1, C2, C3; C7 supporting | Technology stack, database, queue substitute/managed service, simulated identity and notification approach, two simulated check-in adapters, and demo environment recorded. Confirm PoC-Q-01 and PoC-Q-02 from the selection document. |
| M0.2 Delivery foundation ready | Foundation | Repository structure reflects HLD module boundaries; local/test environment and CI run; schema migration and seed-data workflow work from a clean checkout. |
| M0.3 Production decisions tracked | Cross-cutting | Azure proposal (N-01) presented for ratification; Q-01, Q-02, Q-03, Q-04, Q-06, Q-07, Q-08, Q-09, Q-10, Q-11, Q-12 and N-05/N-06 have named decision owners and due gates. Open values are not silently defaulted. |

**Gate:** Begin PoC implementation when M0.1–M0.2 are met. M0.3 is a tracked decision register, not a demand that all production questions be resolved before the PoC.

## Phase 1 — Camp PoC: booking creation

**Goal:** Prove the HLD's booking correctness mechanism (PoC Functionality 1; FR-03, FR-05, BR-01–BR-04).

| Milestone | Candidate | Completion evidence |
|---|---|---|
| M1.1 Bookable foundation | C1; C7 supporting | Seeded offices, employees, desks/parking and policies; minimal availability list; booking API enforces working-day and booking-window rules server-side. |
| M1.2 Conflict prevention proven | C1 | Database constraints prevent both resource/date and employee/date/resource-type conflicts. Repeated simultaneous request tests yield one success and one actionable rejection in each race, with no duplicate active bookings. |

**Gate:** A reserved booking can be created reliably and used as input to Phase 2. The PoC uses seeded/simulated identity; real Entra integration is a later production milestone.

## Phase 2 — Camp PoC: check-in and automatic release

**Goal:** Prove release correctness and vendor-neutral ingestion (PoC Functionality 2; FR-08–FR-10, FR-19, BR-05–BR-08).

| Milestone | Candidate | Completion evidence |
|---|---|---|
| M2.1 Check-in evidence ingested | C2 | Public ingress boundary translates the primary simulated app/QR source into a canonical event; the worker maps and matches evidence; replay of the same `(source_system, external_event_id)` has one effect. |
| M2.2 Release behavior proven | C2; C1 supporting | Configured office-local deadline releases unconfirmed reservations; repeated/overlapping sweeps do not double-release; released resources reappear in availability; late evidence is recorded as `Unmatched` and does not revive a booking. |
| M2.3 Adapter boundary proven | C2 | A second minimal simulated source uses an additive ingress adapter. Its events pass the same matching/idempotency checks without changing Booking, Check-in Gateway internals, or the domain model. |

**Gate:** Automated evidence covers duplicates, out-of-order/late events and sweep retries; the demo shows capacity returned to the pool.

## Phase 3 — Camp PoC: notifications and evidence review

**Goal:** Complete the selected end-to-end story (PoC Functionality 3; FR-18) and decide what the PoC has established.

| Milestone | Candidate | Completion evidence |
|---|---|---|
| M3.1 Outbox dispatch proven | C3 | Booking confirmation and release notice create one durable notification intent per lifecycle event; mocked channel failures do not change booking/release outcomes. |
| M3.2 Delivery limit demonstrated | C3 | Claim/lease retry and crash simulation show the documented at-least-once behavior, including the narrow possible duplicate-send window after provider acknowledgment and before local commit. |
| M3.3 PoC review completed | C1, C2, C3 | Reproducible tests, demo script and results map to the three selected functionalities; reviewer records pass/fail, architecture changes needed, and which behavior remains unproven for production. |

**Gate:** Accept the PoC evidence before committing the full-solution implementation plan. A PoC pass does not constitute production acceptance.

## Phase 4 — Production foundation and core employee journey

**Goal:** Turn proven PoC mechanics into secure, operable production modules.

| Milestone | Candidate | Completion evidence |
|---|---|---|
| M4.1 Identity and access | C7 | Entra ID OIDC, local employee projection, office-scoped roles and server-side authorization work end to end. Q-11/N-02 (leaver and role-change propagation) has a selected mechanism and verified deactivation behavior. |
| M4.2 Resource and policy management | C5, C6 | Admins manage offices, resources, external mappings and configurable policies; Q-02 parking eligibility, Q-03 filters, Q-04 initial check-in method and N-05 post-check-in cancellation have explicit values before their related behavior is enabled. |
| M4.3 Employee booking journey | C1, C4 | Responsive, accessible search/details, create, view and cancel flows implement FR-01–FR-07 and applicable BRs; status and errors are clear on mobile. |

**Gate:** Core employee and admin flows pass authorization, domain-rule and accessibility checks. Do not enable an undecided policy transition.

## Phase 5 — Production operations and integrations

**Goal:** Complete the release, communication, governance and multi-office capabilities in the HLD.

| Milestone | Candidate | Completion evidence |
|---|---|---|
| M5.1 Check-in and release operational | C2, C6 | Chosen production check-in adapter uses the ingress contract; queue retries/dead-letter handling, unmatched-event review, timezone/DST checks and observable release sweeps work across offices. |
| M5.2 Notifications integrated | C3 | Chosen Teams/email channel (Q-06) uses Microsoft Graph; outbox retry, dedup-intent and failure monitoring are verified. Client acknowledges or revises the at-least-once duplicate-send trade-off (N-06). |
| M5.3 Admin, audit and reporting | C5, C6 | Manual override requires reason and co-written append-only audit; office-scoped operational overview works; Q-12 determines whether historical utilisation reporting is included. |
| M5.4 Privacy and lifecycle | C7; cross-cutting | Retention periods (Q-07), deletion/retention jobs and employee lifecycle handling are implemented and tested against agreed policy. |

**Gate:** All 19 FRs, nine BRs and relevant NFRs in HLD §15 have implementation evidence; open product decisions that affect enabled behavior are resolved.

## Phase 6 — Hardening, release and handover

**Goal:** Demonstrate production readiness and transfer ownership to operations.

| Milestone | Candidate | Completion evidence |
|---|---|---|
| M6.1 Quality and capacity | C1–C7 | HLD §12 tests pass, including concurrent booking, retry/order cases, authorization, accessibility and end-to-end flows. Load targets use agreed Q-01 peak demand and show capacity for at least 5,000 users. |
| M6.2 Recovery and security | Cross-cutting | Agreed availability, RTO and RPO (Q-08/Q-09) are verified with backup/restore and rollback exercises; security/privacy checks, monitoring and incident runbooks are complete. |
| M6.3 Controlled production release | C1–C7 | Infrastructure as code and separate environments are reproducible; CI gates pass; a human approves the production deployment as required by HLD AD-11; post-release checks confirm booking, release, notification and audit paths. |
| M6.4 Handover accepted | Cross-cutting | Operations has dashboards, alert ownership, support procedures, known limitations and a backlog for deferred choices or enhancements. |

**Gate:** Human production approval and operational acceptance close the project release milestone.

## Dependency path

`Phase 0 → Phase 1 → Phase 2 → Phase 3 (PoC decision) → Phase 4 foundation → Phase 5 integrations → Phase 6 release`

Within production delivery, identity/resource/policy foundations (M4.1–M4.2) support employee flows, check-in mapping and office-scoped administration. The production check-in method, channel, retention and recovery targets must be decided before their respective Phase 5–6 acceptance gates. Phase 4 and Phase 5 workstreams may overlap once their interfaces and decisions are stable.

## Six-month delivery timeline

**Planning clock:** 26 working weeks, labelled W1–W26 from project kickoff; approximately 130 working days. Weeks are relative because no kickoff date was supplied. The PoC decision is targeted for **end of W10** and production release/handover for **end of W26**. Phase 5 starts before all Phase 4 UI work is finished; Phase 6 verification starts before all Phase 5 integration work is finished. Each overlap is limited to components whose interfaces and decisions are already stable.

| Phase | Planned weeks | Person-days | Target milestone dates | Dependency / scheduling note |
|---|---|---:|---|---|
| 0. Setup and decisions | W1–W2 | 32 | M0.1–M0.3 by W2 | Confirm PoC environment, stack, approved agent access and decision owners. |
| 1. PoC booking (C1) | W3–W5 | 38 | M1.1 by W3; M1.2 by W5 | Reserved booking and race-test evidence unlock C2. |
| 2. PoC release (C2) | W5–W8 | 51 | M2.1 by W6; M2.2–M2.3 by W8 | Starts in W5 against M1.1's stable booking contract; final proof uses M1.2. |
| 3. PoC notifications/review (C3) | W8–W10 | 30 | M3.1–M3.2 by W9; M3.3 by W10 | Review agent-generated work and test evidence; W10 is the production commitment gate. |
| 4. Production foundation and employee journey | W11–W18 | 111 | M4.1 by W14; M4.2 by W16; M4.3 by W18 | Identity and resource/policy contracts are delivered before dependent integrations. |
| 5. Production operations and integrations | W16–W23 | 104 | M5.1 by W20; M5.2 by W21; M5.3 by W22; M5.4 by W23 | Begins on stable M4.1/M4.2 interfaces while employee UI continues. |
| 6. Hardening, release and handover | W21–W26 | 70 | M6.1 by W24; M6.2 by W25; M6.3–M6.4 by W26 | Test/recovery preparation overlaps Phase 5; final acceptance uses all completed Phase 5 work. |

**Critical gates:** W2 PoC readiness → W5 booking correctness → W8 release correctness → W10 PoC acceptance → W16 production identity/resource contracts → W23 full functional scope → W25 quality/recovery acceptance → W26 human-approved release and handover. If M3.3 shows that the PoC architecture must change, rebaseline W11–W26 before starting dependent production implementation.

**Capacity check:** 436 PD over 130 working days requires about **3.4 full-time equivalents on average**. The 523-PD budget including the 20% reserve requires about **4.0 full-time equivalents** if the reserve is used without moving the W26 deadline. Overlap in W16–W18 and W21–W23 may need roughly **five active contributors** across backend, frontend, platform, QA, security and delivery; the roles are not interchangeable. The schedule assumes approved agent capacity and human reviewers can work in parallel, client decisions arrive by the relevant gates, and environments/tenant access are available in W1–W2. The reserve is effort capacity, not an extra calendar month; if staffing or review throughput cannot absorb it, the six-month deadline is at risk.

## Cloud architect effort estimate

One **person-day (PD)** is eight hours of one person's work. Figures include design, implementation, review, automated testing, integration and phase acceptance work; they are **effort**, not elapsed calendar days. A role can be part-time and one person may cover several roles if qualified. Estimates assume the approved HLD's modular monolith, one relational database, managed queue, Azure proposal, Entra ID and Microsoft Graph. Azure adoption remains subject to N-01 ratification.

**Indicative seniority profile:** principal/lead cloud architect; senior-led backend team (at least one senior and one mid-level engineer, because 135 backend PD exceeds one person's six-month capacity and backend workstreams overlap); senior frontend engineer; senior platform/DevOps engineer; senior QA engineer; senior UX/accessibility designer; senior security/privacy specialist; senior delivery lead. Seniority is a capability assumption for this estimate, not a requirement that every role be staffed full-time. The backend column combines both engineers' effort.

### Agentic SDLC assessment

The approved context explicitly requires agents to perform meaningful lifecycle work (C-05), while humans own decisions and quality. It also requires least-privilege agent access, approved tools, no secrets or unnecessary personal data in prompts/logs, review and vulnerability scans for generated code, retained evidence, and human production approval (NFR-11–NFR-13, C-06/C-07). The HLD adds real-database concurrency/idempotency tests, cross-office authorization, CI gates, separated environments, recovery exercises and the accepted at-least-once notification trade-off. These activities remain even when an agent writes code or test scaffolding faster.

**Reassessment:** the original **495 PD** is a reasonable conventional-delivery upper planning baseline, but it overallocates manual backend/frontend work if approved agents generate routine API/UI code, migrations, fixtures, test scaffolding and documentation. It underallocates agent governance, security review and responsive/accessibility design. The revised **agentic baseline is 436 PD (about 12% lower overall)**. Backend plus frontend falls from 257 to 190 PD (about 26% lower); verification and governance are maintained or increased. This is an estimating assumption, not a measured productivity claim. Rebaseline after the PoC using actual accepted work per PD and defect/rework evidence.

| Phase | Cloud architect | Backend engineer | Frontend engineer | Platform/DevOps engineer | QA engineer | UX/accessibility designer | Security/privacy specialist | Delivery lead | Total PD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0. Setup and decisions | 7 | 2 | 1 | 8 | 2 | 0 | 5 | 7 | **32** |
| 1. PoC booking (C1) | 3 | 18 | 5 | 2 | 7 | 0 | 1 | 2 | **38** |
| 2. PoC release (C2) | 4 | 24 | 3 | 6 | 10 | 0 | 2 | 2 | **51** |
| 3. PoC notifications/review (C3) | 3 | 11 | 2 | 3 | 8 | 0 | 1 | 2 | **30** |
| 4. Production foundation and employee journey | 9 | 35 | 25 | 10 | 17 | 8 | 4 | 3 | **111** |
| 5. Production operations and integrations | 8 | 38 | 15 | 12 | 19 | 2 | 6 | 4 | **104** |
| 6. Hardening, release and handover | 6 | 7 | 4 | 15 | 20 | 2 | 10 | 6 | **70** |
| **Total by role** | **40** | **135** | **55** | **56** | **83** | **12** | **29** | **26** | **436** |

**Phase 0–3 PoC subtotal: 151 PD. Phase 4–6 production subtotal: 285 PD.** The latter assumes the PoC code and tests can be reused; if the PoC is throwaway, re-estimate the production phases. A **20% planning reserve (87 PD, rounded)** gives **523 PD** for budget planning. Reserve is separate from the 436-PD baseline and should be allocated only against identified changes or uncertainty. These are rough-order estimates; use **about 380–570 PD** as an initial baseline uncertainty band, pending the decisions below.

### Role intent by phase

- **Phases 0–3:** The cloud architect fixes module, data and ingress boundaries and reviews evidence against the HLD. Backend and QA carry the concurrency, idempotency and crash/retry experiments. Platform builds the repeatable environment and queue/worker setup. Frontend provides only the minimal demo journey. C7 is simulated supporting identity; C4–C6 are not standalone PoC builds.
- **Phase 4:** Backend and frontend implement production identity, resource/policy administration and employee workflows. The architect resolves cross-module contracts and employee lifecycle design. UX/accessibility shapes and checks the responsive journey; security reviews authorization and privacy controls.
- **Phase 5:** Backend and platform implement the production ingress, queue, release, Graph and audit/reporting paths. QA exercises failure recovery and multi-office timezone behavior. The architect validates integration boundaries and operational trade-offs.
- **Phase 6:** Platform, QA and security lead environment, load, recovery, vulnerability and release verification. The architect signs off architecture fitness; the delivery lead coordinates the human approval gate and handover.

### Estimate assumptions and change drivers

| Assumption used for 436 PD | Re-estimate if... |
|---|---|
| PoC uses two simulated check-in adapters and mocked Entra/Graph, exactly as the approved selection proposes; its three selected functionalities are C1–C3. | A real tenant, Graph integration, hardware or vendor certification is required during the PoC. |
| Production uses one initial check-in provider through the HLD ingress contract and one agreed notification channel configuration. | Multiple real providers, custom vendor protocols or additional channels are needed at launch. |
| Managed Azure services and existing corporate tenant/pipeline access are available; no new enterprise landing zone or tenant procurement is required. | Cloud/provider choice changes, access is delayed, or a new landing zone, private networking or compliance accreditation must be built. |
| C5 covers operational overview and audit, not a separate historical analytics warehouse; C6 covers office scoping and timezone rules, not isolated per-office deployments. | Q-12 requires historical analytics or offices require distinct deployment/data-residency boundaries. |
| Q-01 peak load, Q-07 retention, Q-08 availability and Q-09 RTO/RPO fit the HLD's proposed service shape. | Measured peak load or agreed recovery/availability targets require architecture or infrastructure changes. |
| Product owners and client specialists supply timely decisions for Q-02–Q-12 and N-05/N-06. Their decision time is not included as engineering PD. | Decisions are delayed or change accepted workflows after implementation. |
| Approved agents can work in the repository/CI with scoped permissions, and generated changes are reviewed in small, traceable units. Human staff remain accountable for architecture, acceptance, security and production approval. | Tool approval, access or review throughput prevents sustained agent use; fall back toward the 495-PD conventional baseline. |

The largest estimate risk is not ordinary CRUD work; it is the still-open production inputs that determine integration, security, capacity and recovery depth. Rebaseline after M3.3 when PoC evidence exists, then again after Q-01, Q-07–Q-09 and Q-11 are decided. Cloud usage charges, licenses, vendor fees and procurement lead time are outside these person-day figures; see the separate [third-party cost estimate](smart-office-third-party-cost-estimate.md).
