# Smart Office — High-Level Solution Design (Stage 2)

Status: **DRAFT — FOR HUMAN REVIEW**
Scope: The **complete target solution**, not the hackathon PoC. PoC selection is an explicit later stage and is out of scope here.

---

## 0. Document Scope & Input Basis

The only authoritative input available in this repository is [`context/smart-office-context.md`](../context/smart-office-context.md) — the approved Context Discovery document (Stage 1). No separate "original specification" file exists in the repository; the Context Discovery document itself states it is derived from the original specification and is marked **"Sufficient for High-Level Solution Design: YES"** with **no blocking questions**. This HLD treats that document as the single source of truth for requirements and traces every design decision back to it.

Throughout this document, statements are tagged so requirements are never confused with design choices:

| Tag | Meaning |
|---|---|
| **[REQ]** | Explicit requirement from the Context Discovery document (FR/BR/NFR/C/business need) |
| **[ASSUMPTION — client]** | An assumption already recorded in the Context Discovery document (A-01..A-07) |
| **[ASSUMPTION — new]** | A new assumption introduced in this HLD because the context doc is silent; flagged for confirmation |
| **[DECISION]** | An architectural decision made in this document |
| **[OPEN]** | An unresolved question — not invented, not silently defaulted |

No client requirement is invented in this document. Where the context doc left a question open (Section 13 of the context doc), this HLD either (a) designs the architecture to remain neutral to the eventual answer, or (b) proposes a default explicitly marked as provisional and pending confirmation.

---

## 1. Architecture Goals

1. Satisfy all 19 functional requirements, 9 business rules and 14 non-functional requirements in the Context Discovery document for the **full solution**, while allowing a 2–3 feature PoC to be carved out later without contradicting this design. **[REQ]**
2. Guarantee correctness of the two highest-risk mechanics: booking conflict prevention (R-01) and idempotent, order-tolerant check-in/release processing (R-02, R-03, R-04, R-05). **[REQ]**
3. Support growth from one Serbian office (~200 employees, 150 desks, 30 parking spaces) to multiple offices, local policies, local time zones, and at least 5,000 users — **without a platform redesign**. **[REQ — FR-16, NFR-04, P-07]**
4. Keep the architecture as simple as the requirements allow. Distributed-systems complexity (microservices, event streaming, multi-region active-active, NoSQL) is only introduced if a specific requirement demands it. **[DECISION — see §13]**
5. Enforce security, privacy, auditability, and human accountability for production changes as first-class architecture concerns, not afterthoughts, given the Agentic SDLC delivery model. **[REQ — NFR-01/02/12/13, C-05/06/07]**
6. Keep every business rule (BR-01..BR-09) as a server-side, testable invariant rather than UI-enforced behaviour.

---

## 2. Proposed Solution Overview

**[DECISION]** Smart Office is built as a **modular monolith**: a single deployable API application internally decomposed into clearly bounded modules (Booking, Resource & Policy, Check-in Gateway, Release Engine, Notification, Audit, Office/Tenant, Admin & Reporting), backed by **one relational database** as the single source of truth, plus a lightweight background worker and a managed queue for asynchronous, retryable work (check-in ingestion, notification dispatch, scheduled release sweeps).

**Why this shape, not microservices:** at the stated scale (≤5,000 users, tens of offices, hundreds of resources per office, one booking per employee per resource per day) the transaction volume is modest — low thousands of state-changing operations per day even at full scale. A single well-indexed relational database comfortably serves this load and gives conflict prevention "for free" via ACID transactions and unique constraints, which is materially harder to get right in a distributed/microservices design (would require distributed locks or a saga pattern). Splitting into services now would add operational cost (multiple deployables, service discovery, distributed tracing, network failure modes) without a requirement that needs it. The module boundaries below are deliberately drawn so that any module could be extracted into its own service later **if** growth ever demands it — this satisfies "future growth without redesign" (P-07) without paying the distributed-systems tax today.

```mermaid
graph TB
    Employee(("Employee"))
    Admin(("Workplace Administrator"))
    FM(("Facilities Management"))
    SO["Smart Office Platform"]
    Entra["Microsoft Entra ID"]
    M365["Microsoft 365 / Teams / Email"]
    CheckInProviders["Check-in Evidence Providers\nApp / QR / Access Cards / Sensors"]

    Employee -->|"book, check-in, view, cancel"| SO
    Admin -->|"administer, override, audit"| SO
    FM -->|"view operational reports"| SO
    SO -->|"OIDC authentication"| Entra
    SO -->|"send notifications"| M365
    CheckInProviders -->|"check-in events (vendor-neutral)"| SO
```

**[DECISION — target cloud]** Microsoft Azure is proposed as the target cloud, because Entra ID and Microsoft Graph (Teams/Email) are **required** integrations **[REQ — FR-17, FR-18]** and Azure gives first-party, low-friction integration with both (native OIDC trust, Graph SDKs, managed identity instead of stored secrets). The Context Discovery document explicitly leaves cloud provider unspecified (A-07) and delegates the choice to solution design — this is that choice, not an invented requirement. **Alternatives and trade-offs are recorded in §12 (AD-06).** This decision should be explicitly confirmed by a human reviewer/client stakeholder before implementation, since it has cost and vendor implications beyond pure architecture.

---

