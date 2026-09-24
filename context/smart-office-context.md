# Smart Office — Context Discovery

## 1. Business Need

The client needs a Smart Office solution for managing desks and parking spaces in a hybrid working environment.

The initial deployment is for one Serbian office with approximately 200 employees, 150 bookable desks and 30 bookable parking spaces.

Hybrid working creates uneven demand during the week, while some reserved resources remain unused.

The solution should improve the employee booking experience and increase effective resource utilisation while providing a foundation that can later support multiple offices, local office policies, different office time zones and at least 5,000 users.

The client expects short development cycles, strong delivery automation, secure software development, protected company data and clear human responsibility for important decisions and production releases.

---

## 2. Business Problems

### P-01 — Uneven Resource Demand

Hybrid working creates significant differences in desk and parking demand across working days.

### P-02 — Unused Reservations

Some reserved desks and parking spaces remain unused, reducing effective office capacity and preventing other employees from using available resources.

### P-03 — Resource Availability Visibility

Employees need a reliable way to understand which desks and parking spaces are available for a selected working day.

### P-04 — Booking Reliability

The system must prevent conflicting reservations, including concurrent attempts to book the same resource.

### P-05 — Operational Management

Workplace administrators need to manage resources, availability, booking rules, release policies, check-in methods and exceptional situations.

### P-06 — Limited Operational Insight

Administrators need visibility into reservations, check-ins, releases and no-shows.

### P-07 — Future Growth

The initial solution must support future expansion from one Serbian office to multiple offices and at least 5,000 users without redesigning the core platform.

---

## 3. Desired Business Outcomes

The solution should enable:

1. Employees to easily find and reserve desks and parking spaces.
2. Reliable prevention of conflicting bookings.
3. Better resource utilisation through check-in and automatic release.
4. Reduced impact of no-show reservations.
5. Configurable workplace policies.
6. Clear booking and resource status visibility.
7. Auditable administrative intervention.
8. Integration with existing corporate identity and communication systems.
9. Expansion to multiple offices.
10. Automated software delivery while retaining human responsibility for production releases.

---

## 4. Users and Stakeholders

### Employee

Employees need to:

* sign in using corporate identity
* search resource availability
* view resource details
* book desks and parking spaces
* view current and future bookings
* cancel bookings
* provide check-in evidence
* receive booking confirmations
* receive check-in reminders
* receive release notices
* understand booking status

Employees must only be able to access their own bookings.

### Workplace Administrator

Administrators need to:

* create, update, activate and deactivate resources
* configure booking policies
* configure employee limits
* configure release deadlines
* configure accepted check-in methods
* inspect booking status
* perform manual corrections
* resolve false check-in readings
* view operational information
* review audit history

### Workplace / Facilities Management

Interested in:

* resource utilisation
* no-show rates
* office capacity
* policy effectiveness
* future office expansion

### Corporate IT / Platform

Responsible for or involved in:

* Microsoft Entra ID
* cloud infrastructure
* security controls
* secrets management
* deployment
* monitoring
* backup
* recovery

### Engineering and Delivery Teams

Responsible for building and operating the Smart Office platform through an Agentic SDLC where agents perform meaningful lifecycle work and humans retain responsibility for decisions and quality.

---

## 5. System Context

Smart Office is a new cloud-hosted application within the client's IT environment.

The client already uses Microsoft 365, Microsoft Entra ID and cloud infrastructure.

Employees and administrators interact directly with Smart Office.

Smart Office depends on Microsoft Entra ID for corporate authentication and Microsoft 365, Teams or corporate email for notifications.

Physical access systems such as access cards and sensors may optionally provide check-in evidence.

The internal architecture and cloud services are intentionally unspecified and must be proposed by the delivery team.

The specification does not require a specific cloud provider.

### External Dependencies

| External System               | Purpose                  | Required |
| ----------------------------- | ------------------------ | -------- |
| Microsoft Entra ID            | Corporate authentication | Yes      |
| Microsoft 365 / Teams / Email | Notifications            | Yes      |
| Access Cards                  | Check-in evidence        | Optional |
| Sensors                       | Check-in evidence        | Optional |

