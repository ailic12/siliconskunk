# Smart Office — Project Risk Ownership

**Purpose:** Define the human roles accountable for identifying, treating and accepting Smart Office project risks. This is a proposed role assignment, not a claim that the client has named individuals or accepted residual risks.

**Basis:** [Context Discovery](../context/smart-office-context.md) §§4, 9–13 and the [approved High-Level Solution Design](../design/smart-office-hld.md) §§5, 8–12, 16. The [client involvement plan](../bid/client-involvement.md) and [phase plan](smart-office-phases-and-milestones.md) provide the proposed client and delivery roles and review gates.

## 1. Ownership rule

Each risk has **one named human owner** accountable for its treatment, evidence, escalation and residual-risk decision. The roles below may be held by the same qualified person, but a person must be named for each role before the relevant work begins. Engineers and agents may implement controls; they do not accept risk on behalf of the client. The risk owner can recommend acceptance, but any decision outside their authority goes to the business sponsor or the relevant client control owner. Production deployment also requires the separate, explicit human release approval required by C-06 and HLD AD-11.

The delivery lead maintains the risk register. Each entry should record an ID, cause and consequence, likelihood and impact, owner and supporting roles, treatment, evidence, residual exposure, decision and due gate. Owners review risks at each phase gate and whenever an incident, failed test, design change or client decision changes exposure. An architectural mitigation described in the HLD is a proposed control until its implementation and verification have evidence.

## 2. Required risk-owner roles and responsibilities

| Human role | Accountable risk responsibility |
|---|---|
| **Client business sponsor / product owner** | Own business outcomes, scope, priority and acceptance risk. Decide operational policy trade-offs with workplace leadership, set success criteria, accept business-facing residual effects such as the rare duplicate notification, and decide whether PoC evidence supports continuing to production. Escalate cost, schedule or scope changes to the client governance authority. |
| **Client workplace / facilities lead** | Own resource and occupancy policy risk: inventory accuracy, eligibility, booking and release rules, check-in method, false-release and manual-correction procedures, administrator scope and operational reporting. Arrange administrator and employee validation; approve local policy values before enablement. |
| **Delivery lead / project manager** | Own delivery and coordination risk: maintain the register and decision log, assign names and due dates, track dependencies and review capacity, report trend and residual exposure at gates, escalate overdue client inputs, and rebaseline scope, effort or schedule after material PoC findings. Ensure human reviews and release approval are planned and evidenced. |
| **Solution architect / technical lead** | Own end-to-end design and technical integration risk: booking consistency, event and retry semantics, provider-neutral boundaries, multi-office behavior, scaling assumptions and architecture changes. Specify controls and acceptance evidence, review cross-component changes, and escalate any design that cannot meet the agreed risk tolerance. |
| **Engineering lead** | Own implementation quality for booking, check-in, release, notification and audit paths. Make database constraints and state changes safe under concurrency and retries, maintain code review and automated tests, and provide failure-case evidence. Coordinate with the architect and QA lead on defects and residual limitations. |
| **QA / test lead** | Own the risk that defects remain undetected. Define and run evidence-based tests for races, duplicate/late events, retries, timezone changes, authorization, accessibility, load and recovery as applicable; record failed or unrun checks and block acceptance where required evidence is missing. |
| **Client corporate IT / platform operations owner** | Own production service risk: environments, deployment, observability, alert response, backup, restore, rollback, incident support and agreed availability/RTO/RPO. Verify operational readiness and accept the support handover. The delivery platform engineer implements the corresponding controls and exercises. |
| **Client identity and Microsoft 365 owner** | Own tenant and communication dependency risk: Entra ID configuration, role and office mapping, joiner/mover/leaver process, Graph access and sending constraints. Coordinate with workplace and security owners on access scope and with the delivery team on integration tests. If a physical evidence source is selected, name its system owner as a supporting integration owner. |
| **Client security and privacy owner** | Own access, sensitive-data and AI-use risk: authorize tools and least-privilege access, set data handling and retention requirements with legal/records specialists, review authorization and vulnerability evidence, and decide security/privacy residual exposure within delegated authority. Critical unresolved security findings block release under NFR-13. |
| **Named production release approver** | Own the final deployment decision. Review passed CI/security checks, business acceptance, open risks, rollback and support readiness; explicitly approve or reject each production release. This role can be delegated to an empowered business or IT owner, but the approver must be named and the decision recorded. |

## 3. Owner for each identified context risk

The **primary owner** is accountable for closure or a recorded residual-risk decision. Supporting roles provide controls or evidence. IDs and descriptions follow Context §12; the HLD's design responses are in §16.

