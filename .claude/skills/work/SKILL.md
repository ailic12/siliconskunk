---
name: work
description: Execute exactly one approved Smart Office PoC implementation task end-to-end through the existing agentic/ lifecycle.
disable-model-invocation: true
argument-hint: TASK-XX
---

# /work — execute one approved task

Argument: `$ARGUMENTS` — expected to be a single task identifier, e.g. `TASK-07`.

This skill is the orchestrator only. It does not redefine the lifecycle — it
sequences the existing files under `agentic/`, which remain the source of
truth. Read each referenced file in full at the point it is needed; do not
reproduce its content here or invent shortcuts.

`agentic/protocols/lifecycle.md` is canonical for routing and terminal states.
`agentic/project/adapter.md` is canonical for task resolution, source
authority, and this project's execution rules (including mandatory reviewer
isolation, below).

## Step 0 — Validate the argument

`$ARGUMENTS` must match `TASK-\d\d` (`TASK-01` through `TASK-14`). If it is
missing, malformed, or names more than one task, stop and ask the user for a
single valid `TASK-XX` identifier. Do not guess which task was meant.

## Step 1 — Resolve the task

Follow the resolution rule in `agentic/project/adapter.md` ("Work item
resolution"): glob `planning/tasks/TASK-XX-*.md` for the requested number.

- Zero matches -> report `TASK NOT FOUND` and stop.
- More than one match -> report `TASK RESOLUTION AMBIGUOUS` and stop.
- Exactly one match -> this file is the bounded execution contract for
  everything that follows.

## Step 2 — Context Discovery

Read and follow `agentic/workflows/context-discovery.md` in full (it in turn
uses `agentic/protocols/context-sufficiency.md`, `agentic/protocols/evidence.md`,
`agentic/protocols/human-clarification.md`, and `agentic/project/adapter.md`).
Produce its required output.

- `CONTEXT INSUFFICIENT` or `DECOMPOSITION REQUIRED` -> stop, per that
  workflow. Do not continue to planning.
- `CONTEXT SUFFICIENT — READY FOR PLANNING` -> continue.

## Step 3 — Implementation Planning

Read and follow `agentic/workflows/implementation-planning.md` in full, using
the Normalized Engineering Context from Step 2. Produce its required output.

- Stop at `HUMAN APPROVAL REQUIRED`. Print the plan and end your turn here.
  **Do not implement, and do not treat this stop as optional.**

### Approval gate — do not skip

The `/work TASK-XX` message that started this invocation is never approval.
Only an explicit, unambiguous message from the user in this conversation,
made after seeing the plan, counts as approval (e.g. "approved", "go ahead
and implement", "yes"). If the reply is ambiguous, silent, or about something
else, ask for an explicit disposition instead of proceeding. Do not infer
approval from silence, from the original `/work` invocation, or from the user
moving on to another topic.

## Step 4 — Implementation and Verification (only after explicit approval)

Read and follow `agentic/workflows/implementation.md` and
`agentic/protocols/implementation.md` in full, using the approved plan from
Step 3 and the mandatory plan-approval record format in
`agentic/protocols/human-review.md`.

- `IMPLEMENTATION BLOCKED` -> stop and report, per that workflow.
- `IMPLEMENTATION COMPLETE — READY FOR REVIEW` -> continue to Step 5.

## Step 5 — Independent Review (mandatory fresh context)

Independent Review must never run in this orchestrating context. Per the
"Independent Review isolation" execution rule in `agentic/project/adapter.md`,
delegate to the dedicated subagent:

Invoke the Agent tool with `subagent_type: "independent-reviewer"` (defined in
`.claude/agents/independent-reviewer.md`). In the prompt, give it everything it
needs to review cold, since it starts with no memory of this conversation:

- the resolved task file path from Step 1;
- the approved Implementation Plan from Step 3;
- the changed-file list / diff and the verification evidence from Step 4;
- pointers to whichever approved artefacts Step 2 identified as relevant.

If the subagent cannot be started for any reason, do **not** review in this
context as a fallback. Report `REVIEW BLOCKED — REVIEWER UNAVAILABLE` (see
`agentic/project/adapter.md`) and stop for a human decision.

Route the reviewer's returned result per `agentic/workflows/independent-review.md`:

- `CHANGES REQUIRED` -> hand the findings to the Implementer (this context),
  fix only inside the scope approved in Step 3, rerun the relevant
  verification from Step 4, then invoke a **new** `independent-reviewer`
  subagent call — a fresh context again, not a continuation of the previous
  one — for the rerun. Repeat until passed or escalated.
- `REVIEW BLOCKED — UNEXPECTED MUTATION`, `REVIEW BLOCKED — IMPLEMENTATION
  BASIS UNCONFIRMED`, or `REVIEW ESCALATION REQUIRED` -> stop and report, per
  `agentic/protocols/lifecycle.md`.
- `REVIEW PASSED — READY FOR FINAL HUMAN REVIEW` -> continue to Step 6.

## Step 6 — Final Human Review

Assemble the evidence package per the "Final evidence package" and "Mandatory
final disposition record" sections of `agentic/protocols/human-review.md`.
Print `READY FOR FINAL HUMAN REVIEW` and end your turn. Wait for the user's
explicit disposition — do not infer one.

- `APPROVED` -> record the final disposition and report `COMPLETE`. This
  applies to this task only.
- `REJECTED` or `DEFERRED` -> stop.

## Hard rules

- Never treat the `/work TASK-XX` invocation itself, or any output this skill
  produced automatically, as human approval or human disposition.
- Never proceed past `HUMAN APPROVAL REQUIRED` or `READY FOR FINAL HUMAN
  REVIEW` without an explicit human message in this conversation.
- Never perform Independent Review in this context — always delegate to the
  `independent-reviewer` subagent, fresh, every time (initial review and every
  rerun after `CHANGES REQUIRED`).
- `COMPLETE`, `REJECTED`, and `DEFERRED` all end this invocation. Never start
  Context Discovery, Planning, or Implementation for another task
  automatically — a new `/work TASK-XX` is required for every task.
- Never commit, push, branch, open a PR, merge, release, deploy, or publish.
  Those require a separate explicit human instruction after this skill stops.
- Do not duplicate the detailed procedures in `agentic/workflows/*.md` and
  `agentic/protocols/*.md` here — read and follow them directly.
