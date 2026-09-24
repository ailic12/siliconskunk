# Smart Office — Camp PoC Selection

Status: **APPROVED — HUMAN REVIEW COMPLETE (Revision 1)**
Input basis: [`context/smart-office-context.md`](../context/smart-office-context.md) (approved Context Discovery) and [`design/smart-office-hld.md`](../design/smart-office-hld.md) (approved HLD, Revision 3).
Scope: this document selects **2–3 functionalities** for the Camp PoC per **C-01**. It does not change the HLD, does not create implementation tasks, and does not write code.

### Revision history

**Revision 1** — response to human review of the initial selection. The selection direction (Booking Creation / Automatic Release / Notification Dispatch) and the underlying candidate analysis and comparison (§§2–3) are unchanged. Three corrections were applied: (1) the three selected functionalities in §4 are renamed and narrowed to single core capabilities, with conflict prevention, idempotency, availability refresh, and adapter extensibility reframed as **validation criteria** proven through that capability rather than bundled-in features; (2) §5 corrected an erroneous citation of C-06 to the correct **C-01** PoC-scope constraint; (3) resolved the FR-19 vendor-neutrality inconsistency by adding a minimal second simulated check-in adapter to Functionality 2, so adapter extensibility is evidenced rather than merely asserted.

Tags used below follow the HLD convention: **[REQ]** traced requirement, **[DECISION]** a choice made in this document, **[OPEN]** an unresolved question carried forward or newly surfaced, **[ASSUMPTION — new]** a PoC-scoped assumption not present in either approved document.

---

## 1. Selection Method

Per the task brief, every serious candidate is scored against seven criteria — business value, architectural risk, requirement relevance, demonstrability, feasibility, evidence generated, cohesion — before narrowing to a final set. Functionality is **not** selected for ease of implementation; the HLD's own closing assessment (§17) already names the two highest-risk correctness/reliability guarantees in the design, and this document treats that as the starting hypothesis to test, not the answer to copy — a third candidate (notifications) and four others were evaluated independently below.

---

## 2. Candidates Considered

### C1 — Availability Search + Booking Creation with Conflict Prevention

| Field | Assessment |
|---|---|
| Requirement ID(s) | FR-01, FR-02 (partial), FR-03, FR-05, FR-06 (booking window), BR-01, BR-02, BR-03, BR-04 |
| Business problem addressed | P-01 Uneven Resource Demand, P-03 Resource Availability Visibility, P-04 Booking Reliability |
| Business outcome demonstrated | Outcome 1 (easily find/reserve), Outcome 2 (reliable prevention of conflicting bookings) |
| Architectural decision(s) validated | AD-02 — DB unique constraints (resource-level **and** employee-level) as the sole conflict-prevention mechanism, no distributed lock |
| Technical risk(s) validated | R-01 Concurrent Booking; the BR-02 employee-level race is a distinct, harder case than plain resource-level locking |
| Learned if it succeeds | The partial-unique-index approach gives a real atomic guarantee under genuine concurrent load, not just in theory — confirms the "modular monolith + single RDBMS, no distributed lock" bet (AD-01/AD-02) is sound at this stage, which is the single decision the whole architecture's simplicity rests on |
| Learned if it fails | Either the constraint design has a gap (e.g. an isolation-level or ORM behaviour that allows a race through), or the "database gives conflict prevention for free" claim needs a fallback mechanism — this would be the single most consequential finding for the proposal, since AD-01 (reject microservices) leans on it |
| Relative implementation complexity | Medium — CRUD plus one deliberately adversarial concurrency test harness |
| Dependencies | A minimal seeded Employee/Resource identity (no real Entra ID required — A-06/C-04 permit simulation) |
| Demo value | High — two simultaneous booking attempts on stage, one wins, one gets a clean 409; easy for a non-technical judge to follow |

### C2 — Check-in Evidence Ingestion + Idempotent Automatic Release

