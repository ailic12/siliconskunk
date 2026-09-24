# Smart Office — Risks and Assumptions Register

**Purpose:** Give the project one place to track the risks, assumptions and unresolved decisions that affect the PoC and full Smart Office delivery. This is a working register: it does not claim that client decisions have been made or that HLD controls have been implemented.

**Source baseline:** [Context Discovery](../context/smart-office-context.md) §§10–13, [approved High-Level Solution Design](../design/smart-office-hld.md) §§5, 8–12, 16, and [Project Risk Ownership](smart-office-risk-ownership.md) §§1–4. Source IDs (`A`, `R`, `Q`, `N`) are retained for traceability. The [phase plan](smart-office-phases-and-milestones.md) supplies the milestone labels used below.

## How to use this register

- **Risk:** An event or condition that could harm business, delivery, security or service outcomes. The HLD describes proposed controls; a risk remains open for delivery until those controls have evidence and any residual exposure has a recorded decision.
- **Assumption:** A stated basis for planning or design that needs confirmation or remains valid only within a stated boundary. An assumption is not a client requirement.
- **Decision:** An unanswered client or implementation choice. It should not be treated as an approved default. If a decision is late or changes, its owner assesses the resulting risk, scope and schedule effect.
- The **primary owner** below is the accountable role from the risk ownership document. During mobilisation, replace roles with named people and record likelihood, impact, treatment status, evidence links, residual exposure and decision date. The delivery lead reviews the register at each phase gate and after material changes. Production approval remains a separate human decision.

## 1. Risks carried from Context Discovery

All twelve risks below are **design addressed, delivery verification pending** unless a row says otherwise. “Design addressed” means the approved HLD contains a treatment, not that the implemented system has passed its tests.

| ID and exposure | Primary owner | Planned treatment and evidence needed | Residual issue / linked decision |
|---|---|---|---|
| **R-01 Concurrent booking:** two employees obtain the same resource, or one employee exceeds the daily type limit. | Engineering lead | Database uniqueness and transaction handling for both resource/date and employee/date/type; simultaneous-request tests. | Reassess after PoC booking evidence and load testing (Q-01). |
| **R-02 Incorrect automatic release:** missing or delayed evidence frees an occupied resource. | Workplace / facilities lead | Agreed evidence/deadline policy; safe matching, conditional release, unmatched-event review and admin correction; end-to-end false-release tests. | Production evidence method (Q-04) and release behavior (Q-05) need client decisions. |
| **R-03 Duplicate check-in events:** replay causes duplicate state effects. | Engineering lead | Unique `(source_system, external_event_id)` and replay tests. | Verify with the chosen production adapter. |
| **R-04 Delayed/out-of-order events:** late evidence corrupts booking state or is lost. | Engineering lead | Re-evaluate current state when applying evidence; retain unmatched late events; test no automatic restoration after release. | Administrator resolution procedure must be agreed with workplace lead. |
| **R-05 Retry safety:** repeated jobs duplicate state changes or messages. | Engineering lead | Conditional release sweep; one notification intent per state change; claim/lease outbox and crash/retry tests. | External delivery can rarely duplicate a message; see N-06. |
| **R-06 Multi-office timezones:** wrong local deadline releases or blocks bookings. | Solution architect / technical lead | Office IANA timezone, local booking date and on-demand deadline calculation; multi-office and daylight-saving tests. | Confirm local office data and policies (A-04, A-05). |
| **R-07 Authorisation:** users access another employee's booking or an unauthorized office. | Security and privacy owner | Server-side employee/office checks on every endpoint; negative access and role-change tests. | Employee lifecycle method remains open (Q-11/N-02). |
| **R-08 Privileged administrative actions:** manual corrections are unaccountable. | Workplace / facilities lead | Define override authority; require a reason and audit write in the same transaction; test all override paths. | Administrator scope (Q-10) needs confirmation. |
| **R-09 Integration coupling:** provider-specific behavior leaks into booking logic. | Solution architect / technical lead | Public, documented per-provider ingress and canonical event; prove a second adapter without changing the domain. | Initial production provider (Q-04) remains open. |
| **R-10 Privacy:** booking/check-in records expose attendance patterns longer or more widely than needed. | Security and privacy owner | Minimize data and access; approve category-specific retention; verify deletion/anonymization. | Retention periods (Q-07) are unanswered. |
| **R-11 Agent access:** agents gain secrets, production access or unnecessary personal data. | Security and privacy owner | Approved tools, scoped permissions, secret exclusion, access review and action records. | Control is ongoing throughout delivery. |
| **R-12 Generated change quality:** agent-authored changes introduce defects or vulnerabilities. | Delivery lead / project manager | Human review, business-rule tests, dependency/vulnerability scans and retained CI evidence; block unresolved critical findings. | Control is ongoing; production still requires human approval. |

## 2. Additional project and residual risks

These items follow from the HLD's open decisions and the risk ownership document. They are tracked separately so that an architectural response to R-01–R-12 does not hide delivery exposure.