## 3. Component Architecture

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Web["Employee & Admin Web App\n(responsive SPA)"]
    end

    subgraph API["Smart Office API — modular monolith"]
        AuthMW["Auth Middleware\n(Entra ID token validation)"]
        BookingMod["Booking Module"]
        ResourceMod["Resource & Policy Module"]
        CheckInGW["Check-in Gateway\n(vendor adapters)"]
        ReleaseEngine["Release Engine\n(scheduled worker)"]
        NotifSvc["Notification Service\n(outbox dispatcher)"]
        AuditMod["Audit Module"]
        OfficeMod["Office / Tenant Module"]
        AdminMod["Admin & Reporting Module"]
    end

    DB[("Primary Relational Database")]
    Queue[["Managed Queue\n(check-in ingestion + outbox)"]]
    Entra["Microsoft Entra ID"]
    Graph["Microsoft Graph API\n(Teams / Email)"]
    Providers["External Check-in Providers"]

    Web -->|"HTTPS/JSON, Bearer JWT"| AuthMW
    AuthMW --> BookingMod
    AuthMW --> ResourceMod
    AuthMW --> AdminMod
    AuthMW --> AuditMod
    AuthMW -->|"validates tokens"| Entra

    Providers -->|"check-in events"| Queue --> CheckInGW
    CheckInGW --> BookingMod
    CheckInGW --> AuditMod

    BookingMod --> DB
    ResourceMod --> DB
    OfficeMod --> DB
    AuditMod --> DB
    ReleaseEngine --> DB
    NotifSvc --> DB

    BookingMod -.->|"domain events"| NotifSvc
    ReleaseEngine -.->|"domain events"| NotifSvc
    CheckInGW -.->|"domain events"| NotifSvc
    NotifSvc --> Graph

    BookingMod --> OfficeMod
    ReleaseEngine --> OfficeMod
