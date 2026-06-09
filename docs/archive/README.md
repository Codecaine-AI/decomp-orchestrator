# Archive

Historical docs retained for no-data-loss reference. These files are not part of
runtime prompt routing.

- `experimental-sweeps/` - detailed sweep workflow notes kept as historical
  implementation guidance. Active workers use
  `packages/agents/src/worker/context/last-resort-sweeps.md` instead.
- `targeted-iteration.md` - older standalone one-symbol iteration playbook.
  Active workers use the worker system prompt plus
  `packages/agents/src/worker/context/operating-guide.md` instead.
- `worker-context/` - older long-form worker context docs. Active worker
  routing uses the smaller operating, lookup, matching, and last-resort sweep
  guides under `packages/agents/src/worker/context/`.
- `director-context/` - older standalone director context docs. Active director
  scheduling policy is embedded in `packages/agents/src/director/templates/system.md`.
- `knowledge-legacy/` - legacy knowledge-pack mirrors from before role context
  moved beside the agents.