The Smart Office application remains responsible for application-level authorisation even though Microsoft Entra ID provides authentication.

---

## 6. Functional Requirements

### FR-01 — Availability Search

Employees can select a date and view available desks and parking spaces.

### FR-02 — Resource Details

Employees can view enough information to identify and select an appropriate resource.

Filtering by relevant characteristics is recommended.

### FR-03 — Create Booking

Employees can book a desk, a parking space or both for a selected working day.

### FR-04 — View and Cancel

Employees can view and cancel current and future bookings.

### FR-05 — Conflict Prevention

The system must prevent more than one active booking for the same resource and date, including concurrent attempts.

### FR-06 — Booking Limits

The system must enforce configured employee limits, booking windows and resource availability.

### FR-07 — Status Visibility

Employees and administrators can view the current booking status and relevant status changes.

### FR-08 — Check-in Evidence

The system must support at least one method for confirming arrival or usage.

Possible methods include app check-in, QR code, access card, sensor or administrator confirmation.

Evidence must be matched to the relevant booking.

### FR-09 — Automatic Release

Reservations without accepted usage evidence after the configured deadline must be automatically released.

### FR-10 — Released Resource

A released desk or parking space becomes available for another employee to book.

### FR-11 — Resource Administration

Administrators can create, update, activate and deactivate desks and parking spaces.

### FR-12 — Policy Administration

Administrators can configure booking windows, employee limits, release deadlines and accepted check-in methods.

### FR-13 — Manual Override

Administrators can correct bookings, resource states and false check-in readings.

Every action and its reason must be recorded.

### FR-14 — Audit History

The system records important booking, cancellation, check-in, release and administrative actions.

### FR-15 — Operational Overview

Administrators can view reservations, check-ins, releases and no-shows.

### FR-16 — Multiple Offices

The platform supports multiple offices with separate resources, time zones and local policies.

### FR-17 — Corporate Sign-in

Microsoft Entra ID is used for employee authentication.

Employees can access only their own bookings, while authorised administrators can access management functionality.

### FR-18 — Notifications

The platform sends booking confirmations, check-in reminders and release notices through Microsoft Teams or corporate email.

Duplicate notifications must be avoided.

### FR-19 — Integration Interface

The platform provides a documented vendor-neutral interface for check-in events so additional evidence providers can be introduced later.

---

## 7. Core Domain Concepts

### Office

Represents a physical company office.

Important properties include identifier, name, timezone, resources and local policies.

### Resource

Represents a bookable resource.

Current resource types are Desk and Parking Space.

Common properties include ID, office, name, type, status and optional characteristics.

Resource states are:

* Available
* Unavailable
* Under Maintenance

### Booking

Represents a resource reservation for one working day.

Booking states are:

* Reserved
* Checked In
* Released
* Cancelled

### Policy

Defines configurable behaviour such as booking window, employee limits, release deadline and accepted evidence.

Policies may vary by office, resource type or both.

### Check-in Evidence

Represents evidence that a booked resource is being used.

Possible sources include the application, QR code, access system, sensor or administrator.

### Notification

Represents communication associated with booking lifecycle events.

### Audit Record

Represents a traceable record of significant system or administrative actions.

---

## 8. Business Rules

### BR-01

Bookings are for one working day.

Hourly booking is not required.

### BR-02

An employee may hold no more than one desk booking and one parking booking for the same day.

### BR-03

Bookings can be created up to 14 calendar days in advance by default.

### BR-04

Resources marked unavailable or under maintenance cannot be booked.

### BR-05

The default check-in and release deadline is 10:00 in the office local time zone.

### BR-06

The deadline and accepted evidence can be configured by office, resource type or both.

### BR-07

A booking with accepted check-in evidence before the deadline remains active.

Otherwise, it is released.

### BR-08

A late event received after release does not automatically restore the old booking.

An administrator may resolve the situation.

### BR-09

Manual overrides and policy changes must be auditable.

---

## 9. Quality Requirements

### NFR-01 — Security