```

### Component responsibilities and boundaries

| Module | Owns | Does not do |
|---|---|---|
| **Auth Middleware** | Validating Entra ID JWTs, resolving the local Employee/Principal record, attaching role/office scope to the request context | Business rules, data access beyond identity resolution |
| **Booking Module** | Availability search, booking creation/cancellation, conflict prevention, booking-limit enforcement | Notification delivery, check-in transport, policy definition |
| **Resource & Policy Module** | Resource CRUD, resource state (Available/Unavailable/Under Maintenance), policy configuration (booking window, limits, deadlines, accepted evidence) | Booking transactions |
| **Check-in Gateway** | Vendor adapters, canonical `CheckInEvent` translation, idempotent ingestion, matching evidence to a booking | Knowing the internal booking state machine beyond "apply evidence" |
| **Release Engine** | Scheduled evaluation of deadlines, releasing unconfirmed bookings, timezone-aware deadline computation | Notification delivery (only raises the event) |
| **Notification Service** | Outbox-driven, deduplicated dispatch to Teams/Email via Graph API | Deciding *when* a notification is warranted (that's the domain module's job) |
| **Audit Module** | Append-only recording and query of significant actions | Nothing else — deliberately narrow and tamper-resistant |
| **Office / Tenant Module** | Office registry, IANA timezone, per-office scoping | Policy values themselves (owned by Policy) |
| **Admin & Reporting Module** | Operational overview, manual overrides (delegates the actual state change to Booking/Resource modules so every override is still validated and audited) | Bypassing audit or authorization |

**[DECISION]** Each module owns its own tables (naming convention / schema grouping) and other modules access its data only through its internal service interface, never by querying another module's tables directly — a "modular monolith with enforced module boundaries." This is what allows a future extraction to standalone services (if 5,000 users ever becomes 50,000) without redesigning the domain model. **Why:** cheapest way to buy future optionality without paying today's distributed-systems cost. **Trade-off:** requires discipline in code review to prevent boundary erosion — this is a governance cost, not a runtime one.

---

## 4. Core Domain Model

```mermaid
erDiagram
    OFFICE ||--o{ RESOURCE : contains
    OFFICE ||--o{ POLICY : scopes
    OFFICE ||--o{ EMPLOYEE : "home office of"
    RESOURCE ||--o{ BOOKING : "booked as"
    EMPLOYEE ||--o{ BOOKING : makes
    BOOKING ||--o{ CHECKIN_EVIDENCE : "matched by"
    BOOKING ||--o{ NOTIFICATION : triggers
    BOOKING ||--o{ AUDIT_RECORD : "subject of"
    EMPLOYEE ||--o{ AUDIT_RECORD : performs

    OFFICE {
        uuid id PK
        string name
        string iana_timezone
        string country
        bool active
    }
    RESOURCE {
        uuid id PK
        uuid office_id FK
        string type "Desk or ParkingSpace"
        string name
        string status "Available, Unavailable, UnderMaintenance"
        json characteristics
    }
    POLICY {
        uuid id PK
        uuid office_id FK
        string resource_type "nullable = applies to all types"
        int booking_window_days "default 14, BR-03"
        time release_deadline_local "default 10:00, BR-05"
        json accepted_evidence_methods
        int employee_daily_limit "BR-02: 1 desk + 1 parking"
    }
    EMPLOYEE {
        uuid id PK
        string entra_object_id UK
        uuid home_office_id FK
        string display_name
        string email
        string role_scope "Employee, Admin:office-list, Admin:global"
    }
    BOOKING {
        uuid id PK
        uuid resource_id FK
        uuid employee_id FK
        date booking_date
        string status "Reserved, CheckedIn, Released, Cancelled"
        timestamptz created_at
        timestamptz updated_at
    }
    CHECKIN_EVIDENCE {
        uuid id PK
        uuid booking_id FK "nullable if unmatched"
        string source_system
        string external_event_id
        timestamptz occurred_at
        timestamptz received_at
        string outcome "Applied, Unmatched, Rejected"
    }
    NOTIFICATION {
        uuid id PK
        uuid booking_id FK
        string type "Confirmation, Reminder, ReleaseNotice"
        string channel "Teams, Email"
        string dedup_key UK
        string status "Pending, Sent, Failed"
        timestamptz sent_at
    }
    AUDIT_RECORD {
        uuid id PK
        string entity_type
        uuid entity_id
        string action
        string reason
        uuid actor_employee_id FK "nullable = system action"
        timestamptz occurred_at
    }
```

Notes on modelling choices:

- **[DECISION]** `Resource.type` distinguishes Desk vs. Parking Space with a shared table plus a `characteristics` JSON column for type-specific attributes (e.g., monitor, accessibility, EV charging), rather than separate tables per type. **Why:** FR-01/FR-02/FR-11 treat both resource kinds almost identically (search, book, administer); a shared table with a flexible attribute bag avoids duplicated logic while Q-03 (which characteristics are filterable) remains open — new characteristics can be added without a schema migration.
- **[DECISION]** `Employee` is a **local projection** of the Entra ID identity (subject/object id, display name, email, home office, resolved role scope), populated **just-in-time on first sign-in** (upsert on login) rather than the API trusting client-supplied claims for authorization or requiring a separate HR feed. **Why:** bookings need a stable local foreign key, and role/office scope must be resolved and enforced server-side (R-07), not derived from a claim the client could tamper with. **Trade-off / open question:** this does not solve org-lifecycle propagation (leavers, transfers) — see **[OPEN] Q-11** in §15; JIT provisioning handles new joiners cleanly but a leaver's bookings must be handled by an explicit deactivation process, which is an admin action, not an automatic Entra sync in this HLD.
- **[DECISION]** `role_scope` is a **data-driven** field (`Employee`, `Admin` with an explicit list of office ids, or `Admin:global`) sourced from Entra ID App Roles/Group claims at JIT-provisioning time. **Why:** the context doc leaves "should administrators be global or office-specific" open (**[OPEN] Q-10**). Rather than guessing the business answer, the architecture supports both simultaneously — the answer becomes a configuration/role-assignment decision, not an architecture decision.
- `Booking.booking_date` is a plain date (no time component) representing the office-local working day, consistent with BR-01 ("bookings are for one working day").

---

## 5. Main System Flows

### 5.1 Booking lifecycle (state machine)

```mermaid
stateDiagram-v2
    [*] --> Reserved: Create booking
    Reserved --> CheckedIn: Accepted evidence before deadline
    Reserved --> Released: Deadline passed, no accepted evidence
    Reserved --> Cancelled: Employee or admin cancels
    CheckedIn --> Cancelled: Admin manual override only
    Released --> Reserved: Admin manual override only, not automatic (BR-08)
    Released --> [*]
    Cancelled --> [*]
    CheckedIn --> [*]: End of working day
```

### 5.2 Concurrent booking — conflict prevention

```mermaid
sequenceDiagram
    participant EA as Employee A
    participant EB as Employee B
    participant BM as Booking Module
    participant DB as Database

    EA->>BM: POST /bookings (resource X, date D)
    EB->>BM: POST /bookings (resource X, date D)
    par Concurrent transactions
        BM->>DB: BEGIN; INSERT booking
    and
        BM->>DB: BEGIN; INSERT booking
    end
    DB-->>BM: Insert 1 succeeds (unique constraint satisfied)
    DB-->>BM: Insert 2 rejected (unique constraint violated)
    BM-->>EA: 201 Created, status=Reserved
    BM-->>EB: 409 Conflict, "resource already booked"
```

**[DECISION — R-01, FR-05]** Conflict prevention is enforced by a **partial unique index** on `(resource_id, booking_date) WHERE status IN ('Reserved','CheckedIn')`, not by application-level locking or a distributed lock service. **Why:** the database already serializes concurrent writes to the same row/index entry; this is the simplest mechanism that gives a hard guarantee regardless of how many API instances are running. **Alternative considered:** optimistic concurrency (version column) — rejected as the primary mechanism because it still allows two conflicting *inserts* to race; it remains useful for **update/cancel** operations to avoid lost updates. **Trade-off:** ties conflict-prevention correctness to a single physical database — acceptable at this scale (see §10) and preferable to the operational complexity of a distributed lock.

### 5.3 Check-in ingestion — idempotency

```mermaid
sequenceDiagram
    participant P as Check-in Provider (any vendor)
    participant Q as Managed Queue
    participant GW as Check-in Gateway
    participant DB as Database
    participant BM as Booking Module

    P->>Q: CheckInEvent(source, external_event_id, subject, occurred_at)
    Q->>GW: Deliver (at-least-once)
    GW->>DB: INSERT checkin_evidence (unique: source_system + external_event_id)
    alt First delivery
        DB-->>GW: Insert succeeds
        GW->>BM: Match event to Reserved booking, apply evidence
        alt Match found before deadline
            BM->>DB: UPDATE booking SET status=CheckedIn WHERE status=Reserved
            BM-->>GW: Applied
        else No matching Reserved booking (already released/cancelled/none)
            BM->>DB: Mark evidence outcome=Unmatched, raise for admin review
        end
    else Duplicate delivery (retry, redelivery)
        DB-->>GW: Unique constraint violation
        GW-->>Q: Acknowledge, no-op (idempotent)
    end
```

**[DECISION — R-03, R-04, NFR-03]** Idempotency key is `(source_system, external_event_id)` with a unique constraint; the queue is allowed (expected) to deliver at-least-once, and duplicates are absorbed at the database boundary rather than requiring exactly-once delivery from the transport. Out-of-order and delayed events are handled by re-evaluating booking state at application time rather than assuming arrival order (BR-08: a late event after release does **not** silently restore the booking — it is recorded as `Unmatched` and surfaced for admin resolution).

### 5.4 Automatic release sweep

```mermaid
flowchart TD
    A["Scheduled trigger, e.g. every 1-5 minutes"] --> B["Query: status=Reserved AND office-local now > release_deadline_local for booking_date, per office policy"]
    B --> C{"Any matching bookings?"}
    C -->|No| Z["End cycle"]
    C -->|Yes| D["Conditional UPDATE: status=Released WHERE id=... AND status='Reserved'"]
    D --> E["Write audit record: auto-release, reason=deadline-exceeded"]
    E --> F["Enqueue release notification, dedup_key = booking_id + 'RELEASE'"]
    F --> C
```

**[DECISION — R-02, R-05, BR-07]** The sweep is naturally **idempotent and retry-safe**: it is a conditional `UPDATE ... WHERE status='Reserved'`, so re-running the same sweep (crash, redeploy, overlapping trigger) never double-releases or double-notifies — a booking already moved out of `Reserved` simply matches zero rows on the next pass. This avoids needing a separate distributed-lock/leader-election mechanism for the scheduler at this scale — a single active worker with "at-least-once trigger, idempotent effect" is sufficient. **Alternative considered:** per-booking scheduled timers (e.g., durable functions/delayed queue messages) — rejected as unnecessary complexity; a short-interval polling sweep is simpler to reason about, test, and observe, and 1–5 minute latency on release is well within business tolerance (deadline is a 10:00 cutover, not a real-time SLA).

### 5.5 Notification dispatch — duplicate prevention

```mermaid
sequenceDiagram
    participant Domain as Booking / Release / Check-in Module
    participant Outbox as Notification Outbox (DB table)
    participant Worker as Notification Worker
    participant Graph as Microsoft Graph API

    Domain->>Outbox: INSERT notification (dedup_key UNIQUE, status=Pending) — same DB transaction as the state change
    Worker->>Outbox: Poll Pending notifications
    Worker->>Graph: Send via Teams/Email
    alt Send succeeds
        Graph-->>Worker: 200 OK
        Worker->>Outbox: UPDATE status=Sent WHERE status=Pending
    else Send fails
        Graph-->>Worker: Error / timeout
        Worker->>Outbox: increment retry_count, backoff, retry later
    end
```

**[DECISION — FR-18, R-05, NFR-03]** This is the **transactional outbox pattern**: the notification "intent" is written in the same database transaction as the booking/release/check-in state change (so it can never be silently lost), and the `dedup_key` (e.g., `booking_id + notification_type`) is unique, so a redelivered/retried worker cycle cannot send the same notification twice. **Why not send synchronously inline:** a Graph API outage would then block booking operations; decoupling via the outbox means notification failures never affect booking correctness (see §9).

---

## 6. Data and Consistency Model

- **[DECISION]** Single relational database (PostgreSQL, or Azure SQL if the Azure decision in §2 is confirmed) is the **single source of truth** for all modules. Strong consistency (ACID transactions) is used for every state-changing operation; there is no eventual-consistency window for booking state itself.
- **Data ownership:** each module owns a set of tables; cross-module reads go through the owning module's service interface (see §3). Physically one database, logically partitioned ownership — this preserves the option to split into separate databases per module later without changing the domain model.
- **Multi-office partitioning:** all resource-bearing tables carry `office_id`. This is a **shared-schema, row-level partition** model, not a database-per-office or schema-per-office model. **Why:** at 5,000 users across a modest number of offices, per-office databases would multiply operational overhead (migrations, backups, connection pools) for no consistency benefit, since cross-office queries (e.g., a global admin's dashboard) are common and easier against one database. **Trade-off:** a single large database is a single blast radius — mitigated by backup/PITR and the module-boundary discipline in §3, and is revisited only if a specific office ever needs data residency isolation (not currently a stated requirement).
- **Audit records are append-only** — no update/delete path is exposed at the application layer; this is enforced by omitting update/delete operations from the Audit Module's interface, not just by convention.
- **Read/availability queries** (FR-01) are computed as `active resources of type X in office O` minus `resources with an active (Reserved/CheckedIn) booking on date D`, backed by a composite index on `(office_id, resource_id, booking_date, status)`. No caching layer is required at the stated scale; if reporting/analytics load grows meaningfully, a read replica is the natural next step (see §11), not a redesign.

---

## 7. Integration Architecture

### 7.1 Check-in evidence — vendor neutrality **[REQ — FR-19, R-09]**

**[DECISION]** The Check-in Gateway defines one canonical contract:

```
CheckInEvent {
  source_system: string        // e.g. "app-qr", "access-card", "sensor-vendor-x", "admin"
  external_event_id: string    // source's own event/message id, used for idempotency
  subject_reference: string    // resource id / badge id / employee id, per source
  occurred_at: timestamp
  received_at: timestamp
}
```

Each provider (app/QR, access card system, sensor, admin-confirmation) has its own **adapter** that translates provider-specific payloads into this canonical shape before anything reaches the Booking domain. The Booking Module never sees vendor-specific formats. Adding a new provider means adding a new adapter; it does not touch booking logic. This directly satisfies "documented, vendor-neutral interface... so additional evidence providers can be introduced later" (FR-19) and decouples the domain from hardware/vendor coupling (R-09).

Per **A-06** (physical access/sensor integrations not mandatory for PoC) and **[OPEN] Q-04** (preferred production check-in method unresolved), the architecture is intentionally indifferent to which adapter ships first — any single adapter (most likely app/QR code, the lowest-friction and fully software-based option) can be the production launch method, with others added later without redesign.

### 7.2 Notifications **[REQ — FR-18]**

**[DECISION]** A single `NotificationChannel` abstraction wraps Microsoft Graph API calls for both Teams and Email, so the eventual choice between the two (**[OPEN] Q-06**) is a configuration/routing decision per office or per employee preference, not an architectural one. Both are Graph API operations under one Microsoft 365 integration, which keeps this cheap to support simultaneously if desired.

### 7.3 Identity **[REQ — FR-17, A-01]**

**[DECISION]** OpenID Connect / OAuth2 Authorization Code + PKCE against Microsoft Entra ID for the web client; the API validates bearer JWTs (issuer, audience, signature, expiry) on every request. No password storage, no custom identity store. This is the only supported sign-in method, consistent with A-01 (Entra ID is the authoritative identity provider).

---

## 8. Security and Authorisation

- **[REQ — NFR-01]** TLS in transit everywhere; encryption at rest via the managed database's native encryption; secrets (Graph API client secret/certificate, DB credentials) held in a managed secret store (e.g., Key Vault) — never in source, config files, or agent prompts/logs (also satisfies NFR-12).
- **[REQ — R-07]** Authentication (Entra ID) is necessary but not sufficient. **Every** API endpoint performs a server-side authorization check based on the resolved local `Employee.role_scope`, never on client-supplied identifiers. Employees can only query/mutate bookings where `booking.employee_id == principal.employee_id`; admin endpoints require `role_scope` to include the target office (or `global`).
- **[REQ — NFR-02, R-10]** Data minimization: only the fields needed for booking, check-in matching, and audit are collected (no location tracking beyond the booked resource/day, no biometric data). A configurable **retention policy** mechanism is designed in (time-boxed deletion/anonymization jobs per data category), but concrete retention durations are **[OPEN] — Q-07**, not invented here; see §15.
- **[REQ — NFR-12, NFR-13, C-05/06/07]** Agent governance is treated as a security control, not just a process note: agents are scoped to least-privilege credentials for their task, must not receive secrets or unnecessary personal data in prompts/context, and only approved AI tooling is used. Every agent-authored change goes through the same CI/CD gates as human-authored change (dependency scan, SAST, review) — see §11 — and significant agent actions plus human approvals are themselves recorded (extending the Audit Module to cover delivery-pipeline events, not only application events).
- **[REQ — R-08, BR-09]** Manual admin overrides (correcting a booking, resolving a false check-in, reinstating a released resource) are implemented as regular domain operations that *require* a `reason` field and always write an audit record in the same transaction — there is no "back door" schema update path that skips audit.

---

## 9. Reliability and Failure Handling

- **Booking conflict prevention:** guaranteed by the database (§5.2) — no distinct failure mode beyond "the loser gets a clear 409 and can retry against updated availability."
- **Check-in idempotency:** guaranteed by the unique `(source_system, external_event_id)` constraint (§5.3); redelivery is a safe no-op.
- **Out-of-order / delayed events (R-04):** the gateway always re-evaluates current booking state rather than assuming events arrive in order; a check-in that arrives after release is stored as `Unmatched` evidence (not silently discarded, not silently restoring the booking — per BR-08) and surfaced in the Admin & Reporting Module for manual resolution.
- **Retry-safe jobs (R-05):** both the release sweep (§5.4) and notification dispatch (§5.5) are designed so retries are no-ops on already-applied state — conditional `UPDATE ... WHERE status=X` and unique `dedup_key` respectively. No job requires "at-most-once" delivery guarantees from its trigger.
- **Notification/booking decoupling:** a Graph API outage delays notifications (they retry with backoff from the outbox) but never blocks or fails a booking, check-in, or release operation — these are independent database transactions.
- **Unmatched/ambiguous check-in events:** never silently dropped; always persisted with an `outcome` and visible to admins (FR-15, R-02).
- **Degraded external dependency (Entra ID unreachable):** existing valid sessions/tokens continue to work until expiry; new sign-ins fail closed (no fallback authentication path — a hard requirement given R-07).
- **Health checks / readiness:** API and worker expose liveness/readiness endpoints for the platform's orchestrator to manage restarts and rolling deploys safely.

---

## 10. Multi-office and Timezone Strategy

**[REQ — FR-16, A-04, A-05, R-06]**

- Each `Office` stores an **IANA timezone** (e.g., `Europe/Belgrade`), never a fixed UTC offset, so daylight-saving transitions are handled correctly by timezone-aware libraries rather than by stored offsets that would silently drift.
- `Booking.booking_date` is a plain office-local date. `Policy.release_deadline_local` is a local time-of-day (e.g., `10:00`). The **effective deadline instant** is computed on demand as `booking_date + release_deadline_local` interpreted in the office's IANA timezone, converted to an absolute instant (UTC) for comparison — computed at evaluation time, not baked into a stored UTC value at booking time, so timezone-rule changes (rare, but real) are handled correctly.
- Policies (booking window, limits, deadlines, accepted evidence) are scoped by `office_id` (+ optionally `resource_type`), so **local office policy differences (A-05)** are pure configuration, not code branches.
- **[DECISION]** The release sweep (§5.4) evaluates deadlines per-office using each office's own timezone in a single query pass (a timezone-aware SQL predicate, or an application-level loop over offices if the database lacks convenient timezone functions) — this is an implementation detail to confirm in low-level design, not an architectural fork; either approach preserves per-office correctness.
- Admin scope (**[OPEN] Q-10**, addressed architecturally in §4) composes naturally with this: a global admin's view aggregates across offices, always displaying each office's own local time so no admin has to mentally convert timezones for operational decisions (FR-15).
- Adding a new office is a data operation (insert `Office` + `Resource` rows + `Policy` rows), not a deployment or schema change — directly satisfies "expansion to multiple offices... without redesigning the core platform" (P-07).

---

## 11. Deployment and Operations

```mermaid
graph LR
    subgraph Dev["Dev Environment"]
        DevApp["Smart Office API"]
        DevDB[("Dev DB")]
    end
    subgraph Test["Test Environment"]
        TestApp["Smart Office API"]
        TestDB[("Test DB")]
    end
    subgraph Prod["Prod Environment"]
        ProdApp["Smart Office API\n(autoscaled, stateless replicas)"]
        ProdWorker["Background Worker\n(release sweep, notification dispatch)"]
        ProdDB[("Prod DB\nHA + point-in-time backups")]
        ProdQueue[["Managed Queue"]]
    end

    Pipeline["CI/CD Pipeline\nbuild, unit tests, SAST, dependency scan"] --> DevApp
    DevApp --> IntTest["Integration & E2E tests"]
    IntTest --> TestApp
    TestApp --> Gate{"Human Approval Gate"}
    Gate -->|"approved"| ProdApp
    Gate -->|"approved"| ProdWorker
```

- **[REQ — NFR-10, NFR-11]** Dev, Test, and Prod are fully separated environments (separate databases, separate secrets, separate configuration) with repeatable, scripted setup (infrastructure as code). Every environment is built by the same pipeline artifact — no "works on my machine" drift.
- **[REQ — NFR-11, C-06]** CI/CD pipeline stages: build → unit tests → SAST + dependency/vulnerability scan → deploy to Dev → integration/E2E tests → deploy to Test → **explicit human approval gate** → deploy to Prod. Production releases require human sign-off, whether the change originated from a human or an agent — this is a hard gate, not advisory (C-06, NFR-13).
- **[REQ — NFR-13]** A build with unresolved **critical** security findings (SAST or dependency scan) is blocked from progressing past Dev; scan evidence is retained as part of the release record (also feeds the Audit Module — see §8).
- **[REQ — NFR-04]** API is stateless and horizontally scaled behind a load balancer/autoscaler; the background worker scales independently of the API (it's a lightweight polling process, not a per-request bottleneck). The database is the one component that scales vertically first, then via read replicas if reporting load grows — this is expected to be sufficient well past 5,000 users given the transaction volume involved (see §6).
- **Backup, restore, rollback [REQ — NFR-14]:**
  - **Backup:** automated database backups with point-in-time recovery (PITR); infrastructure defined as code so the full environment can be rebuilt, not just the data.
  - **Restore:** documented restore runbook — restore DB to a target point in time into a fresh instance, validate, then cut over; no requirement to restore in place.
  - **Rollback:** deployments use immutable, versioned artifacts (container images) so a bad release rolls back to the previous known-good image; database migrations are written to be backward-compatible for at least one release (expand/contract pattern) so a code rollback never requires a simultaneous destructive schema rollback.
  - **Targets:** the Context Discovery document leaves availability, RTO and RPO unanswered (**[OPEN] Q-08, Q-09**). This HLD proposes, as a **starting point for discussion, not a commitment**: RPO ≤ 15 minutes (via PITR) and RTO ≤ 4 hours for a business tool of this nature. These are explicitly flagged for client confirmation in §15, not asserted as requirements.
- **[REQ — NFR-07]** Observability: structured, correlated logging across the booking → check-in → release → notification chain (a `correlation_id` or `booking_id` threads through logs for traceability); metrics on release-job success/failure counts, notification delivery success rate, booking conflict (409) rate, and check-in match/unmatch rate; centralized log aggregation and alerting on job failures and elevated error rates.

---

## 12. Key Architectural Decisions

| ID | Decision | Why | Alternatives Considered | Trade-offs | Requirements Addressed |
|---|---|---|---|---|---|
| AD-01 | Modular monolith, not microservices | Transaction volume at target scale (≤5,000 users) doesn't need distributed services; ACID transactions make conflict prevention simple | Microservices per module; serverless functions per capability | Less "cloud-native buzzword compliance"; must self-discipline module boundaries to preserve future splittability | P-07, NFR-04, NFR-05, all reliability NFRs |
| AD-02 | DB unique constraint for booking conflict prevention | Database already serializes conflicting writes; no extra moving parts | Distributed lock (e.g., Redis lock); optimistic concurrency only; pessimistic app-level mutex | Ties correctness to single physical DB — acceptable at this scale | FR-05, R-01 |
| AD-03 | Row-level multi-office partitioning (`office_id` column), single shared schema | Cross-office admin/reporting queries are simple; avoids N-database operational overhead | Database-per-office; schema-per-office | No hard data-residency isolation between offices (not currently required) | FR-16, P-07, NFR-04 |
| AD-04 | Transactional outbox pattern for notifications and check-in ingestion | Guarantees at-least-once delivery without losing intents on crash, and dedup key prevents duplicate sends on retry | Fire-and-forget synchronous send; separate message broker with exactly-once semantics | Slight end-to-end latency (poll interval) for notifications | FR-18, R-05, NFR-03 |
| AD-05 | Managed queue decouples check-in ingestion from processing | Absorbs bursts/retries from external providers without blocking them; natural place for a dead-letter path | Direct synchronous webhook processing | Adds one managed component (low operational cost on Azure) | R-03, R-04, R-05, NFR-03 |
| AD-06 | Azure as target cloud | First-party integration with Entra ID + Graph API (both required); managed identity avoids stored secrets | AWS/GCP + custom OIDC federation bridge; cloud-agnostic abstraction layer from day one | Vendor lean-in; abstraction layer would add cost/complexity for a benefit (portability) not currently required | FR-17, FR-18, NFR-01, A-07 |
| AD-07 | Canonical `CheckInEvent` + adapter pattern for vendor neutrality | Domain core never depends on a specific vendor payload shape | Vendor SDKs called directly from the Booking module | Slightly more upfront design; pays off the moment a second provider is added | FR-19, R-09 |
| AD-08 | Local `Employee` projection, JIT-provisioned from Entra ID claims | Bookings need a stable local FK; role/office scope must be resolved server-side, not trusted from client | Trust Entra ID claims directly per-request with no local table; separate HR feed integration | Leaver/role-change propagation still needs an explicit process (flagged open) | R-07, FR-17, A-01 |
| AD-09 | IANA timezone + on-demand local→UTC deadline computation | Correctly handles DST and timezone-rule changes; keeps policy values human-readable and configurable | Store deadlines as fixed UTC offsets per office | Slightly more computation per evaluation (negligible at this scale) | FR-16, R-06, A-04, A-05 |
| AD-10 | Polling sweep (idempotent conditional update) for auto-release, not per-booking timers | Simple to reason about, test, and observe; naturally retry-safe | Durable per-booking scheduled triggers (e.g., delayed queue messages, durable functions) | Release latency bounded by poll interval (minutes), acceptable given a 10:00 cutover, not a real-time SLA | FR-09, BR-05, BR-07, R-02, R-05 |
| AD-11 | Human approval gate before every production deployment | Explicit client requirement; keeps human accountable for production regardless of who/what authored the change | Fully automated deploy-on-green pipeline | Slower release cadence than full CD | C-06, NFR-11, NFR-13 |
| AD-12 | Reference stack left illustrative, not mandated | Language/framework explicitly deferred to solution design (A-07) but not required to be pinned at HLD level; module boundaries in §3 are stack-agnostic | Pin a specific language/framework now | Slightly less concrete for implementation planning — acceptable since this stage precedes PoC/implementation selection | A-07, NFR-05 |

---

## 13. Alternatives Considered (Macro Architecture Options)

| Dimension | Option chosen | Rejected alternative | Why rejected |
|---|---|---|---|
| Service decomposition | Modular monolith | Microservices per domain module | No requirement demands independent scaling/deployment per module at this scale; adds distributed-transaction risk to exactly the conflict-prevention guarantee that's most important (R-01) |
| Primary data store | Single relational DB (SQL) | NoSQL document store (e.g., Cosmos DB, DynamoDB) | Booking conflict prevention needs strong uniqueness constraints and multi-entity transactions (booking + audit + notification outbox together); relational is the natural fit and the data is inherently relational (offices, resources, bookings, policies) |
| Check-in ingestion | Synchronous ingestion + managed queue buffer | Fully synchronous webhook-to-DB write, no queue | A queue gives retry/backoff/dead-letter handling for free and protects the API from provider-side burst/retry storms, at very low added operational cost on a managed cloud |
| Multi-office isolation | Shared schema, `office_id` partition | Database-per-office | Cross-office admin visibility and reporting are explicit requirements (FR-15, facilities management stakeholder needs); per-office databases make this harder for no compensating benefit given no data-residency requirement is stated |
| Event/notification architecture | Transactional outbox on the primary DB | Dedicated event-streaming platform (Kafka/Event Hubs) | Event volume (booking lifecycle events for ≤5,000 users) doesn't approach the scale where a streaming platform earns its operational cost; outbox gives the needed guarantees (at-least-once, ordered-per-entity, replayable) more simply |
| Release scheduling | Idempotent polling sweep | Durable per-booking timers/scheduled functions | Simpler operational model, easier to test deterministically, and the business deadline (10:00 cutover) tolerates minutes of latency |

---

## 14. Requirement Coverage

| Requirement | Addressed by | Status |
|---|---|---|
| FR-01 Availability search | Booking Module availability query (§6) | Addressed |
| FR-02 Resource details / filtering | `Resource.characteristics` JSON, filter query (§4) | Addressed (exact filterable fields pending Q-03) |
| FR-03 Create booking | Booking Module, conflict-prevention flow (§5.2) | Addressed |
| FR-04 View/cancel bookings | Booking Module | Addressed |
| FR-05 Conflict prevention | DB unique constraint (§5.2, AD-02) | Addressed |
| FR-06 Booking limits, windows | Policy Module, `employee_daily_limit`, `booking_window_days` | Addressed |
| FR-07 Status visibility | Booking status field + Admin & Reporting Module | Addressed |
| FR-08 Check-in evidence | Check-in Gateway + adapters (§7.1) | Addressed |
| FR-09 Automatic release | Release Engine sweep (§5.4) | Addressed |
| FR-10 Released resource rebookable | Release sets status=Released → excluded from active-booking set, immediately available | Addressed ([OPEN] same-day immediate rebooking confirmed as default behaviour — see §15, Q-05) |
| FR-11 Resource administration | Resource & Policy Module CRUD | Addressed |
| FR-12 Policy administration | Policy Module | Addressed |
| FR-13 Manual override + reason | Admin & Reporting Module, mandatory `reason`, audit co-write (§8) | Addressed |
| FR-14 Audit history | Audit Module, append-only | Addressed |
| FR-15 Operational overview | Admin & Reporting Module | Addressed |
| FR-16 Multiple offices | Office/Tenant Module, `office_id` partitioning (§10) | Addressed |
| FR-17 Corporate sign-in / access boundaries | Entra ID OIDC, server-side authorization (§7.3, §8) | Addressed |
| FR-18 Notifications, no duplicates | Notification Service, outbox + dedup key (§5.5) | Addressed |
| FR-19 Vendor-neutral check-in interface | Canonical `CheckInEvent` + adapters (§7.1) | Addressed |
| BR-01..BR-09 | Domain model + state machine (§4, §5.1) + release/check-in flows | Addressed |
| NFR-01 Security | §8 | Addressed |
| NFR-02 Privacy | §8 (retention mechanism designed; durations open — Q-07) | Addressed, one parameter open |
| NFR-03 Reliability | §9 | Addressed |
| NFR-04 Scalability (5,000 users) | §6, §11 | Addressed |
| NFR-05 Maintainability | §3 module boundaries, documented contracts | Addressed |
| NFR-06 Testing | §16 below | Addressed |
| NFR-07 Observability | §11 | Addressed |
| NFR-08 Usability (mobile employee flows) | Client layer requirement — not further specified at HLD level (UI design stage) | Addressed at architecture level; detailed UI design out of scope for HLD |
| NFR-09 Accessibility | Client layer requirement — same as above | Addressed at architecture level; detailed UI design out of scope for HLD |
| NFR-10 Deployment repeatability | §11 (infrastructure as code) | Addressed |
| NFR-11 Delivery automation, env separation, human approval | §11 | Addressed |
| NFR-12 Agent access governance | §8 | Addressed |
| NFR-13 Secure changes / scan gating | §8, §11 | Addressed |
| NFR-14 Recovery (backup/restore/rollback) | §11 (targets proposed, pending confirmation — Q-08/Q-09) | Addressed, targets open |

---

## 15. Risks and Open Questions

### Carried forward from Context Discovery (unchanged status — none block this HLD, per the context doc's own assessment)

| ID | Risk/Question | How this HLD addresses it | Still needs human/client input? |
|---|---|---|---|
| R-01 Concurrent booking | DB unique constraint (§5.2) | No — architecturally resolved |
| R-02 Incorrect auto-release | Idempotent conditional sweep + unmatched-evidence path (§5.4, §9) | No — architecturally resolved |
| R-03 Duplicate check-in events | Idempotency key (§5.3) | No — architecturally resolved |
| R-04 Delayed/out-of-order events | Re-evaluation at apply-time, unmatched path (§9) | No — architecturally resolved |
| R-05 Retry safety | Idempotent sweep + outbox dedup (§5.4, §5.5) | No — architecturally resolved |
| R-06 Multi-office timezones | IANA tz + on-demand computation (§10) | No — architecturally resolved |
| R-07 Authorisation | Server-side checks on every endpoint (§8) | No — architecturally resolved |
| R-08 Privileged admin actions | Mandatory reason + co-written audit (§8) | No — architecturally resolved |
| R-09 Integration coupling | Adapter pattern (§7.1) | No — architecturally resolved |
| R-10 Privacy | Data minimization + retention mechanism (§8) | **Yes** — retention durations (Q-07) |
| R-11 Agent access | Least-privilege scoping, no secrets/PII in prompts (§8) | Ongoing governance, not a design gap |
| R-12 Generated change quality | CI/CD gates, human approval (§11) | Ongoing governance, not a design gap |
| Q-01 Peak demand | No specific numbers assumed; architecture handles worst-case single-resource contention regardless of overall scale (§5.2); general throughput sized to NFR-04 | **Yes** — real peak numbers would refine load-test targets |
| Q-02 Parking eligibility | Not modelled as a distinct rule; can be added as a Policy-level eligibility flag without redesign if required | **Yes** — business rule needed |
| Q-03 Filterable characteristics | `characteristics` JSON supports any field; specific filterable set undefined | **Yes** — product decision |
| Q-04 Initial check-in method | Architecture is adapter-neutral; any single adapter can launch first (§7.1) | **Yes** — product decision, not architecture-blocking |
| Q-05 Released resource immediately bookable mid-day | **[ASSUMPTION — new]** Assumed **yes** (release simply removes the booking from the active set, per FR-10's plain reading) | Recommend explicit confirmation — low risk if wrong, cheap to change (a policy flag) |
| Q-06 Notification channel(s) for v1 | Architecture supports Teams and/or Email simultaneously (§7.2) | **Yes** — product decision, not architecture-blocking |
| Q-07 Data retention | Retention *mechanism* designed; durations undefined | **Yes** — compliance/legal input required |
| Q-08 Availability target | Proposed discussion baseline only, not committed (§11) | **Yes** — client input required |
| Q-09 RTO/RPO | Proposed discussion baseline only, not committed (§11) | **Yes** — client input required |
| Q-10 Admin scope (global vs office) | Architecture supports both via data-driven `role_scope` (§4) | Recommend confirming which is used operationally, but not architecture-blocking |
| Q-11 Employee lifecycle (leaver/role change propagation from Entra ID) | JIT provisioning handles joiners; **no automated leaver/role-change sync is designed** — this is a genuine gap | **Yes** — needs a decision: polling sync job vs. Entra ID webhook/Graph change notifications vs. manual admin deactivation |
| Q-12 Reporting scope (current-state vs. historical utilisation) | Current-state operational overview is designed (§3, Admin & Reporting Module); historical trend analytics would reuse the same audit/booking data but is not separately designed | **Yes** — product decision; low architectural risk either way given audit data already captures history |

### New items surfaced by this HLD

| ID | Item | Type | Needs human input? |
|---|---|---|---|
| N-01 | Cloud provider = Azure | **[DECISION]**, proposed | Yes — should be explicitly ratified given cost/vendor implications (AD-06) |
| N-02 | Employee leaver/role-change sync mechanism undesigned (Q-11 above) | **[OPEN]** — genuine design gap, not just a missing parameter | Yes — architectural choice needed before implementation |
| N-03 | Reference technology stack left unspecified | **[DECISION]**, deliberately deferred | Should be resolved before/at PoC selection, not blocking this HLD |
| N-04 | Exact release-sweep polling interval and its interaction with per-office timezone evaluation strategy (single tz-aware query vs. per-office loop) | Implementation-level detail | No — low-level design, not a blocker |

---

## 16. HLD Assessment

**Is the context sufficient for the proposed HLD?**
**Yes.** The Context Discovery document is explicit that it is sufficient for High-Level Solution Design (its own §15) and contains no blocking questions (its own §17). This HLD found no requirement that could not be traced to that document, and no gap that required inventing a business rule — open items were either designed around (kept neutral to the eventual answer) or explicitly flagged rather than defaulted silently.

**Does the HLD cover all functional requirements?**
**Yes** — all 19 functional requirements and all 9 business rules are traced to a specific component/flow in §14.

**Does it address the critical non-functional requirements?**
**Yes**, with two categories of caveat, both non-blocking:
1. Three parameters (data retention duration, availability target, RTO/RPO) are architecturally *supported* (retention mechanism, backup/restore/rollback design) but their concrete *values* are proposed as discussion starting points, not committed, pending client input (Q-07/08/09).
2. NFR-08/09 (mobile usability, accessibility) are addressed at the architecture level (responsive client, server-driven status/authorization so the UI has what it needs) but detailed UI/UX design is out of scope for an HLD and belongs to a later stage.

**Are there unresolved architectural blockers?**
**No hard blockers.** One genuine design gap was surfaced (N-02: employee leaver/role-change propagation from Entra ID has no designed mechanism yet) — this should be resolved before production implementation of the Office/Employee module, but it does not block proceeding to PoC selection, since it's unlikely to be in scope for a 2–3 feature PoC.

**Is the solution ready for PoC selection?**
**Yes.** The full-solution architecture is defined end-to-end (booking, conflict prevention, check-in, release, notifications, admin, audit, multi-office, security, deployment). PoC selection can now proceed by choosing 2–3 functionalities that validate the highest-risk assumptions in this design — most naturally: (a) booking creation with conflict prevention (validates R-01/AD-02, the riskiest correctness guarantee), and (b) check-in ingestion + automatic release with idempotency (validates R-02/R-03/R-04/R-05, the riskiest reliability guarantees) — but that selection is deliberately **not made in this document**, per the task boundary.

---

*End of Stage 2 High-Level Design. Per instructions, this document stops here for human review — no PoC selection, task breakdown, or implementation has been performed.*
