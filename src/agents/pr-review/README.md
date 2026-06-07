# PR Review Agent

Shared Pi-agent instructions for turning one raw PR slice into a searchable JSON record.
Per-PR folders do not duplicate these prompts; the builder renders the current PR context in memory.

Files:

- `templates/system.md`: shared Pi system prompt.
- `templates/initial_user.md`: template for the per-PR context payload.
- `schema.json`: required JSON response shape.

Default Pi review config:

- Provider: `codex-lb`
- Model: `gpt-5.5`
- Thinking: `medium`
- Tools: `read,grep,find,ls`
- Auth/config: ignored repo-local `local.env` points Pi at `.pi-agent/`, whose `models.json` carries this project's `codex-lb` key.
