Use the repository planning agent appropriate for this request.

Arguments: $ARGUMENTS

If the request is "poc tasks":
use `.claude/agents/poc-planner.md` to plan the approved PoC and produce the
implementation backlog.

The agent must discover the approved repository artefacts itself.

Stop at human review.
Do not implement.