# Smart Office — Client Involvement

**Purpose:** Define the client-side roles, participation and indicative effort needed for the proposed Smart Office delivery. These are responsibilities to assign, not a required number of separate people. One qualified person or team may cover several roles, provided decisions and approvals have clear owners.

**Basis:** [Context Discovery](../context/smart-office-context.md), the [approved High-Level Solution Design](../design/smart-office-hld.md), the [PoC selection](../poc/smart-office-poc-selection.md), and the [proposed phases and milestones](../projects/smart-office-phases-and-milestones.md). The relative plan runs for 26 working weeks, with a PoC decision at the end of W10 and production release and handover targeted for the end of W26. A calendar start date and named client owners remain to be agreed. See also [Client Inputs and Dependencies](client-inputs-and-dependencies.md) for the specific decisions and materials requested.

## 1. Client-side roles and accountability

| Role | Required contribution and decision authority |
|---|---|
| **Business sponsor / product owner** | Own priorities, success criteria, release scope and acceptance. Resolve business questions such as parking eligibility, resource filters, check-in method, notification channel, released-resource behaviour and post-check-in cancellation. Decide at the W10 PoC gate whether to proceed to full implementation. |
| **Workplace and facilities lead** | Own the office resource inventory, booking and release policies, operational exception process and utilisation measures. Confirm who may administer each office and what reporting is needed. |
| **Workplace administrators** | Validate resource and policy management, manual corrections, unmatched check-in handling, audit history and operational reporting. Help prepare operating procedures and accept the administrative handover. |
| **Employee representatives / pilot users** | Test the booking, cancellation, check-in and notification journeys on mobile-sized screens. Provide usability and accessibility feedback and participate in acceptance testing. |
| **Corporate identity and Microsoft 365 owner** | Arrange Entra ID application access, test identities, role and office-scope mapping, joiner/mover/leaver handling, and the selected Teams or email integration through Microsoft Graph. Identity and Microsoft 365 may be owned by different client teams. |
| **Cloud/platform operations owner** | Provide the agreed hosting and environment access path; own production monitoring, backup, restore, incident response and support handover. Confirm availability, RTO and RPO targets with the business owner. |
| **Security and privacy owner** | Set retention and data-handling policy, approved AI tools and access rules; review security evidence, permissions and residual risks. Legal or records specialists may need to contribute to retention decisions. |
| **Named production release approver** | Review release evidence and explicitly approve each production deployment. This authority may be delegated to a suitably empowered business or IT owner, but must be named before release. |

If a physical access-card or sensor system is chosen for production check-in, the client also needs that system's owner or vendor contact for event specifications, credentials, mappings and testing. Physical integrations are optional for the Camp PoC.

## 2. Indicative client effort

One **person-day (PD)** is eight hours of one person's work. The estimate includes workshops, decisions, access and data preparation, reviews, pilot testing, acceptance and handover. It is **client effort in addition to** the delivery team's 436-PD baseline in the proposed phase plan; that baseline explicitly excludes client decision time. The figures are rough planning allowances, not committed staffing or elapsed duration.

| Client-side role | Phase 0 W1–2 | Phase 1 W3–5 | Phase 2 W5–8 | Phase 3 W8–10 | Phase 4 W11–18 | Phase 5 W16–23 | Phase 6 W21–26 | Total PD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Business sponsor / product owner | 3 | 1 | 1 | 4 | 8 | 7 | 5 | **29** |
| Workplace and facilities lead | 2 | 1 | 1 | 2 | 5 | 4 | 3 | **18** |
| Workplace administrators | 0.5 | 0.5 | 0.5 | 1.5 | 3 | 4 | 4 | **14** |
| Employee representatives / pilot users | 0 | 0.5 | 0.5 | 1 | 2 | 2 | 3 | **9** |
| Corporate identity and Microsoft 365 owner | 1 | 0 | 0 | 0 | 4 | 4 | 2 | **11** |
| Cloud/platform operations owner | 2 | 0 | 0 | 0 | 4 | 4 | 6 | **16** |
| Security and privacy owner | 2 | 0 | 0 | 1 | 3 | 3 | 4 | **13** |
| Named production release approver | 0 | 0 | 0 | 0 | 0 | 0 | 1 | **1** |
| **Total PD** | **10.5** | **3** | **3** | **9.5** | **29** | **28** | **28** | **111** |

The **PoC subtotal is 26 PD** across Phases 0–3; the **production subtotal is 85 PD** across Phases 4–6. Total estimated client effort is **111 PD / 888 hours**, equivalent to about **0.85 full-time person over 130 working days** when aggregated across all client roles. This average should not be read as a request for one dedicated person: the skills and approval authorities differ. Allow **roughly 90–140 PD** for initial bid planning until the client confirms the production decisions and access model. Phase windows overlap, so the columns show effort attributed to each phase, not extra elapsed weeks.

## 3. When client participation is needed

| Period and gate | Main client activities | Expected availability |
|---|---|---|
| **W1–W2 — PoC readiness** | Name decision owners; agree the PoC brief, simulated data/integrations and approved agent access; identify the path for production platform decisions. | Product owner and facilities lead available for working sessions and prompt decisions; IT and security contacts available for setup. |
| **W3–W8 — booking and release PoC** | Validate representative resource and policy examples; review booking conflicts, check-in evidence and release behaviour as demonstrated. | Short, scheduled reviews with product, facilities, administrators and pilot users. |
| **W8–W10 — PoC acceptance** | Review test evidence and demo, record what remains unproven, and decide whether to commit to the production implementation plan. | Decision makers and reviewers available for the W10 gate. |
| **W11–W18 — production identity and employee journey** | Confirm employee roles/lifecycle, inventory, policy values and accessible employee/admin flows; supply tenant access and test identities. | Regular product/facilities decisions and targeted identity, operations, security and pilot-user sessions. |
| **W16–W23 — integrations and operations** | Confirm production check-in, notification channel, retention and reporting; test admin exceptions, Graph integration, monitoring and support processes. | Integration owners and operational users available as their components reach acceptance. |
| **W21–W26 — hardening, release and handover** | Agree load and recovery targets; participate in security, accessibility, recovery and user acceptance; approve deployment and accept support ownership. | Operations, security, product and release approver reserved for the final gates. |

Participation is most concentrated around **the W10 PoC decision**, **W16–W18** when production workstreams overlap, and **W21–W23** when integration and hardening overlap. Plan for approximately **1–2 client full-time equivalents in aggregate during the busiest weeks**, distributed among the relevant specialists; most individual roles remain part-time. The product owner should be reachable for decisions throughout the project.

## 4. Planning assumptions and changes to effort

- The Camp PoC uses synthetic or representative data, simulated identity and check-in sources, and mocked notifications. It does not require access to production employee data, Entra ID, Graph or physical systems.
- Client owners respond by the relevant milestone gates. Open production choices are tracked rather than silently treated as approved defaults. The W10 PoC review can rebaseline the remaining schedule and effort.
- Existing corporate tenant, platform and approval paths are available. A new landing zone, procurement process or accreditation effort is outside this client-effort baseline.
- Production initially uses one agreed check-in provider and an agreed Teams/email configuration. Additional physical providers, custom protocols, expanded historical analytics or a more demanding recovery target require re-estimation.
- The client nominates a production release approver. The HLD requires explicit human approval before production deployment, and operational acceptance closes the W26 handover gate.

The effort should be reviewed after **M3.3 PoC acceptance** and again when peak demand, retention, availability/recovery targets and employee lifecycle handling are decided. Those inputs can change the depth of testing, integration and operational preparation.
