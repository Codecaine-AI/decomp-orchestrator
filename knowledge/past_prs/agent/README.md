# Past PR Agent Standard

Shared Pi-agent instructions for turning one raw PR slice into a searchable JSON record.
Per-PR folders do not duplicate these prompts; the builder renders the current PR context in memory.

Files:

- `system_prompt.md`: shared Pi system prompt.
- `user_message_template.md`: template for the per-PR context payload.
- `output_schema.json`: required JSON response shape.

Default Pi review config:

- Provider: `codex-lb`
- Model: `gpt-5.5`
- Thinking: `xhigh`
- Tools: `read,grep,find,ls`