| Field | Assessment |
|---|---|
| Requirement ID(s) | FR-08, FR-09, FR-10, FR-19, BR-05, BR-06, BR-07, BR-08 |
| Business problem addressed | P-02 Unused Reservations, P-01 (indirectly, by returning capacity to the pool) |
| Business outcome demonstrated | Outcome 3 (utilisation via check-in/auto-release), Outcome 4 (reduced no-show impact) |
| Architectural decision(s) validated | AD-05 (managed queue decoupling), AD-07 (canonical `CheckInEvent` + adapter), AD-10 (idempotent polling sweep) |
| Technical risk(s) validated | R-02 Incorrect Auto-release, R-03 Duplicate Events, R-04 Delayed/Out-of-order Events, R-05 Retry Safety, R-09 Integration Coupling |
| Learned if it succeeds | Confirms three separate hard claims at once: (a) a unique `(source_system, external_event_id)` constraint really absorbs replayed events, (b) a conditional `UPDATE … WHERE status='Reserved'` sweep really is a no-op on re-run, and (c) a late check-in after release is surfaced as `Unmatched` rather than silently reviving a released booking (BR-08) — this is the FR-19 vendor-neutrality promise proven with a second simulated adapter, not just asserted |
| Learned if it fails | Would reveal that the queue/worker introduces an ordering bug, that External Mapping resolution is fragile, or that "simple polling sweep" latency/semantics don't hold — directly informs whether production needs a more sophisticated (and more expensive) event mechanism |
| Relative implementation complexity | Medium–High — needs a simulated check-in provider, a queue, a worker, a scheduled sweep, and constructed duplicate/out-of-order test scenarios |
| Dependencies | C1 (needs a `Reserved` booking to act on) |
| Demo value | High — "send the same event twice, nothing duplicates," "let the clock pass, the desk reappears in search," "send a late check-in after release, it's flagged for admin, not silently applied" are all dramatic, legible demonstrations of the two riskiest reliability guarantees in the HLD |

### C3 — Notification Dispatch (Transactional Outbox, At-least-once, Dedup)