The solution must enforce permissions on the server, protect data in transit and at rest, securely store secrets and avoid hardcoded credentials.

### NFR-02 — Privacy

Only necessary personal and occupancy information should be collected.

A retention policy must be defined.

### NFR-03 — Reliability

The system must safely handle concurrent booking attempts, duplicate events, delayed events, out-of-order events and unmatched events.

Failed release and notification jobs must be retryable without duplicate side effects.

### NFR-04 — Scalability

The platform must support multiple offices and at least 5,000 users.

### NFR-05 — Maintainability

The solution should have clear component boundaries, documented APIs and extensible resource and integration models.

### NFR-06 — Testing

Automated testing must cover key business rules.

A broader testing strategy must be defined for full delivery.

### NFR-07 — Observability

Logs and monitoring should cover application failures, automatic release jobs and integration events.

### NFR-08 — Usability

Employee flows must work on mobile-sized screens.

Administrative flows may primarily target desktop.

### NFR-09 — Accessibility

The application must support keyboard navigation, readable contrast and clear status communication.

### NFR-10 — Deployment

The project must provide repeatable setup, deployment and run instructions.

### NFR-11 — Delivery Automation

CI/CD should automate build, testing and security checks.

Development, test and production environments must be separated.

Production releases require human approval.

### NFR-12 — Agent Access

Agents should receive only the permissions required for their task.

Secrets and unnecessary personal data must not be included in prompts or logs.

Only approved AI services should be used.

Significant agent actions and human approvals should be recorded.

### NFR-13 — Secure Changes

Generated code must undergo review, dependency scanning and vulnerability scanning.

Production releases must be blocked when unresolved critical security findings exist.

Evidence of checks should be retained.

### NFR-14 — Recovery

The proposal must define backup, restore and rollback procedures and propose availability and recovery targets.

---

## 10. Constraints

### C-01 — PoC Scope

The Camp PoC should implement only 2–3 selected functionalities.

### C-02 — Complete Proposal

The complete proposal must still address all functional and non-functional requirements.

### C-03 — Synthetic Data

Only fictional or representative data may be used.

### C-04 — Simulated Integrations

Corporate and hardware integrations may be simulated during the Camp.

### C-05 — Human Responsibility

Agents may perform lifecycle work, but humans remain responsible for decisions and quality.

### C-06 — Production Approval

Production releases require explicit human approval.

### C-07 — Approved AI Tools

Only approved AI tools and accounts should be used during the Camp.

---

## 11. Assumptions

### A-01

Microsoft Entra ID is the authoritative employee identity provider.

### A-02

Smart Office is a new application rather than an extension of an existing booking system.

### A-03

Existing Microsoft communication channels can be used for notifications.

### A-04

Each office has its own local timezone.

### A-05

Booking and release policies may differ between offices.

### A-06

Physical access and sensor integrations are not mandatory for the PoC.

### A-07

The client has not prescribed a specific cloud provider, database, programming language or application framework.

Those decisions belong to solution design.

---

## 12. Risks and Technical Challenges

### R-01 — Concurrent Booking

Multiple employees may attempt to reserve the same resource simultaneously.

The final solution must guarantee that only one active booking succeeds.

### R-02 — Incorrect Automatic Release

A legitimately occupied resource could be released if check-in evidence is missing, delayed or incorrectly processed.

### R-03 — Duplicate Check-in Events

External systems may send the same event multiple times.

Processing must therefore be idempotent.

### R-04 — Delayed and Out-of-order Events

Check-in evidence may arrive after subsequent events or after automatic release.

The system must safely handle event ordering.

### R-05 — Retry Safety

Release and notification jobs may fail and retry.

Retries must not create duplicate state changes or notifications.

### R-06 — Multi-office Timezones

Incorrect timezone handling could cause booking and release deadlines to behave incorrectly.

### R-07 — Authorisation

Authentication alone is insufficient.

The application must enforce access to employee and administrator functionality on the server.

### R-08 — Privileged Administrative Actions

Manual overrides can modify important operational state and must therefore be auditable.

### R-09 — Integration Coupling