| ID and exposure | Primary owner | Treatment / decision point |
|---|---|---|
| **PR-01 Decision delay or scope change:** unanswered peak demand, policy, retention or recovery inputs change design, test depth, cost or schedule after implementation starts. | Delivery lead / project manager | Name decision makers and due gates; escalate overdue inputs; assess changes and rebaseline after the PoC review (M3.3) and later material decisions. See §4. |
| **PR-02 Production access remains stale:** a leaver or role change in Entra ID is not reflected promptly in Smart Office. | Client identity and Microsoft 365 owner | Choose and test a propagation/deactivation mechanism before M4.1; review its access risk with security. This is Q-11/N-02, a genuine HLD design gap. |
| **PR-03 Service commitments exceed proposed platform:** actual peak load, availability or recovery targets require a different capacity or resilience design. | Client corporate IT / platform operations owner | Obtain Q-01 and Q-08/Q-09 inputs; size and load-test, then exercise restore and rollback against agreed targets before M6.1–M6.2. |
| **PR-04 Duplicate external notification:** a worker crashes after Microsoft Graph accepts a send but before local `Sent` status is committed. | Client business sponsor / product owner | Review the HLD's at-least-once trade-off (N-06) at M5.2; acknowledge it or request a changed delivery requirement. This does not corrupt booking state. |

## 3. Assumptions and validation

The first seven entries reproduce Context §11. **HA-01** is the HLD's explicit additional assumption. Each remains a planning or design basis until validated by the indicated owner; a failed assumption triggers impact analysis rather than silently changing the requirement baseline.

| ID | Assumption / boundary | Validation owner and action | If false |
|---|---|---|---|
| **A-01** | Microsoft Entra ID is the authoritative employee identity provider. | Identity owner: confirm tenant, integration and lifecycle source before production identity work. | Redesign authentication/provisioning scope; reassess R-07 and PR-02. |
| **A-02** | Smart Office is a new application, not an extension of an existing booking system. | Product owner: confirm system boundary in discovery. | Assess migration, coexistence and integration work. |
| **A-03** | Existing Microsoft communication channels can be used for notifications. | Identity/Microsoft 365 owner: confirm channel access and Graph permissions; product owner selects Q-06. | Rework notification channel, permissions and delivery estimate. |
| **A-04** | Each office has its own local timezone. | Workplace / facilities lead: provide and verify each office's IANA timezone. | Revisit date/deadline model and R-06 tests. |
| **A-05** | Booking and release policies may differ between offices. | Workplace / facilities lead: confirm policy ownership and initial office values. | Simplify or revise configuration and acceptance criteria as appropriate. |
| **A-06** | Physical access and sensor integrations are not mandatory for the PoC. | Product owner: confirm the Camp PoC boundary before PoC implementation. | Reassess PoC integration scope, access and schedule. |
| **A-07** | The client has prescribed no cloud provider, database, language or application framework; solution design chooses them. | Platform operations owner: confirm enterprise constraints and ratify or revise proposed Azure (N-01). | Reassess HLD choices, procurement and estimate. |
| **HA-01 / Q-05** | The HLD provisionally assumes a released resource is immediately bookable during the same workday. | Workplace / facilities lead: obtain an explicit policy decision before enabling release/rebooking behavior. | Change the policy/availability behavior and its tests. |

**Proposals that are not assumptions:** Azure is a proposed design choice awaiting ratification (N-01). The HLD's RPO ≤15 minutes and RTO ≤4 hours are discussion starting points, not agreed targets (Q-09); no availability percentage is committed (Q-08). App/QR is an option for first production check-in, not a selected method (Q-04). No peak transaction number or retention duration is assumed (Q-01, Q-07).

## 4. Open decisions and resolution gates

| Source IDs | Decision needed | Accountable role | Needed by |
|---|---|---|---|
| **Q-01** | Peak booking demand and measurable load targets. | Product owner | M6.1 capacity acceptance; early input needed for sizing. |
| **Q-02, Q-03** | Parking eligibility and searchable resource attributes. | Workplace / facilities lead | M4.2 policy/resource design. |
| **Q-04** | First production check-in method and provider. | Workplace / facilities lead | M4.2 related policy; M5.1 integration. |
| **Q-05, N-05** | Same-day rebooking after release and post-check-in cancellation policy. | Workplace / facilities lead | Before those transitions are enabled in Phase 4–5. |
| **Q-06** | Teams, email or both at launch. | Product owner | M5.2 integration. |
| **Q-07** | Retention periods and deletion treatment by data category. | Security and privacy owner | M5.4 privacy acceptance. |
| **Q-08, Q-09** | Availability, RTO and RPO targets. | Platform operations owner | M6.2 recovery/service acceptance; earlier for platform sizing. |
| **Q-10** | Global and/or office-scoped administrators. | Workplace / facilities lead | M4.2 role setup and M5.3 audit acceptance. |
| **Q-11 / N-02** | Joiner, mover, leaver and role-change propagation mechanism. | Identity/Microsoft 365 owner | M4.1 production identity acceptance. |
| **Q-12** | Current-state overview only or historical utilisation reporting. | Product owner | M5.3 reporting acceptance. |
| **N-01** | Ratify Azure or state another hosting constraint. | Platform operations owner | Production platform commitment. |
| **N-03** | Choose reference technology stack. | Solution architect / technical lead | PoC implementation brief; HLD defers this choice. |
| **N-04** | Select release-sweep polling and timezone evaluation implementation. | Engineering lead | Detailed release implementation; HLD treats this as a low-level choice. |
| **N-06** | Acknowledge the rare duplicate-send window or change the notification guarantee. | Product owner | M5.2 notification acceptance. |

At each gate, the owner records the chosen answer, date, affected requirements, changed risks and evidence. If the answer changes scope, design or cost, the delivery lead takes the impact to the appropriate human decision maker before dependent work proceeds.