| Risk | Primary owner | Supporting roles | Required treatment and evidence |
|---|---|---|---|
| **R-01 Concurrent booking** | Engineering lead | Architect; QA lead | Enforce resource/date and employee/date/type uniqueness in the database; prove concurrent requests yield one active booking and an actionable conflict response. |
| **R-02 Incorrect automatic release** | Workplace / facilities lead | Engineering lead; QA lead; platform operations | Approve evidence and deadline policy and false-release response; verify check-in matching, conditional release, unmatched-event review and administrator correction. |
| **R-03 Duplicate check-in events** | Engineering lead | Integration owner; QA lead | Enforce a source/event idempotency key; replay the same event and show one state effect. |
| **R-04 Delayed and out-of-order events** | Engineering lead | Workplace / facilities lead; QA lead | Re-evaluate current booking state when evidence is applied; retain late evidence as unmatched and test that release is not silently reversed. |
| **R-05 Retry safety** | Engineering lead | Platform operations; QA lead; product owner | Prove repeated release sweeps create one state change and one notification intent; test outbox retry and record the external duplicate-send residual under N-06. |
| **R-06 Multi-office timezones** | Solution architect / technical lead | Engineering lead; QA lead; workplace / facilities lead | Use office IANA time zones and office-local booking dates; test release deadlines across offices and daylight-saving changes. |
| **R-07 Authorisation** | Security and privacy owner | Identity owner; engineering lead; QA lead | Verify server-side employee ownership and office-scoped admin checks, including negative cross-employee and cross-office tests and role-change behavior. |
| **R-08 Privileged administrative actions** | Workplace / facilities lead | Security owner; engineering lead; QA lead | Define override authority and operating procedure; verify mandatory reason and audit record in the same transaction as each correction. |
| **R-09 Integration coupling** | Solution architect / technical lead | Integration owner; engineering lead | Keep providers behind the documented ingress contract; demonstrate a second adapter without changing the booking domain. |
| **R-10 Privacy** | Security and privacy owner | Product owner; platform operations; legal/records specialist | Set collection and retention rules for booking, evidence, audit, notification and logs; verify minimization and deletion/anonymization against approved durations. Q-07 remains open. |
| **R-11 Agent access** | Security and privacy owner | Delivery lead; platform engineer | Approve AI tools and task-scoped permissions; keep secrets and unnecessary personal data out of prompts/logs; record significant agent actions and access reviews. |
| **R-12 Generated change quality** | Delivery lead / project manager | Engineering lead; architect; QA lead; security owner | Require human review, automated business-rule tests, dependency/vulnerability scanning and retained gate evidence for agent-authored changes; escalate findings before release. |

## 4. Open decisions and additional residual risks

| Item | Decision / risk owner | Decision needed before |
|---|---|---|
| **Q-01 Peak demand and capacity** | Product owner, with platform operations and architect | Load targets and production sizing at M6.1. |
| **Q-02–Q-05 and N-05 Workplace policy** | Workplace / facilities lead, with product owner | Related Phase 4–5 behavior is enabled: parking eligibility, resource filters, initial check-in method, release/rebooking and post-check-in cancellation. |
| **Q-06 Notification channel** | Product owner, with identity/Microsoft 365 owner | M5.2 notification integration and acceptance. |
| **Q-10 Administrator scope** | Workplace / facilities lead, with security and identity owners | M4.2 policy administration and M5.3 audit acceptance. |
| **Q-12 Reporting scope** | Product owner, with workplace / facilities lead | M5.3 reporting acceptance. |
| **Q-07 Retention** | Security and privacy owner, with legal/records input | M5.4 privacy acceptance. |
| **Q-08–Q-09 Availability and recovery targets** | Platform operations owner, with business sponsor | M6.2 recovery and service acceptance. |
| **Q-11 / N-02 Employee lifecycle** | Identity owner, with security owner and architect | M4.1 production identity acceptance. |
| **N-01 Azure provider ratification** | Platform operations owner, with business sponsor, security and procurement | Production platform commitment. The HLD proposes Azure; the client has not mandated it. |
| **N-06 Possible duplicate external notification** | Product owner | M5.2 notification acceptance. Acknowledge the HLD's at-least-once delivery trade-off or request a revised requirement and design. |
| **Schedule, review capacity and delayed dependencies** | Delivery lead / project manager | Each phase gate; rebaseline after M3.3 if the PoC changes the architecture or effort. |

The role assignments should be converted to named people during mobilisation (M0.3), with substitutes and escalation contacts for absences. PoC acceptance at M3.3, production control evidence at M6.1–M6.2, and the human approval at M6.3 are distinct decisions; none substitutes for another.