The booking domain should not depend directly on a specific hardware or check-in provider.

### R-10 — Privacy

Booking and check-in information may reveal employee office attendance patterns.

Data collection and retention therefore need explicit controls.

### R-11 — Agent Access

AI agents could gain access to secrets, production systems or unnecessary company data if permissions are not properly constrained.

### R-12 — Generated Change Quality

Agent-generated code could introduce defects, vulnerabilities or architectural inconsistency if it is not reviewed and verified.

---

## 13. Open Questions for the Client

### Q-01 — Peak Demand

Are there expected periods where a large number of employees attempt to book resources simultaneously?

### Q-02 — Parking Eligibility

Can all employees reserve parking, or are there eligibility rules?

### Q-03 — Resource Characteristics

Which desk and parking characteristics should be searchable or filterable?

Examples could include monitors, accessibility, team zones or EV charging.

### Q-04 — Initial Check-in Method

Which check-in method is preferred for the first production release?

### Q-05 — Released Resource Behaviour

Should an automatically released resource become immediately bookable after the working day has already started?

### Q-06 — Notification Channel

Should the first production version use Microsoft Teams, email or both?

### Q-07 — Data Retention

How long should booking history, check-in evidence, notifications and audit records be retained?

### Q-08 — Availability Target

What production availability target is expected?

### Q-09 — Recovery Objectives

What Recovery Time Objective and Recovery Point Objective are acceptable?

### Q-10 — Administrator Scope

Should administrators be global, office-specific or both?

### Q-11 — Employee Lifecycle

How should employee onboarding, departure and role changes propagate from Microsoft Entra ID?

### Q-12 — Reporting

Is the operational overview intended only for current operational status, or should historical utilisation reporting also be included?

---

## 14. Requirement Traceability Summary

The specification currently defines:

* 19 functional requirements
* 9 business rules
* 14 non-functional requirements

The major solution concerns are:

* resource discovery
* booking
* conflict prevention
* check-in
* automatic release
* administration
* auditability
* multi-office support
* authentication and authorisation
* notifications
* integrations
* reliability
* security
* privacy
* observability
* delivery automation
* agent governance
* recovery

---

## 15. Context Assessment

### Sufficient for Business Understanding

**YES**

The client problems, users and expected outcomes are sufficiently clear.

### Sufficient for High-Level Solution Design

**YES**

The specification provides enough information to define the initial target architecture, core domain, major components, integration patterns, security approach and reliability model.

### Sufficient for PoC Selection

**YES**

The specification contains several meaningful business flows and technical risks suitable for validation through a PoC.

### Sufficient for Detailed Production Implementation

**NO**

Further clarification is required around retention, availability targets, recovery targets, administrator scope, peak load and the preferred production check-in mechanism.

### Blocking Questions

**NONE for High-Level Solution Design**

The current unanswered questions should be tracked but do not prevent progression to the next lifecycle stage.

---

## 16. Human Review Gate

Before proceeding, a human reviewer should validate:

* Does the document represent the client problem correctly?
* Have any explicit requirements been omitted?
* Have any requirements been invented?
* Are assumptions clearly separated from requirements?
* Are relevant unknowns visible?
* Are any unknowns actually blocking?
* Did the agent avoid making premature implementation decisions?

---

## 17. Context Discovery Outcome

**Status: READY FOR HIGH-LEVEL SOLUTION DESIGN**

The available context is sufficient to continue.

There are no unresolved questions that currently block high-level architecture work.

---

## 18. Next Lifecycle Stage

The next stage is **High-Level Solution Design**.

It should define:

* system decomposition
* core domain boundaries
* application components
* data ownership
* booking consistency model
* check-in event processing
* automatic release mechanism
* identity and authorisation
* notification integration
* audit approach
* multi-office design
* deployment architecture
* security controls
* observability
* backup and recovery
* key architectural decisions
* alternatives considered

Only after the complete target solution is understood should the final 2–3 PoC functionalities be selected.

The PoC should be chosen based on the most important business and technical assumptions to validate, rather than simply choosing the easiest functionality to implement.