| Field | Assessment |
|---|---|
| Requirement ID(s) | FR-18 |
| Business problem addressed | Supports P-03 (status visibility) and Outcome 8 (integration with corporate comms) |
| Architectural decision(s) validated | AD-04 — outbox + claim/lease pattern, with an explicitly **honest, not exactly-once** delivery guarantee |
| Technical risk(s) validated | R-05 Retry Safety, specifically for the notification path (distinct mechanism from C2's release-sweep retry safety) |
| Learned if it succeeds | Confirms the outbox reliably produces exactly one notification *intent* per lifecycle event even under a simulated worker crash/retry, and that a slow/failing mocked Graph call never blocks or fails a booking transaction (the decoupling in §5.5/§9 actually holds, not just on a diagram) |
| Learned if it fails | If duplicates occur outside the one documented narrow window, or if the mocked notification failure leaks into booking/release correctness, that is a real gap in FR-18 ("duplicate notifications must be avoided") worth flagging before the bid commits to that claim |
| Relative implementation complexity | Medium — outbox table, worker, a mocked Graph client, and one deliberately engineered crash-simulation test |
| Dependencies | C1 (booking confirmation event) and C2 (release-notice event) as event sources — this candidate is the connective tissue across the other two, not a standalone flow |
| Demo value | Medium–High — less dramatic alone, but strong as "watch a confirmation arrive the moment you book, and a release notice arrive the moment the sweep fires," plus a live crash-simulated dedup check |

### C4 — View & Cancel Bookings

| Field | Assessment |
|---|---|
| Requirement ID(s) | FR-04 |
| Business problem addressed | P-03 (partial), general usability |
| Architectural decision(s) validated | None new — reuses C1's write path; the HLD's optimistic-concurrency note for update/cancel (§5.2) is a minor secondary mechanism, not a distinct risk |
| Technical risk(s) validated | None material |
| Learned if it succeeds/fails | Mostly confirms ordinary CRUD works; low new information either way |
| Relative implementation complexity | Low |
| Dependencies | C1 |
| Demo value | Necessary as a supporting screen (you need to *see* a booking to check in against it or watch it get released) but weak as a standalone selection — it is scaffolding for C1/C2, not a hypothesis worth spending one of 2–3 slots on |

### C5 — Admin Resource/Policy Administration + Manual Override + Audit

| Field | Assessment |
|---|---|
| Requirement ID(s) | FR-11, FR-12, FR-13, FR-14, FR-15, BR-09 |
| Business problem addressed | P-05 Operational Management, P-06 Limited Operational Insight |
| Business outcome demonstrated | Outcomes 5, 6, 7 |
| Architectural decision(s) validated | Audit Module's append-only pattern; the "override always co-writes an audited reason in the same transaction, no back door" pattern (§8, R-08/BR-09) |
| Technical risk(s) validated | R-08 Privileged Administrative Actions |
| Learned if it succeeds/fails | Confirms (or disproves) that audit-coupling can be enforced cleanly across every override path — a real but comparatively low-risk plumbing pattern, not one of the guarantees the HLD's own §17 flags as highest-risk |
| Relative implementation complexity | Medium — needs a UI plus several override flows and an audit query view |
| Dependencies | C1, C2 (needs bookings/check-ins worth overriding) |
| Demo value | Medium — good for an enterprise-trust/governance narrative, but it is straightforward transactional-write plumbing rather than a contested architectural bet, so it adds less *new* evidence than C1–C3 |

### C6 — Multi-office / Timezone-aware Policy Handling

| Field | Assessment |
|---|---|
| Requirement ID(s) | FR-16, A-04, A-05 |
| Business problem addressed | P-07 Future Growth |
| Architectural decision(s) validated | AD-03 (row-level `office_id` partitioning), AD-09 (IANA timezone, on-demand deadline computation) |
| Technical risk(s) validated | R-06 Multi-office Timezones |
| Learned if it succeeds/fails | Confirms (or breaks) that per-office policy scoping and DST-safe deadline math work across ≥2 simulated offices without code branching |
| Relative implementation complexity | Low-to-medium, **if** folded into C1/C2 as a seed-data variation (two offices, two timezones, two policy sets) rather than built as a separate flow |
| Dependencies | C1, C2 |
| Demo value | Medium as a standalone slot; equally strong, at near-zero extra cost, as a variation *within* C1/C2 (seed two offices instead of one) |

**Verdict on C6:** fold into C1/C2's seed data rather than consuming a separate slot — this preserves the P-07/FR-16/R-06 evidence without spending one of the scarce 2–3 selections on it.

### C7 — Corporate Sign-in (Entra ID) + Authorization Boundaries

| Field | Assessment |
|---|---|
| Requirement ID(s) | FR-17 |
| Business problem addressed | Enabling condition for P-03/P-04; NFR-01 |
| Architectural decision(s) validated | AD-08 (JIT employee projection), server-side authorization on every endpoint |
| Technical risk(s) validated | R-07 Authorisation |
| Learned if it succeeds/fails | Confirms JIT provisioning and server-side role/office-scope checks behave as designed |
| Relative implementation complexity | Medium if wired to a real Entra ID tenant; low if simulated (permitted by A-06/C-04) |
| Dependencies | None — foundational |
| Demo value | Low standalone (a login screen is not compelling on its own) but required as enabling infrastructure under C1–C3 |

**Verdict on C7:** not selected as one of the 2–3 functionalities. A lightweight simulated/seeded identity layer (per C-04) is required *underneath* C1–C3 to show employee- vs. admin-scoped access, but real OIDC integration is well-understood and low-risk — it does not compete for a scarce PoC slot against genuinely contested architectural bets.

---

## 3. Comparison Summary

| Candidate | Business value | Architectural risk | Requirement relevance | Demonstrability | Feasibility | Evidence generated | Cohesion with others |
|---|---|---|---|---|---|---|---|
| C1 Booking + conflict prevention | High | High | High | High | High | High | Anchor of the story |
| C2 Check-in + auto-release | High | High | High | High | Medium | High | Directly extends C1 |
| C3 Notification outbox | Medium | Medium-High | Medium | Medium | High | Medium-High | Glue across C1/C2 |
| C4 View/cancel | Medium | Low | Medium | Medium | High | Low | Supporting only |
| C5 Admin + audit | Medium | Medium | Medium | Medium | Medium | Medium | Adjacent, not required |
| C6 Multi-office/timezone | Medium | Medium | Medium | Medium | High (if folded in) | Medium | Best as variation, not a slot |
| C7 Corporate sign-in | Low (standalone) | Medium | Medium | Low | Medium | Low (well-understood) | Enabling layer, not a slot |

C1 and C2 are the two guarantees the HLD's own §17 assessment already identifies as the riskiest in the whole design (booking conflict prevention at both resource and employee level; idempotent check-in/release under duplication and reordering). Independently reassessing them here against all seven criteria confirms that judgment rather than just inheriting it: both score high on every axis, both trace to multiple problems/outcomes, and both are the load-bearing claims the AD-01 "modular monolith, no microservices" bet depends on — if either breaks under real testing, that is the single most important thing to know before the proposal commits to this architecture.

C3 is the strongest third candidate: unlike C4 (view/cancel — low risk, low new evidence) and C5 (admin/audit — real but secondary plumbing), C3 validates a distinct, separately-reviewed architectural decision (AD-04's honest at-least-once model, which took two human-review rounds in the HLD to state correctly) and it naturally completes the same story C1/C2 already tell, rather than opening a new one.

---

## 4. Final Selection

### Selected Functionality 1 — Booking Creation

- **Core requirement:** FR-03 (Create Booking) — an employee reserves a single desk or parking space for a specific working day. This is the one capability being selected; it is named narrowly on purpose.
- **Minimal supporting requirement (scaffolding, not itself a selected capability):** FR-01 (Availability Search) is built only to the depth needed to pick a resource to book — a plain list of free resources for a chosen date, with no independent scoring or success criteria of its own.
- **Validation criteria proven through this functionality (not bundled-in features):**
  - Resource-level conflict prevention (FR-05, R-01) — two concurrent attempts to book the same resource/date resolve to exactly one success.
  - Employee-level daily-limit enforcement under concurrency (BR-02) — two concurrent attempts by the same employee for two different resources of the same type/date resolve to exactly one success.
  - Booking-day and window rules (BR-01, BR-03, BR-04) enforced server-side, not just in the UI.
- **Why selected:** Highest-scoring candidate on every criterion; conflict prevention is the correctness guarantee the rest of the architecture's simplicity (AD-01 — modular monolith over microservices) is staked on.
- **Business hypothesis being validated:** Employees can reliably reserve a desk/parking space, and the system prevents the double-booking failure mode that erodes trust in the tool (P-03, P-04).
- **Technical / architectural hypothesis being validated:** A single relational database with partial unique indexes — one on `(resource_id, booking_date)`, one on `(employee_id, booking_date, resource_type)` — gives an absolute, atomic conflict-prevention guarantee under real concurrent load, without a distributed lock (AD-02).
- **Expected evidence:** An automated concurrency test firing simultaneous conflicting requests (same resource; same employee, different resources) against a real database instance, showing exactly one success and one clean rejection in each case, every run.
- **Success criteria:** Zero double-bookings across N repeated concurrent-race runs (both resource-level and employee-level); rejected requests receive an actionable error, not a silent failure or a crash.
- **Explicitly out of scope:** Resource-characteristic filtering beyond a plain available/unavailable list (Q-03 open; FR-02 not separately validated); booking-window edge cases beyond the default 14-day window; UI polish beyond what's needed to demonstrate the flow.

### Selected Functionality 2 — Automatic Release of Unconfirmed Bookings

- **Core requirement:** FR-09 (Automatic Release) — a reservation without accepted check-in evidence by the configured deadline is released automatically. This is the one capability being selected.
- **Minimal supporting requirement (scaffolding, not itself a selected capability):** FR-08 (Check-in Evidence) is implemented only as the input signal the release decision depends on, via one simulated evidence path — it has no independent success criteria beyond feeding the release decision correctly.
- **Validation criteria proven through this functionality (not bundled-in features):**
  - Idempotent, order-tolerant processing (R-02, R-03, R-04, R-05; BR-05, BR-06, BR-07, BR-08) — duplicate check-in events produce one applied effect; the release sweep run twice never double-releases; a check-in arriving after release is recorded as `Unmatched`, never silently restoring the booking.
  - Availability refresh (FR-10) — a released resource reappears in Functionality 1's availability search with no manual step.
  - Adapter extensibility (FR-19, R-09) — evidenced, not asserted, by introducing a second minimal simulated adapter (see below) that a new check-in source can be added without changing the Booking domain.
- **Why selected:** Second-highest-scoring candidate; validates the other guarantee the HLD's own assessment flags as highest-risk, and is the mechanism that actually delivers the client's stated utilisation problem (P-02).
- **Business hypothesis being validated:** Automatic release of unconfirmed reservations measurably returns unused capacity to the pool, directly addressing "unused reservations" (P-02) and "reduced no-show impact" (Outcome 4).
- **Technical / architectural hypothesis being validated:** (a) A `(source_system, external_event_id)` uniqueness constraint safely absorbs duplicate/replayed check-in events; (b) a conditional `UPDATE … WHERE status='Reserved'` sweep is genuinely idempotent under overlapping/retried triggers; (c) the public Ingress API + canonical `CheckInEvent` boundary lets a second simulated provider be added without touching the booking domain (AD-05, AD-07, AD-10).
- **Second adapter requirement (resolves the FR-19 validation gap):** Claiming adapter extensibility as PoC evidence requires evidence, not a single-adapter assertion. The PoC therefore builds **two** simulated check-in adapters against the same canonical `CheckInEvent` contract: (1) the primary app/QR adapter used for the main demo flow, and (2) a minimal second test adapter (e.g. a bare admin-confirmation or test-harness webhook, not a real vendor integration) added solely to demonstrate that onboarding a new source is a new Ingress route + adapter with zero changes to the Check-in Gateway, Booking Module, or domain model. The second adapter carries no independent business value and is not a demo centrepiece — it exists only as evidence for the adapter-extensibility validation criterion above.
- **Expected evidence:** Test runs showing (1) the same check-in event delivered twice produces one applied effect, (2) the release sweep run twice back-to-back never double-releases, (3) a check-in arriving after release is recorded as `Unmatched` rather than silently restoring the booking (BR-08), (4) a released resource reappears in the availability search from Functionality 1, (5) the second minimal adapter is wired in and passes the same idempotency/matching behaviour with no change to Booking-domain code.
- **Success criteria:** No duplicate state changes under redelivery or overlapping sweeps; no silently-revived bookings; released resources become bookable again with no manual intervention; the second adapter integrates as additive Ingress-layer code only, with no modification to the Booking Module, Check-in Gateway internals, or domain model.
- **Explicitly out of scope:** Real hardware/access-card/sensor integrations (A-06) — both simulated adapters remain software-only test harnesses, not real vendor integrations; production-grade dead-letter/alerting tooling.

### Selected Functionality 3 — Notification Dispatch via Transactional Outbox

- **Core requirement:** FR-18
- **Why selected:** Strongest remaining candidate for architectural evidence (validates AD-04's specifically-debated at-least-once model) and the only one of the remaining candidates that completes the same end-to-end story as Functionalities 1 and 2 rather than opening an unrelated one.
- **Business hypothesis being validated:** Employees reliably receive booking confirmations and release notices without duplicate spam, supporting trust in the system's status communication (Outcome 6, Outcome 8).
- **Technical / architectural hypothesis being validated:** A transactional outbox with a claim/lease pattern gives at-least-once delivery with a narrow, non-corrupting duplicate window — and, critically, that a failing/slow notification channel never blocks or fails the booking or release transaction that triggered it (AD-04, §5.5/§9 decoupling claim).
- **Expected evidence:** A test that simulates a worker crash between a successful (mocked) send and the local status commit, showing the resulting duplicate is confined to that one documented window and never corrupts booking/release state; a test showing a failing mocked notification channel does not affect booking or release outcomes.
- **Success criteria:** Exactly one notification intent per lifecycle event under normal operation; the only reproducible duplicate is the one documented crash window; booking and release correctness is unaffected by notification-channel failure.
- **Explicitly out of scope:** Real Microsoft Graph/Teams/Email integration (simulated per C-04); notification preference/channel-selection UI (Q-06 open); localization/templating of message content.

---

## 5. The Coherent Demo Story

The three functionalities compose into one narrative rather than three disconnected features:

**Discover → Reserve → Confirm → (Use or Don't) → Reclaim → Re-offer**

1. An employee searches availability and books a desk; a concurrent attempt on the same desk (or a second desk by the same employee, same day) is cleanly rejected (Functionality 1).
2. A booking confirmation notification fires immediately, decoupled from the booking transaction (Functionality 3).
3. The employee does not check in. At the configured deadline, the release sweep fires, the booking is released, and a release notice is sent (Functionality 2 + 3).
4. The now-released desk reappears in the availability search from step 1 — closing the loop and directly demonstrating the client's stated utilisation problem (P-02) being solved end-to-end.
5. A duplicate check-in event and a late check-in arriving after release are shown being handled safely (no duplicate effect; no silent revival) — proving the reliability claims live under adversarial conditions, not just the happy path.
6. As evidence only, not a demo centrepiece: a second, minimal simulated check-in adapter is wired in to show that onboarding a new provider requires no change to the Booking Module or domain model — the concrete evidence for the FR-19 adapter-extensibility validation criterion in Functionality 2.

Per **C-01** (PoC Scope: the Camp PoC implements only 2–3 selected functionalities), this deliberately excludes the full solution: no admin console, no multi-office UI, no real Entra ID/Graph/hardware integration. Also per **C-01**, the fold-in-timezone (C6) and admin/audit (C5) candidates were considered and set aside as documented above, not omitted by oversight.

---

## 6. Items Recorded, Not Invented

| ID | Item | Status |
|---|---|---|
| PoC-Q-01 | Which check-in adapter(s) should the PoC simulate? | **[ASSUMPTION — new, PoC-scoped]** Two simulated adapters: (1) app/QR-code as the primary flow, since the HLD (§7.1) names it the lowest-friction, fully software-based option and states the architecture is indifferent to which ships first; (2) a minimal second test adapter added solely to evidence the FR-19 adapter-extensibility validation criterion in Functionality 2 (§4). Needs confirmation before implementation planning, not before this selection. |
| PoC-Q-02 | Should Entra ID / Microsoft Graph be a real sandbox integration or fully mocked for the Camp? | **[OPEN]** Both C-04 (simulated integrations permitted) and A-06 support mocking; this document assumes mocked for both, to keep PoC effort on the three selected functionalities rather than on tenant/app-registration setup. Recommend explicit confirmation from whoever owns Camp environment access. |
| PoC-Q-03 | Multi-office/timezone variation (C6) | **[DECISION — this document]** Fold into Functionality 1/2 as a seed-data variation (two offices, two timezones) if time permits, rather than a fourth selected functionality. Not required for the core selection to succeed. |
| PoC-Q-04 | Should FR-19 (vendor-neutral extensibility) be claimed as PoC evidence at all? | **[DECISION — this document, per human review]** Yes — resolved by adding the minimal second simulated adapter above rather than weakening the claim, since the incremental cost is low (one additional Ingress route against the existing canonical `CheckInEvent` contract) and the evidentiary value for the bid is high. |
| Carried forward | Q-01 (peak demand), Q-04 (production check-in method), Q-06 (notification channel), Q-07/Q-08/Q-09 (retention/availability/recovery targets) | Unchanged from the HLD (§16) — none block this selection; they remain open inputs for the full proposal, not for the PoC. |

---

## 7. Human Review Gate

Before this selection is treated as approved, a human reviewer should confirm:

- Do the selected three functionalities actually match what the Camp team can build and demo in the available time?
- Is the exclusion of authentication (C7), admin/audit (C5), and multi-office UI (C6) as standalone slots acceptable, given they are set aside rather than solved?
- Are the PoC-scoped assumptions in §6 (two simulated check-in adapters, mocked Entra ID/Graph) acceptable for the Camp, or does the environment require a real sandbox integration?
- Does the demo story in §5 give the client/judges a clear, honest picture of what was proven versus what remains architecture-on-paper?

---

## 8. Outcome

**Status: APPROVED — HUMAN REVIEW COMPLETE (Revision 1)**

No implementation tasks have been created and no code has been written. This document stops here, per the task boundary.
